#!/usr/bin/env bash
# Build whisper.cpp's server and download a multilingual model, for local
# speech-to-text (the learner's voice stays on this computer).
#   npm run setup:whisper            # small model (~466 MB, good for Chinese)
#   WHISPER_SIZE=base npm run setup:whisper   # smaller and faster, less accurate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIZE="${WHISPER_SIZE:-small}"
# the whisper.cpp commit this app was tested with; WHISPER_REF=<tag|commit> to change it
REF="${WHISPER_REF:-a8d002cfd879315632a579e73f0148d06959de36}"
SRC="$ROOT/vendor/whisper.cpp"
MODEL="$ROOT/models/ggml-$SIZE.bin"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. $2" >&2; exit 1; }; }
need git "Install Git (macOS: xcode-select --install; Linux: your package manager)."
need cmake "Install cmake (macOS: brew install cmake; Linux: your package manager)"
command -v ffmpeg >/dev/null 2>&1 || echo "Note: ffmpeg not found. Speech-to-text and tone checks need it: macOS: brew install ffmpeg; Linux: install ffmpeg with your package manager (or set FFMPEG_PATH)." >&2

if [ ! -d "$SRC/.git" ]; then
  git init -q "$SRC"
  git -C "$SRC" remote add origin https://github.com/ggml-org/whisper.cpp.git
fi
git -C "$SRC" fetch -q --depth 1 origin "$REF"
git -C "$SRC" checkout -q FETCH_HEAD
configure() { cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_EXAMPLES=ON; }
if ! configure; then
  # macOS: the newest SDK can be ahead of the installed linker ("tapi error:
  # malformed file"); try the older SDKs from the Command Line Tools.
  built=0
  if [ "$(uname)" = "Darwin" ] && [ -z "${SDKROOT:-}" ]; then
    for sdk in $(ls -d /Library/Developer/CommandLineTools/SDKs/MacOSX[0-9]*.sdk 2>/dev/null | sort -V -r); do
      echo "Retrying with SDKROOT=$sdk" >&2
      rm -rf "$SRC/build"
      if SDKROOT="$sdk" configure; then export SDKROOT="$sdk"; built=1; break; fi
    done
  fi
  [ "$built" = 1 ] || { echo "cmake could not configure whisper.cpp; see the errors above." >&2; exit 1; }
fi
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
