import sys

file_path = "/home/tim/Desktop/01.mine-management-system/scripts/deploy-all.sh"
with open(file_path, "r") as f:
    content = f.read()

content = content.replace("npx expo start --tunnel", "npx expo start --lan")

target = """echo -e "${YELLOW}→ Attaching to session now...${NC}"
echo -e "${YELLOW}→ (Press Ctrl+B then D to detach)${NC}"
sleep 2

# Auto-open browser
if python3 -m webbrowser -t "http://localhost:${PORT}/dashboard" &>/dev/null; then
    :
fi

# Attach to session
tmux attach -t $SESSION_NAME"""

replacement = """sleep 2

# Auto-open browser
if python3 -m webbrowser -t "http://localhost:${PORT}/dashboard" &>/dev/null; then
    :
fi

# Attach to session only if interactive
if [ -t 0 ]; then
    echo -e "${YELLOW}→ Attaching to session now...${NC}"
    echo -e "${YELLOW}→ (Press Ctrl+B then D to detach)${NC}"
    tmux attach -t $SESSION_NAME
else
    echo -e "${YELLOW}→ Services are running in the background.${NC}"
    echo -e "${YELLOW}→ Run 'tmux attach -t $SESSION_NAME' to view the control center.${NC}"
fi"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(content)
    print("deploy-all.sh patched successfully!")
else:
    print("Target not found.")

