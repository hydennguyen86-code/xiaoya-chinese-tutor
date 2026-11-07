"""Shared feature extraction for the tone classifier (train.py and tone_service.py).

Two views of every syllable:
  * speech-model view: frame vectors of a Mandarin-pretrained wav2vec2
    (TencentGameMate/chinese-wav2vec2-base, WenetSpeech, MIT) taken from one
    intermediate layer, mean- and std-pooled over the syllable's frames. The
    whole utterance goes through the model, so the pooled frames carry context.
  * pitch view: a pYIN pitch track in semitones relative to the utterance's
    median, resampled to a fixed-length contour plus shape numbers (slope,
    curvature, range, where the minimum sits, how much of it is voiced).
The classifier in train.py is a small MLP over the concatenation.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass

import numpy as np
import torch

SR = 16000
HOP = 160  # 10 ms pitch frames
CONTOUR_POINTS = 16
POSITIONS = ("single", "first", "mid", "last")
DEFAULT_BACKBONE = "TencentGameMate/chinese-wav2vec2-base"
DEFAULT_LAYER = 8
PITCH_DIM = CONTOUR_POINTS + 14 + len(POSITIONS)


def load_audio(path: str) -> np.ndarray:
    """Any file ffmpeg can read -> float32 mono 16 kHz."""
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def pick_device(prefer: str | None = None) -> str:
    if prefer:
        return prefer
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class Backbone:
    def __init__(self, name: str = DEFAULT_BACKBONE, layer: int = DEFAULT_LAYER, device: str | None = None):
        from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2Model

        self.name = name
        self.layer = layer
        self.device = pick_device(device)
        self.extractor = Wav2Vec2FeatureExtractor.from_pretrained(name)
        self.model = Wav2Vec2Model.from_pretrained(name).to(self.device).eval()
        self.dim = self.model.config.hidden_size

    @torch.inference_mode()
    def frames(self, pcm: np.ndarray) -> np.ndarray:
        """(T, dim) frame vectors; frame i is centred near (i * 320 + 200) / 16000 s."""
        if len(pcm) < 4000:
            pcm = np.pad(pcm, (0, 4000 - len(pcm)))
        inputs = self.extractor(pcm, sampling_rate=SR, return_tensors="pt").to(self.device)
        out = self.model(**inputs, output_hidden_states=True)
        return out.hidden_states[self.layer][0].float().cpu().numpy()


def frame_time(i: int) -> float:
    return (i * 320 + 200) / SR


def pool_frames(frames: np.ndarray, start: float, end: float) -> np.ndarray:
    times = np.array([frame_time(i) for i in range(len(frames))])
    mask = (times >= start) & (times < end)
    if not mask.any():
        idx = int(np.argmin(np.abs(times - (start + end) / 2)))
        mask[idx] = True
    part = frames[mask]
    return np.concatenate([part.mean(0), part.std(0) if len(part) > 1 else np.zeros(frames.shape[1], dtype=np.float32)])


def pitch_track(pcm: np.ndarray) -> np.ndarray:
    """Semitones relative to the voiced median, NaN where unvoiced; one value per 10 ms."""
    import librosa

    f0, voiced, _ = librosa.pyin(pcm, fmin=60, fmax=600, sr=SR, frame_length=1024, hop_length=HOP, fill_na=np.nan)
    f0 = np.where(voiced, f0, np.nan)
    good = f0[~np.isnan(f0)]
    if len(good) < 3:
        return np.full(len(f0), np.nan)
    median = np.median(good)
    return 12 * np.log2(f0 / median)


@dataclass
class Syllable:
    start: float
    end: float
    pos: str = "single"


def pitch_features(semis: np.ndarray, syl: Syllable, mean_duration: float) -> np.ndarray:
    a = max(0, int(round(syl.start / (HOP / SR))))
    b = min(len(semis), int(round(syl.end / (HOP / SR))))
    seg = semis[a:b] if b > a else np.array([])
    voiced_idx = np.where(~np.isnan(seg))[0]
    contour = np.zeros(CONTOUR_POINTS, dtype=np.float32)
    shape = np.zeros(14, dtype=np.float32)
    duration = max(0.0, syl.end - syl.start)
    if len(voiced_idx) >= 3:
        vals = seg[voiced_idx]
        span = np.linspace(voiced_idx[0], voiced_idx[-1], CONTOUR_POINTS)
        contour = np.interp(span, voiced_idx, vals).astype(np.float32)
        x = np.linspace(-1, 1, len(vals))
        slope = np.polyfit(x, vals, 1)[0]
        quad = np.polyfit(x, vals, 2)[0] if len(vals) >= 4 else 0.0
        k = max(1, len(vals) // 5)
        start_v, end_v = vals[:k].mean(), vals[-k:].mean()
        min_i = int(np.argmin(vals))
        shape = np.array(
            [
                start_v,
                end_v,
                vals.min(),
                vals.max(),
                vals.mean(),
                vals.max() - vals.min(),
                slope,
                quad,
                min_i / max(1, len(vals) - 1),
                end_v - vals.min(),  # rise after the minimum
                start_v - vals.min(),  # fall before the minimum
                len(voiced_idx) / max(1, len(seg)),  # voiced ratio
                duration,
                duration / mean_duration if mean_duration > 0 else 1.0,
            ],
            dtype=np.float32,
        )
    else:
        shape[11] = len(voiced_idx) / max(1, len(seg)) if len(seg) else 0.0
        shape[12] = duration
        shape[13] = duration / mean_duration if mean_duration > 0 else 1.0
    pos = np.zeros(len(POSITIONS), dtype=np.float32)
    pos[POSITIONS.index(syl.pos if syl.pos in POSITIONS else "single")] = 1.0
    voiced_flag = np.array([1.0 if len(voiced_idx) >= 3 else 0.0], dtype=np.float32)
    return np.concatenate([contour, shape, pos, voiced_flag])


PITCH_DIM = CONTOUR_POINTS + 14 + len(POSITIONS) + 1


def utterance_features(backbone: Backbone, pcm: np.ndarray, syllables: list[Syllable]) -> tuple[np.ndarray, np.ndarray]:
    """Returns (speech features (n, 2*dim), pitch features (n, PITCH_DIM)) for the syllables of one utterance."""
    frames = backbone.frames(pcm)
    semis = pitch_track(pcm)
    mean_duration = float(np.mean([max(0.01, s.end - s.start) for s in syllables])) if syllables else 0.0
    speech = np.stack([pool_frames(frames, s.start, s.end) for s in syllables]) if syllables else np.zeros((0, 2 * frames.shape[1]))
    pitch = np.stack([pitch_features(semis, s, mean_duration) for s in syllables]) if syllables else np.zeros((0, PITCH_DIM))
    return speech.astype(np.float32), pitch.astype(np.float32)


class ToneMLP(torch.nn.Module):
    """Small classifier over [speech | pitch] features. Classes 0..4 = tones 1,2,3,4 and neutral."""

    def __init__(self, in_dim: int, hidden: int = 256, hidden2: int = 64, classes: int = 5, dropout: float = 0.25):
        super().__init__()
        self.norm = torch.nn.LayerNorm(in_dim)
        self.net = torch.nn.Sequential(
            torch.nn.Linear(in_dim, hidden),
            torch.nn.GELU(),
            torch.nn.Dropout(dropout),
            torch.nn.Linear(hidden, hidden2),
            torch.nn.GELU(),
            torch.nn.Dropout(dropout / 2),
            torch.nn.Linear(hidden2, classes),
        )

    def forward(self, x):
        return self.net(self.norm(x))


def tone_from_class(index: int) -> int:
    return [1, 2, 3, 4, 5][index]


def class_from_tone(tone: int) -> int:
    return {1: 0, 2: 1, 3: 2, 4: 3, 5: 4}[tone]
