#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Chưa có Node.js. Cài Node 24 từ https://nodejs.org/ rồi mở lại file này."
  echo "Hướng dẫn: https://github.com/hydennguyen86-code/xiaoya-chinese-tutor#readme"
  read -r -p "Nhấn Enter để đóng…"
  exit 1
fi
node scripts/start.mjs
read -r -p "Nhấn Enter để đóng…"
