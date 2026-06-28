#!/bin/bash
# Daily automated trading — runs forward test + Alpaca paper trade
# Called by macOS launchd at 10:00 AM ET on weekdays
# Also runs manually: ./scripts/daily-trade.sh

LOG_DIR="$HOME/Documents/AntiGravity/V5/data/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/trade_$(date +%Y-%m-%d).log"
PROJECT_DIR="$HOME/Documents/AntiGravity/V5"

exec >> "$LOG" 2>&1
echo "=========================================="
echo "Daily Trade Run: $(date)"
echo "=========================================="

# Check if dev server is running
if ! curl -s --max-time 3 http://localhost:3000/ -o /dev/null 2>/dev/null; then
    echo "Dev server not running. Starting..."
    cd "$PROJECT_DIR"
    npx next dev -p 3000 &>/dev/null &
    SERVER_PID=$!
    echo "Started dev server (PID: $SERVER_PID)"

    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s --max-time 2 http://localhost:3000/ -o /dev/null 2>/dev/null; then
            echo "Server ready after ${i}s"
            break
        fi
        sleep 1
    done

    if ! curl -s --max-time 2 http://localhost:3000/ -o /dev/null 2>/dev/null; then
        echo "ERROR: Server failed to start after 30s. Aborting."
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
    STARTED_SERVER=true
else
    echo "Dev server already running"
    STARTED_SERVER=false
fi

echo ""
echo "--- Forward Test ---"
"$PROJECT_DIR/scripts/forward-test.sh" run

echo ""
echo "--- Alpaca Paper Trade ---"
"$PROJECT_DIR/scripts/paper-trade.sh" run

echo ""
echo "--- Git save ---"
cd "$PROJECT_DIR"
git add data/forward_test.json data/alpaca_paper_test.json 2>/dev/null
if git diff --cached --quiet 2>/dev/null; then
    echo "No data changes to commit"
else
    git commit -m "Daily trading update $(date +%Y-%m-%d)" 2>/dev/null
    git push terminal main 2>/dev/null && echo "Pushed to GitHub" || echo "Push failed (will retry next run)"
fi

echo ""
echo "Complete: $(date)"
echo "=========================================="
