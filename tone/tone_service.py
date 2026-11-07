"""Per-syllable tone scoring service for the Misu server.

Loads the Mandarin wav2vec2 backbone and the small classifier trained by
train.py, then answers on 127.0.0.1:8768:

  GET  /health → { ok, backbone, layer, device, variant, trainedAt, metrics }
  POST /score  { "pcm": <base64 float32 LE, 16 kHz mono>, "segments": [{ "start", "end", "pos" }] }
               → { "syllables": [{ "tone": 1-5, "confidence": 0-1, "probs": [5] }], "ms": <int> }

The server decides what to do with a low confidence (it reports the syllable as
"not judged"); this service only returns the probabilities. Audio never leaves
the machine and nothing is written to disk.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import Backbone, Syllable, ToneMLP, utterance_features  # noqa: E402

HOST = os.getenv("TONE_HOST", "127.0.0.1")
PORT = int(os.getenv("TONE_PORT", "8768"))
WEIGHTS = Path(os.getenv("TONE_WEIGHTS") or Path(__file__).resolve().parent / "weights" / "tone-mlp.pt")
MAX_SECONDS = 40

if not WEIGHTS.exists():
    raise SystemExit(f"Chưa có trọng số bộ chấm thanh: {WEIGHTS}. Chạy tone/train.py trước (xem tone/README.md).")

# The main classifier (speech + pitch features) and, when present beside it, the
# pitch-only classifier: their probabilities are averaged. On the one real
# learner measured so far the pair agreed with the human labeller more often
# than either alone (see tone/README.md). TONE_ENSEMBLE lists the variants.
ENSEMBLE = [v.strip() for v in os.getenv("TONE_ENSEMBLE", "both,pitch").split(",") if v.strip()]


def load_classifier(path: Path):
    payload = torch.load(path, map_location="cpu", weights_only=False)
    config = payload["config"]
    model = ToneMLP(config["in_dim"]).eval()
    model.load_state_dict(payload["state_dict"])
    return {
        "variant": config.get("variant", "both"),
        "model": model,
        "mean": np.asarray(config["mean"], dtype=np.float32),
        "std": np.asarray(config["std"], dtype=np.float32),
        "config": config,
    }


CLASSIFIERS = [load_classifier(WEIGHTS)]
for variant in ENSEMBLE:
    if variant == CLASSIFIERS[0]["variant"]:
        continue
    extra = WEIGHTS.with_name(f"tone-mlp-{variant}.pt")
    if extra.exists():
        CLASSIFIERS.append(load_classifier(extra))
CONFIG = CLASSIFIERS[0]["config"]
BACKBONE = Backbone(CONFIG["backbone"], CONFIG["layer"], os.getenv("TONE_DEVICE") or None)
VARIANT = "+".join(c["variant"] for c in CLASSIFIERS)
LOCK = threading.Lock()
print(f"[tone] {CONFIG['backbone']} layer {CONFIG['layer']} on {BACKBONE.device} · classifier {VARIANT} trained {CONFIG.get('trainedAt')}")


def score(pcm: np.ndarray, segments: list[dict]):
    syllables = [Syllable(float(s["start"]), float(s["end"]), str(s.get("pos", "single"))) for s in segments]
    speech, pitch = utterance_features(BACKBONE, pcm, syllables)
    both = np.concatenate([speech, pitch], axis=1)
    total = None
    with torch.inference_mode():
        for c in CLASSIFIERS:
            x = {"pitch": pitch, "speech": speech}.get(c["variant"], both)
            p = torch.softmax(c["model"](torch.tensor((x - c["mean"]) / c["std"])), 1).numpy()
            total = p if total is None else total + p
    probs = total / len(CLASSIFIERS)
    return [
        {"tone": int(CONFIG["classes"][int(p.argmax())]), "confidence": round(float(p.max()), 4), "probs": [round(float(v), 4) for v in p]}
        for p in probs
    ]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "backbone": CONFIG["backbone"],
                    "layer": CONFIG["layer"],
                    "device": BACKBONE.device,
                    "variant": VARIANT,
                    "trainedAt": CONFIG.get("trainedAt"),
                    "trainSyllables": CONFIG.get("trainSyllables"),
                    "metrics": CONFIG.get("metrics"),
                },
            )
            return
        self._json(404, {"error": "Không tìm thấy endpoint."})

    def do_POST(self):
        if self.path != "/score":
            self._json(404, {"error": "Không tìm thấy endpoint."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8 * 1024 * 1024:
                raise ValueError("Kích thước yêu cầu không hợp lệ")
            data = json.loads(self.rfile.read(length))
            pcm = np.frombuffer(base64.b64decode(data["pcm"]), dtype=np.float32).copy()
            if len(pcm) < 1600 or len(pcm) > MAX_SECONDS * 16000:
                raise ValueError("Âm thanh quá ngắn hoặc quá dài")
            segments = data.get("segments")
            if not isinstance(segments, list) or not segments or len(segments) > 60:
                raise ValueError("Cần danh sách mốc âm tiết (1–60)")
            started = time.time()
            with LOCK:
                result = score(pcm, segments)
            self._json(200, {"syllables": result, "ms": int((time.time() - started) * 1000), "variant": VARIANT})
        except Exception as exc:
            self._json(400, {"error": str(exc)})

    def log_message(self, fmt, *args):
        if os.getenv("TONE_LOG"):
            print(f"[tone] {fmt % args}")


if __name__ == "__main__":
    print(f"[tone] http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
