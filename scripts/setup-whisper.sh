#!/usr/bin/env bash
# Build whisper.cpp's server and download a multilingual model, for local
# speech-to-text (the learner's voice stays on this computer).
#   npm run setup:whisper            # small model (~466 MB, good for Chinese)
#   WHISPER_SIZE=base npm run setup:whisper   # smaller and faster, less accurate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIZE="${WHISPER_SIZE:-small}"
SRC="$ROOT/vendor/whisper.cpp"
MODEL="$ROOT/models/ggml-$SIZE.bin"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. $2" >&2; exit 1; }; }
need git "Install Xcode command line tools: xcode-select --install"
need cmake "Install it, e.g. brew install cmake"
command -v ffmpeg >/dev/null 2>&1 || echo "Note: ffmpeg not found. Speech-to-text and tone checks need it: brew install ffmpeg (or set FFMPEG_PATH)." >&2

if [ ! -d "$SRC" ]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$SRC"
fi
cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_EXAMPLES=ON
cmake --build "$SRC/build" --config Release -j --target whisper-server

if [ ! -f "$MODEL" ]; then
  mkdir -p "$ROOT/models"
  curl -L --fail -o "$MODEL.part" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$SIZE.bin"
  mv "$MODEL.part" "$MODEL"
fi

echo
echo "whisper.cpp is ready: $SRC/build/bin/whisper-server"
echo "model: $MODEL"
if [ "$SIZE" != "small" ]; then
  echo "Start the app with WHISPER_MODEL=$MODEL so this model is used."
fi
