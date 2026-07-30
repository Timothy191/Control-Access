#!/bin/bash
# Network QoS Optimization Script for Mine Management System
# Prioritizes scanner traffic for fast, reliable data transfer

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   Mine Network QoS Optimizer${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Note: Not running as root. Some features limited.${NC}"
    echo -e "${YELLOW}Run with sudo for full QoS implementation${NC}"
    echo ""
fi

# Detect network interface
get_interface() {
    local iface
    iface=$(ip route | grep default | awk '{print $5}' | head -1)
    echo "${iface:-eth0}"
}

# Detect server IP
get_server_ip() {
    local ip
    ip=$(ip route get 1.2.3.4 2>/dev/null | grep -oP 'src \K[^ ]+' | head -1)
    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    echo "${ip:-192.168.1.100}"
}

INTERFACE=$(get_interface)
SERVER_IP=$(get_server_ip)
SCANNER_SUBNET="${SERVER_IP%.*}.0/24"

echo -e "${GREEN}Network Configuration:${NC}"
echo "  Interface: $INTERFACE"
echo "  Server IP: $SERVER_IP"
echo "  Scanner Subnet: $SCANNER_SUBNET"
echo ""

# Function to apply QoS rules
apply_qos() {
    echo -e "${YELLOW}Applying QoS rules...${NC}"
    
    # Clean up existing rules
    tc qdisc del dev "$INTERFACE" root 2>/dev/null
    
    # Create hierarchical token bucket (HTB) for bandwidth shaping
    tc qdisc add dev "$INTERFACE" root handle 1: htb default 10
    
    # Root class - 100Mbps max
    tc class add dev "$INTERFACE" parent 1: classid 1:1 htb rate 100mbit burst 15k
    
    # High priority for scanner UDP traffic (port 9999)
    tc class add dev "$INTERFACE" parent 1:1 classid 1:10 htb rate 50mbit prio 0 burst 15k
    
    # Medium priority for API traffic
    tc class add dev "$INTERFACE" parent 1:1 classid 1:20 htb rate 30mbit prio 1 burst 15k
    
    # Low priority for general traffic
    tc class add dev "$INTERFACE" parent 1:1 classid 1:30 htb rate 20mbit prio 2 burst 15k
    
    # Filter: Mark UDP scanner packets (port 9999)
    tc filter add dev "$INTERFACE" parent 1: protocol all prio 0 u32 match ip dport 9999 0xffff flowid 1:10
    tc filter add dev "$INTERFACE" parent 1: protocol all prio 0 u32 match ip sport 9999 0xffff flowid 1:10
    
    # Filter: Mark API traffic
    tc filter add dev "$INTERFACE" parent 1: protocol all prio 1 u32 match ip dport 8080 0xffff flowid 1:20
    tc filter add dev "$INTERFACE" parent 1: protocol all prio 1 u32 match ip dport 3000 0xffff flowid 1:20
    
    echo -e "${GREEN}✓ QoS rules applied successfully${NC}"
}

# Function to set network buffer sizes
optimize_buffers() {
    echo -e "${YELLOW}Optimizing network buffers...${NC}"
    
    # Increase UDP buffer sizes
    if [ -w /proc/sys/net/core/rmem_max ]; then
        echo 16777216 > /proc/sys/net/core/rmem_max
        echo 16777216 > /proc/sys/net/core/wmem_max
        echo 4096 87380 16777216 > /proc/sys/net/ipv4/tcp_rmem
        echo 4096 87380 16777216 > /proc/sys/net/ipv4/tcp_wmem
        echo -e "${GREEN}✓ Network buffers optimized${NC}"
    else
        echo -e "${YELLOW}⚠ Cannot modify buffer sizes (need root)${NC}"
    fi
}

# Function to enable IP forwarding and optimization
network_tweaks() {
    echo -e "${YELLOW}Applying network tweaks...${NC}"
    
    # Enable IP forwarding (if not enabled)
    echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null
    
    # Enable TCP fast open
    echo 3 > /proc/sys/net/ipv4/tcp_fastopen 2>/dev/null
    
    # Optimize TCP keepalive
    echo 30 > /proc/sys/net/ipv4/tcp_keepalive_time 2>/dev/null
    echo 10 > /proc/sys/net/ipv4/tcp_keepalive_intvl 2>/dev/null
    echo 5 > /proc/sys/net/ipv4/tcp_keepalive_probes 2>/dev/null
    
    # Reduce TCP latency
    echo 1 > /proc/sys/net/ipv4/tcp_low_latency 2>/dev/null
    
    # Increase connection tracking table size
    echo 262144 > /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null
    
    echo -e "${GREEN}✓ Network tweaks applied${NC}"
}

# Function to open firewall ports
configure_firewall() {
    echo -e "${YELLOW}Configuring firewall...${NC}"
    
    # Check if iptables exists
    if ! command -v iptables &> /dev/null; then
        echo -e "${YELLOW}⚠ iptables not found, skipping firewall config${NC}"
        return
    fi
    
    # Allow scanner ports
    for port in 8080 9999 5000 8080 9000 10000; do
        iptables -A INPUT -p udp --dport $port -j ACCEPT 2>/dev/null
        iptables -A INPUT -p tcp --dport $port -j ACCEPT 2>/dev/null
    done
    
    echo -e "${GREEN}✓ Firewall configured for scanner ports${NC}"
}

# Function to display current QoS status
status() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}   QoS Status${NC}"
    echo -e "${BLUE}============================================================${NC}"
    
    echo -e "\n${GREEN}Traffic Classes:${NC}"
    tc class show dev "$INTERFACE" 2>/dev/null || echo "  No QoS classes configured"
    
    echo -e "\n${GREEN}Traffic Filters:${NC}"
    tc filter show dev "$INTERFACE" 2>/dev/null | grep -E "filter|flowid" || echo "  No filters configured"
    
    echo -e "\n${GREEN}Network Buffers:${NC}"
    echo "  rmem_max: $(cat /proc/sys/net/core/rmem_max 2>/dev/null || echo 'N/A')"
    echo "  wmem_max: $(cat /proc/sys/net/core/wmem_max 2>/dev/null || echo 'N/A')"
    
    echo -e "\n${GREEN}Open Ports (scanner):${NC}"
    ss -ulnp | grep -E "9999|5000|8080|9000" || echo "  No scanner ports listening"
}

# Function to clean up QoS rules
cleanup() {
    echo -e "${YELLOW}Cleaning up QoS rules...${NC}"
    tc qdisc del dev "$INTERFACE" root 2>/dev/null
    echo -e "${GREEN}✓ QoS rules removed${NC}"
}

# Parse command line arguments
case "${1:-apply}" in
    apply)
        optimize_buffers
        network_tweaks
        configure_firewall
        apply_qos
        ;;
    status)
        status
        ;;
    cleanup)
        cleanup
        ;;
    quick)
        optimize_buffers
        network_tweaks
        ;;
    *)
        echo "Usage: $0 {apply|status|cleanup|quick}"
        echo ""
        echo "  apply   - Apply all QoS optimizations (requires root)"
        echo "  status  - Show current QoS status"
        echo "  cleanup - Remove all QoS rules"
        echo "  quick   - Apply quick optimizations (no QoS)"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   Network Optimization Complete${NC}"
echo -e "${GREEN}============================================================${NC}"
