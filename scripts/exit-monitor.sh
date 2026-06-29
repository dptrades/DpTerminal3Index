#!/bin/bash
# Exit Monitor — checks positions hourly for stop/scale/trail exits
# Runs locally via launchd every hour during market hours
# Lightweight: ~8 API calls, ~2-3 seconds execution

PORT=3000
LOG_DIR="$HOME/Documents/AntiGravity/V5/data/logs"
mkdir -p "$LOG_DIR"

# Check if dev server is running
if ! curl -s --max-time 3 http://localhost:$PORT/ -o /dev/null 2>/dev/null; then
    echo "$(date): Dev server not running. Skipping." >> "$LOG_DIR/exit-monitor.log"
    exit 0
fi

# Run the exit check
RESULT=$(curl -s --max-time 30 http://localhost:$PORT/api/exit-monitor 2>/dev/null)
SUMMARY=$(echo "$RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('summary','error'))" 2>/dev/null)

echo "$(date): $SUMMARY" >> "$LOG_DIR/exit-monitor.log"
