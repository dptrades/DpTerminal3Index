#!/bin/bash
# Forward Test — Run locally against dev server
# Usage: ./scripts/forward-test.sh [run|status|reset]
#
# Requires dev server running on port 3000 (npm run dev)

PORT=3000
BASE="http://localhost:$PORT/api/forward-test"

ACTION=${1:-run}

case $ACTION in
  run)
    echo "Running forward test..."
    RESULT=$(curl -s --max-time 180 -X POST "$BASE" \
      -H 'Content-Type: application/json' -d '{}')

    if echo "$RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('summary','No summary'))" 2>/dev/null; then
      echo ""
      echo "Positions:"
      echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)['state']
for p in d['positions']:
    print(f'  {p[\"symbol\"]:5s} {p[\"qty\"]:3d} @ \${p[\"entryPrice\"]:.2f}  Stop:\${p[\"stopLoss\"]:.2f}  Target:\${p[\"takeProfit\"]:.2f}  Score:{p[\"entryScore\"]}')
if not d['positions']: print('  (none)')
print(f'\nEquity: \${d[\"account\"][\"equity\"]:.2f}  Cash: \${d[\"account\"][\"cash\"]:.2f}  Trades: {len(d[\"trades\"])}')
" 2>/dev/null
    else
      echo "Error: $RESULT"
    fi
    ;;

  status)
    echo "Forward test status:"
    curl -s --max-time 10 "$BASE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'Runs: {d[\"totalRuns\"]} | Last: {d[\"lastRunDate\"]} | Start: {d[\"startDate\"]}')
print(f'Equity: \${d[\"account\"][\"equity\"]:.2f} | Cash: \${d[\"account\"][\"cash\"]:.2f}')
ret = ((d['account']['equity'] - d['account']['initialBalance']) / d['account']['initialBalance']) * 100
print(f'Return: {ret:+.2f}%')
print(f'\nPositions ({len(d[\"positions\"])}):')
for p in d['positions']:
    print(f'  {p[\"symbol\"]:5s} {p[\"qty\"]:3d} @ \${p[\"entryPrice\"]:.2f}  Stop:\${p[\"stopLoss\"]:.2f}  Target:\${p[\"takeProfit\"]:.2f}')
if not d['positions']: print('  (none)')
print(f'\nTrades ({len(d[\"trades\"])}):')
for t in d['trades'][-5:]:
    print(f'  {t[\"symbol\"]:5s} {t[\"exitReason\"]:10s} PnL:\${t[\"pnl\"]:.2f} ({t[\"pnlPercent\"]:+.1f}%) | {t[\"entryDate\"]} > {t[\"exitDate\"]}')
if not d['trades']: print('  (none yet)')
print(f'\nToday signals ({len([s for s in d[\"signals\"] if s[\"date\"]==d[\"lastRunDate\"]])}):')
for s in d['signals']:
    if s['date'] == d['lastRunDate']:
        print(f'  {s[\"symbol\"]:5s} Score:{s[\"score\"]:3d} {s[\"trend\"]:8s} -> {s[\"action\"]}')
" 2>/dev/null
    ;;

  reset)
    echo "Resetting forward test..."
    curl -s --max-time 10 -X POST "$BASE" \
      -H 'Content-Type: application/json' -d '{"action":"reset"}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'Status: {d[\"status\"]}')
print('Forward test reset to \$10,000 initial balance.')
" 2>/dev/null
    ;;

  *)
    echo "Usage: $0 [run|status|reset]"
    ;;
esac
