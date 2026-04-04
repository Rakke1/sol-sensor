#!/usr/bin/env bash
# Stop script for localnet development
# Stops test-validator and cleans up any related processes

# Cleanup function to stop all running processes
cleanup() {
    echo ""
    echo "🛑 Stopping all processes..."
    if [ -f /tmp/validator.pid ]; then
        validator_pid=$(cat /tmp/validator.pid)
        if kill -0 "$validator_pid" 2>/dev/null; then
            kill "$validator_pid" 2>/dev/null && echo "  ✓ Test-validator stopped (PID: $validator_pid)" || true
        fi
        rm -f /tmp/validator.pid
    fi
    pkill -f solana-test-validator 2>/dev/null && echo "  ✓ All solana-test-validator processes stopped" || true
    rm -rf programs/test-ledger
    rm scripts/keys/*.json
    
    echo "  ✓ Cleanup complete"
}

# Trap cleanup on script exit
trap cleanup EXIT