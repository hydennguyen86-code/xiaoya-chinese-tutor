#!/usr/bin/env bash
# Cài backend nhận giọng tiếng Trung chạy trên máy (sherpa-onnx + SenseVoice).
#   npm run setup:stt                      # SenseVoice int8 (~230 MB)
#   STT_MODELS=paraformer npm run setup:stt   # Paraformer-zh thay vì SenseVoice
#   STT_MODELS=all npm run setup:stt          # cả hai
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="$ROOT/models"
WHICH="${STT_MODELS:-sensevoice}"
BASE="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"
SENSE="sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17"
PARA="sherpa-onnx-paraformer-zh-2024-03-09"

command -v curl >/dev/null 2>&1 || { echo "Missing curl." >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "Missing tar." >&2; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || echo "Note: ffmpeg not found. Speech-to-text needs it to decode recordings: macOS: brew install ffmpeg." >&2

cd "$ROOT"
echo "Installing sherpa-onnx-node (native addon)..."
npm install

mkdir -p "$MODELS"
fetch_model() {
  local name="$1"
  if [ -f "$MODELS/$name/tokens.txt" ]; then
    echo "already have $MODELS/$name"
    return
  fi
  echo "Downloading $name ..."
  curl -L --fail -o "$MODELS/$name.tar.bz2.part" "$BASE/$name.tar.bz2"
  mv "$MODELS/$name.tar.bz2.part" "$MODELS/$name.tar.bz2"
  tar -xjf "$MODELS/$name.tar.bz2" -C "$MODELS"
  rm -f "$MODELS/$name.tar.bz2"
}

case "$WHICH" in
  sensevoice) fetch_model "$SENSE" ;;
  paraformer) fetch_model "$PARA" ;;
  all) fetch_model "$SENSE"; fetch_model "$PARA" ;;
  *) echo "STT_MODELS must be sensevoice, paraformer or all." >&2; exit 1 ;;
esac

echo
echo "Done. Models are in $MODELS"
echo "Restart the app: it uses sherpa-onnx automatically (STT_BACKEND=auto)."
echo "Force a backend: STT_BACKEND=sherpa|whisper|off; pick a model dir: STT_SHERPA_MODEL_DIR=<dir>."
