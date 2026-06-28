#!/bin/bash
# Alpaca Paper Trading — Run locally against dev server
# Usage: ./scripts/paper-trade.sh [run|status|reset]
#
# Requires dev server running on port 3000 (npm run dev)
# Requires ALPACA_API_KEY and ALPACA_API_SECRET in .env.local

PORT=3000
BASE="http://localhost:$PORT/api/paper-trade"

ACTION=${1:-run}

case $ACTION in
  run)
    echo "Running Alpaca paper trade..."
    RESULT=$(curl -s --max-time 300 -X POST "$BASE" \
      -H 'Content-Type: application/json' -d '{}')

    echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'error' in d: print('ERROR:', d['error'])
else: print(d.get('summary','No summary'))
" 2>/dev/null
    ;;

  status)
    echo "Alpaca paper trade status:"
    curl -s --max-time 10 "$BASE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d['state'];a=d.get('alpaca',{}).get('account')
if a: print(f'Alpaca Equity: \${float(a[\"equity\"]):.2f} | Cash: \${float(a[\"cash\"]):.2f}')
print(f'Runs: {s[\"totalRuns\"]} | Last: {s[\"lastRunDate\"] or \"Never\"}')
ret=((s['account']['equity']-s['account']['initialBalance'])/s['account']['initialBalance']*100) if s['account']['initialBalance']>0 else 0
print(f'Return: {ret:+.2f}% | Positions: {len(s[\"positions\"])} | Trades: {len(s[\"trades\"])}')
for p in s['positions']:
    print(f'  {p[\"symbol\"]:5s} {p[\"qty\"]:3d} @ \${p[\"entryPrice\"]:.2f} Stop:\${p[\"stopLoss\"]:.2f} Scale:{p[\"scaleLevel\"]} [{p[\"source\"]}]')
" 2>/dev/null
    ;;

  reset)
    echo "Resetting Alpaca paper trade tracking..."
    curl -s --max-time 10 -X POST "$BASE" \
      -H 'Content-Type: application/json' -d '{"action":"reset"}' | python3 -c "
import json,sys;d=json.load(sys.stdin);print(f'Status: {d[\"status\"]}')
print('Tracking reset. Alpaca positions are NOT affected.')
" 2>/dev/null
    ;;

  *)
    echo "Usage: $0 [run|status|reset]"
    ;;
esac
