#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export SCRIPT_DIR

# Source the deploy.sh to get the launch_terminal function
source deploy.sh

echo "Testing terminal launch function..."
echo "SCRIPT_DIR: $SCRIPT_DIR"

# Test with a simple command
launch_terminal "Test Terminal" "echo 'Hello from test terminal'; sleep 5" "$SCRIPT_DIR"
echo "Launch function returned: $?"

# Wait a bit to see if terminal appears
sleep 3

# Check if any gnome-terminal processes with our title are running
ps aux | grep gnome-terminal | grep -v grep | grep "Test Terminal" || echo "No matching gnome-terminal processes found"

# Check PID file
if [ -f "$SCRIPT_DIR/.deployment.pid" ]; then
    echo "PID file exists:"
    cat "$SCRIPT_DIR/.deployment.pid"
else
    echo "PID file does not exist"
fi

# Check tracked processes
if [ -f "$SCRIPT_DIR/.deployment.pid" ]; then
    echo "Tracked processes:"
    cat "$SCRIPT_DIR/.deployment.pid"
else
    echo "No PID file for tracking"
fi

# Cleanup
cleanup_pids
echo "Cleanup completed"
