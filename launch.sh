#!/bin/bash

# mac/linux launch script 

check_node() {
    if ! command -v node &> /dev/null; then
        echo "ERROR: Node.js is not installed (or not in PATH🥀)"
        exit 1
    fi
}

main() {
    check_node
    
    # Clear screen
    clear
    
    # Run launcher
    node launcher.js
    
    # Handle exit
    if [ $? -ne 0 ]; then
        echo ""
        echo "Launcher fucked up."
        read -n 1 -p "Press any key to exit..."
    fi
}

main "$@"