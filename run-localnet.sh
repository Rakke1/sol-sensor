#!/usr/bin/env bash
# Setup script for localnet development
# Starts test-validator, deploys program, and runs bootstrap

set -e  # Exit on error

echo "🔧 SolSensor Localnet Setup"
echo ""

# Check if test-validator is running
if ps aux | grep -q "[s]olana-test-validator"; then
    echo "✓ Test-validator already running"
else
    echo "[1/3] Starting test-validator..."
    # Ensure clean ledger
    rm -rf /home/rakke/Solana/sol-sensor/programs/test-ledger
    cd /home/rakke/Solana/sol-sensor/programs
    solana program dump -u d TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb spl_token_2022.so
    nohup solana-test-validator \
        --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb spl_token_2022.so \
        > /tmp/validator.log 2>&1 &
    validator_pid=$!
    echo $validator_pid > /tmp/validator.pid
    
    # Wait for validator to be ready
    echo "  Waiting for validator to start..."
    for i in {1..30}; do
        if solana cluster-version -u localhost 2>/dev/null | grep -q "^[0-9]"; then
            echo "  ✓ Validator ready"
            echo "  Airdropping SOL to default wallet..."
            solana airdrop 5 -u localhost 2>&1 | tail -1
            break
        fi
        sleep 1
    done
fi

echo ""
echo "[2/3] Deploying sol_sensor program..."

# Check if program is already deployed
program_check=$(solana account ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ -u localhost 2>&1 || true)
if echo "$program_check" | grep -qi "executable\|program"; then
    echo "  ✓ Program already deployed"
else
    cd /home/rakke/Solana/sol-sensor/programs
    
    # Deploy program and capture output
    deploy_output=$(solana program deploy -u localhost \
        target/deploy/sol_sensor.so \
        --program-id target/deploy/sol_sensor-keypair.json 2>&1 || true)
    
    echo "$deploy_output" | grep -E "Program Id:|Signature:"
    
    # Check if deployment succeeded
    if ! echo "$deploy_output" | grep -q "Signature:"; then
        echo "  ❌ Program deployment failed"
        echo "  Error: $deploy_output"
        exit 1
    fi
    
    # Verify deployment with multiple retries
    echo "  Verifying deployment..."
    deployed=false
    for i in {1..15}; do
        sleep 1
        account_info=$(solana account ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ -u localhost 2>&1 || true)
        
        # Check if account exists and is executable
        if echo "$account_info" | grep -qi "executable" || echo "$account_info" | grep -qi "owner.*TokenkegQfeZyiNwAJsyFbPVwwQQfKP2zcSP4aQj9N"; then
            echo "  ✓ Program deployed successfully"
            deployed=true
            break
        fi
    done
    
    if [ "$deployed" = false ]; then
        # Even if verification failed, if we got a signature, deployment likely succeeded
        if echo "$deploy_output" | grep -q "Signature:"; then
            echo "  ⚠ Deployment signature received, proceeding (verification pending)"
        else
            echo "  ❌ Program deployment verification failed after 15 seconds"
            echo "  Last account check: $account_info"
            exit 1
        fi
    fi
fi

echo ""
echo "[3/3] Ensuring payer has SOL and running bootstrap..."
cd /home/rakke/Solana/sol-sensor/scripts

# Request airdrop for payer if they don't have keys yet
payer_keypair="./keys/payer.json"
if [ ! -f "$payer_keypair" ]; then
    echo "  Getting SOL for new payer..."
    solana airdrop 2 -u localhost 2>&1 | tail -2
else
    echo "  Airdrop will be handled by bootstrap script"
fi

echo ""
npm run bootstrap:localnet

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Configure backend/.env with addresses from above"
echo "  2. Run backend: npm --prefix backend start"
echo "  3. Run frontend: npm --prefix frontend dev"
echo ""
echo "To stop all running processes later, run:"
echo "  pkill -f solana-test-validator"
echo "  kill \$(cat /tmp/validator.pid 2>/dev/null) 2>/dev/null || true"
