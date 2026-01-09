#!/bin/bash
echo "=== 1. RUNNING PROCESSES ==="
ps aux | grep -E "node|python" | grep -v grep

echo ""
echo "=== 2. BACKEND HEALTH CHECK ==="
curl -s https://bug-free-fiesta-69xwgg4jwj6r34gpv-5001.app.github.dev/health

echo ""
echo "=== 3. BACKEND VIDEOS API ==="
curl -s https://bug-free-fiesta-69xwgg4jwj6r34gpv-5001.app.github.dev/api/videos | head -50

echo ""
echo "=== 4. FLUTTER API CONFIG ==="
cd app/miniguru
head -60 lib/network/MiniguruApi.dart 2>/dev/null || echo "File not found"

echo ""
echo "=== 5. SEARCHING FOR API URLS ==="
grep -rn "localhost\|127.0.0.1" lib/ 2>/dev/null | head -10

echo ""
echo "=== 6. VIDEO PLAYER FILES ==="
find lib -name "*video*" -o -name "*player*" 2>/dev/null
