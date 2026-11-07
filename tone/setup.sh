#!/usr/bin/env bash
# Creates the Python environment for the tone classifier service (tone/tone_service.py).
# Needs python3 (3.10+) on PATH, or TONE_PYTHON_BASE pointing at one. ~2 GB of
# packages (PyTorch, transformers, librosa); the Mandarin wav2vec2 backbone
# (~380 MB) is downloaded from Hugging Face the first time the service starts.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${TONE_PYTHON_BASE:-python3}"
if ! "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
  echo "Cần Python 3.10 trở lên (đặt TONE_PYTHON_BASE=/đường/dẫn/python3)." >&2
  exit 1
fi
if [ ! -x .venv-tone/bin/python ]; then "$PY" -m venv .venv-tone; fi
.venv-tone/bin/pip install --upgrade pip >/dev/null
.venv-tone/bin/pip install -r tone/requirements.txt
if [ ! -f tone/weights/tone-mlp.pt ]; then
  echo "Chưa có tone/weights/tone-mlp.pt: chạy 'npm run tone:dataset' rồi 'npm run tone:train' (xem tone/README.md)." >&2
fi
echo "Xong. Khởi động lại app (npm start): server tự chạy tone_service.py khi thấy .venv-tone và trọng số."
