#!/bin/bash
#
# Whether Market Cron Setup Script
#
# This script sets up the cron jobs for daily market creation and oracle settlement.
# Run this on the Hetzner server after deploying the contracts directory.
#
# Usage:
#   chmod +x cron-setup.sh
#   ./cron-setup.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/var/log/whether"

echo "=============================================="
echo "Whether Market Cron Setup"
echo "=============================================="
echo ""
echo "Contracts directory: $CONTRACTS_DIR"
echo "Log directory: $LOG_DIR"
echo ""

# Create log directory if it doesn't exist
if [ ! -d "$LOG_DIR" ]; then
    echo "Creating log directory..."
    sudo mkdir -p "$LOG_DIR"
    sudo chown $USER:$USER "$LOG_DIR"
fi

# Check if required environment variables are set
if [ -z "$MARKET_FACTORY_ADDRESS" ] || [ -z "$ORACLE_RESOLVER_ADDRESS" ] || [ -z "$DEPLOYER_MNEMONIC" ]; then
    echo "Warning: Environment variables not set. Make sure to set them before cron runs:"
    echo "  - MARKET_FACTORY_ADDRESS"
    echo "  - ORACLE_RESOLVER_ADDRESS"
    echo "  - DEPLOYER_MNEMONIC"
    echo ""
    echo "You can add them to /etc/environment or create a .env file in $CONTRACTS_DIR"
fi

# Create the cron jobs
echo "Creating cron jobs..."

# Generate the crontab entries
CRON_ENTRIES="
# Whether Market Daily Jobs
# ========================

# Daily market creation at 00:05 UTC
# Creates markets for tomorrow's weather predictions
5 0 * * * cd $CONTRACTS_DIR && /usr/bin/npx tsx scripts/dailyMarketGenerator.ts >> $LOG_DIR/market-creation.log 2>&1

# Oracle settlement at 12:00 UTC
# Settles markets from the previous day with actual weather data
0 12 * * * cd $CONTRACTS_DIR/../oracle && /usr/bin/python3 -m oracle.src.main --mode settle >> $LOG_DIR/oracle-settle.log 2>&1

# Log rotation weekly
0 0 * * 0 find $LOG_DIR -name '*.log' -mtime +7 -exec gzip {} \;
"

# Backup existing crontab
echo "Backing up existing crontab..."
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Check if Whether entries already exist
if crontab -l 2>/dev/null | grep -q "Whether Market Daily Jobs"; then
    echo "Whether cron jobs already exist. Updating..."
    # Remove existing Whether entries and add new ones
    crontab -l 2>/dev/null | sed '/# Whether Market Daily Jobs/,/# Log rotation weekly/d' | { cat; echo "$CRON_ENTRIES"; } | crontab -
else
    echo "Adding Whether cron jobs..."
    # Append to existing crontab
    (crontab -l 2>/dev/null; echo "$CRON_ENTRIES") | crontab -
fi

echo ""
echo "=============================================="
echo "Cron Setup Complete!"
echo "=============================================="
echo ""
echo "Current crontab entries:"
crontab -l | grep -A10 "Whether" || echo "(no Whether entries found)"
echo ""
echo "Logs will be written to:"
echo "  - $LOG_DIR/market-creation.log"
echo "  - $LOG_DIR/oracle-settle.log"
echo ""
echo "To test market creation (dry run):"
echo "  cd $CONTRACTS_DIR && npx tsx scripts/dailyMarketGenerator.ts --dry-run"
echo ""
echo "To manually run market creation:"
echo "  cd $CONTRACTS_DIR && npx tsx scripts/dailyMarketGenerator.ts"
echo ""
echo "To view cron logs:"
echo "  tail -f $LOG_DIR/market-creation.log"
echo ""
