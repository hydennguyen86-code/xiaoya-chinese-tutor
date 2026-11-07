"""Train the per-syllable tone classifier used by tone_service.py.

  .venv-tone/bin/python tone/train.py \
      --manifests data/tone-train/say/manifest.jsonl data/tone-train/edge/manifest.jsonl \
      --human data/tone-train/human-learner-01.jsonl --out tone/weights

Training rows come from eval/tone-train/make-dataset.mjs (synthetic voices, tones
known from the text). Validation holds out whole voices. The --human file (from
eval/tone-train/segment-recordings.mjs) is a real learner's recordings with human
labels; it is only ever measured, never trained on, and the script prints its
numbers plainly so nobody has to trust the synthetic accuracy. Learners are stored
as human-learner-NN: these labels ship inside the public weights, so a file name
must never reach them.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import (  # noqa: E402
    DEFAULT_BACKBONE,
    DEFAULT_LAYER,
    PITCH_DIM,
    Backbone,
    Syllable,
    ToneMLP,
    class_from_tone,
    load_audio,
    pitch_features,
    pitch_track,
    pool_frames,
    tone_from_class,
)

CLASS_NAMES = ["1", "2", "3", "4", "nhẹ"]


def read_rows(file: str):
    rows = []
    base = Path(file).parent
    with open(file, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            row["path"] = row["file"] if os.path.isabs(row["file"]) else str(base / row["file"])
            rows.append(row)
    return rows


def _pitch_job(args):
    path, syls = args
    try:
        pcm = load_audio(path)
        semis = pitch_track(pcm)
        mean_duration = float(np.mean([max(0.01, s["end"] - s["start"]) for s in syls]))
        return np.stack([pitch_features(semis, Syllable(s["start"], s["end"], s.get("pos", "single")), mean_duration) for s in syls])
    except Exception as exc:  # a broken file must not stop the run
        print(f"[pitch] {path}: {exc}", file=sys.stderr)
        return None


def extract(rows, backbone: Backbone, cache_dir: Path, tag: str, workers: int):
    """Features for every syllable of every row, cached by manifest content."""
    digest = hashlib.sha1(json.dumps([(r["path"], r["syllables"]) for r in rows], ensure_ascii=False).encode()).hexdigest()[:12]
    cache = cache_dir / f"{tag}-{backbone.name.replace('/', '_')}-L{backbone.layer}-{digest}.npz"
    if cache.exists():
        data = np.load(cache, allow_pickle=True)
        return {k: data[k] for k in data.files}
    cache_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    speech, pitch, tone, expected, voice, kind, pos, row_index, syl_index = [], [], [], [], [], [], [], [], []
    jobs = [(r["path"], r["syllables"]) for r in rows]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        pitch_results = pool.map(_pitch_job, jobs, chunksize=8)
        for i, (row, pitch_feats) in enumerate(zip(rows, pitch_results)):
            if pitch_feats is None:
                continue
            try:
                pcm = load_audio(row["path"])
                frames = backbone.frames(pcm)
            except Exception as exc:
                print(f"[speech] {row['path']}: {exc}", file=sys.stderr)
                continue
            for j, s in enumerate(row["syllables"]):
                speech.append(pool_frames(frames, s["start"], s["end"]))
                pitch.append(pitch_feats[j])
                tone.append(int(s["tone"]))
                expected.append(int(s.get("expected", s["tone"])))
                voice.append(row.get("voice", ""))
                kind.append(row.get("kind", ""))
                pos.append(s.get("pos", "single"))
                row_index.append(i)
                syl_index.append(j)
            if (i + 1) % 500 == 0:
                print(f"  {tag}: {i + 1}/{len(rows)} utterances · {time.time() - t0:.0f}s", flush=True)
    data = {
        "speech": np.asarray(speech, dtype=np.float32),
        "pitch": np.asarray(pitch, dtype=np.float32),
        "tone": np.asarray(tone, dtype=np.int64),
        "expected": np.asarray(expected, dtype=np.int64),
        "voice": np.asarray(voice),
        "kind": np.asarray(kind),
        "pos": np.asarray(pos),
        "row": np.asarray(row_index),
        "syl": np.asarray(syl_index),
    }
    np.savez(cache, **data)
    print(f"  {tag}: {len(tone)} syllables from {len(rows)} utterances in {time.time() - t0:.0f}s → {cache.name}")
    return data


def assemble(data, variant: str):
    if variant == "pitch":
        return data["pitch"]
    if variant == "speech":
        return data["speech"]
    return np.concatenate([data["speech"], data["pitch"]], axis=1)


def confusion(truth, pred, size=5):
    m = np.zeros((size, size), dtype=int)
    for t, p in zip(truth, pred):
        m[t, p] += 1
    return m


def print_matrix(m, title):
    print(title)
    print("          " + "".join(f"{'→' + n:>8}" for n in CLASS_NAMES))
    for i, name in enumerate(CLASS_NAMES):
        print(f"  thanh {name:>4}" + "".join(f"{v:>8}" for v in m[i]))


def train_one(x_train, y_train, x_val, y_val, epochs, device, seed=0):
    torch.manual_seed(seed)
    mean = x_train.mean(0)
    std = x_train.std(0) + 1e-5
    xt = torch.tensor((x_train - mean) / std, device=device)
    yt = torch.tensor(y_train, device=device)
    xv = torch.tensor((x_val - mean) / std, device=device)
    yv = torch.tensor(y_val, device=device)
    counts = np.bincount(y_train, minlength=5).astype(np.float32)
    weights = torch.tensor(counts.sum() / (5 * np.maximum(counts, 1)), device=device, dtype=torch.float32)
    model = ToneMLP(x_train.shape[1]).to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(optim, T_max=epochs)
    loss_fn = torch.nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    best = (-1.0, None, 0)
    batch = 512
    for epoch in range(epochs):
        model.train()
        perm = torch.randperm(len(xt), device=device)
        for k in range(0, len(xt), batch):
            idx = perm[k : k + batch]
            optim.zero_grad()
            loss = loss_fn(model(xt[idx]), yt[idx])
            loss.backward()
            optim.step()
        sched.step()
        model.eval()
        with torch.no_grad():
            acc = (model(xv).argmax(1) == yv).float().mean().item() if len(xv) else float("nan")
        if len(xv) == 0 or acc > best[0]:
            best = (acc, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}, epoch)
    model.load_state_dict(best[1])
    model.eval()
    return model, mean, std, best[0], best[2]


def evaluate_human(model, mean, std, x, data, device, title):
    """Agreement with the human labels (0 = labeller unsure is skipped), at several confidence cut-offs."""
    probs = torch.softmax(model(torch.tensor((x - mean) / std, device=device)), 1).detach().cpu().numpy()
    truth_tone = data["tone"]
    keep = truth_tone >= 1
    pred = probs.argmax(1)
    conf = probs.max(1)
    truth = np.array([class_from_tone(int(t)) for t in truth_tone[keep]])
    print_matrix(confusion(truth, pred[keep]), f"{title}: hàng = nhãn người nghe, cột = máy đoán ({keep.sum()} âm tiết)")
    agree = (truth == pred[keep]).mean() if keep.any() else float("nan")
    exp_keep = data["expected"] >= 1
    exp_truth = np.array([class_from_tone(int(t)) for t in data["expected"][exp_keep]])
    agree_expected = (exp_truth == pred[exp_keep]).mean() if exp_keep.any() else float("nan")
    print(f"  khớp nhãn người nghe: {agree:.1%} · khớp thanh từ điển: {agree_expected:.1%}")
    rows = []
    for cut in (0.0, 0.5, 0.6, 0.7, 0.8, 0.9):
        sure = conf[keep] >= cut
        acc = (truth[sure] == pred[keep][sure]).mean() if sure.any() else float("nan")
        rows.append({"cut": cut, "coverage": float(sure.mean()), "agreement": float(acc)})
        print(f"  ngưỡng {cut:.1f}: chấm {sure.mean():.0%} âm tiết, khớp người nghe {acc:.1%}")
    by_kind = {}
    for kind in sorted(set(data["kind"][keep])):
        sel = data["kind"][keep] == kind
        by_kind[kind] = float((truth[sel] == pred[keep][sel]).mean())
    print(f"  theo loại: {by_kind}")
    return {"agreement": float(agree), "agreementWithExpected": float(agree_expected), "thresholds": rows, "byKind": by_kind, "syllables": int(keep.sum())}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifests", nargs="+", required=True)
    parser.add_argument("--human", nargs="*", default=[])
    parser.add_argument("--out", default="tone/weights")
    parser.add_argument("--cache", default="data/tone-train/features")
    parser.add_argument("--backbone", default=DEFAULT_BACKBONE)
    parser.add_argument("--layer", type=int, default=DEFAULT_LAYER)
    parser.add_argument("--holdout-voices", default="Grandpa (Chinese (China mainland)),zh-CN-YunxiNeural")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--variant", default="both", choices=["both", "pitch", "speech", "all"])
    parser.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4) - 2))
    parser.add_argument("--device", default=None)
    parser.add_argument("--max-rows", type=int, default=0, help="for quick runs")
    args = parser.parse_args()

    backbone = Backbone(args.backbone, args.layer, args.device)
    print(f"backbone {backbone.name} layer {backbone.layer} on {backbone.device}")
    cache_dir = Path(args.cache)
    train_sets = []
    for file in args.manifests:
        rows = read_rows(file)
        if args.max_rows:
            rows = rows[: args.max_rows]
        print(f"{file}: {len(rows)} utterances")
        train_sets.append(extract(rows, backbone, cache_dir, Path(file).parent.name or "train", args.workers))
    data = {k: np.concatenate([d[k] for d in train_sets]) for k in train_sets[0]}
    human_sets = [(file, extract(read_rows(file), backbone, cache_dir, Path(file).stem, args.workers)) for file in args.human]

    labels = np.array([class_from_tone(int(t)) for t in data["tone"]])
    holdout = {v.strip() for v in args.holdout_voices.split(",") if v.strip()}
    val_mask = np.isin(data["voice"], list(holdout))
    print(f"train {int((~val_mask).sum())} syllables · validation (giọng giữ lại {sorted(holdout)}) {int(val_mask.sum())} syllables")
    print("class counts (train):", dict(zip(CLASS_NAMES, np.bincount(labels[~val_mask], minlength=5).tolist())))

    device = "cpu"  # the MLP is tiny; CPU training is fast and deterministic
    variants = ["pitch", "speech", "both"] if args.variant == "all" else [args.variant]
    results = {}
    for variant in variants:
        x = assemble(data, variant)
        model, mean, std, val_acc, best_epoch = train_one(x[~val_mask], labels[~val_mask], x[val_mask], labels[val_mask], args.epochs, device)
        print(f"\n== biến thể {variant}: dim {x.shape[1]} · giọng giữ lại {val_acc:.1%} (epoch {best_epoch + 1}) ==")
        with torch.no_grad():
            pred_val = model(torch.tensor((x[val_mask] - mean) / std)).argmax(1).numpy()
        print_matrix(confusion(labels[val_mask], pred_val), "  giọng máy giữ lại: hàng = thanh thật, cột = máy đoán")
        human_metrics = {}
        for index, (_, hdata) in enumerate(human_sets, 1):
            label = f"human-learner-{index:02d}"
            human_metrics[label] = evaluate_human(model, mean, std, assemble(hdata, variant), hdata, device, f"  {label}")
        results[variant] = {"valAccuracy": float(val_acc), "human": human_metrics, "dim": int(x.shape[1])}
        # the final weights are trained on every voice, with the epoch count the hold-out run chose
        final, fmean, fstd, _, _ = train_one(x, labels, x[:0], labels[:0], best_epoch + 1, device)
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        payload = {
            "state_dict": final.state_dict(),
            "config": {
                "variant": variant,
                "backbone": backbone.name,
                "layer": backbone.layer,
                "in_dim": int(x.shape[1]),
                "pitch_dim": PITCH_DIM,
                "mean": fmean.tolist(),
                "std": fstd.tolist(),
                "classes": [tone_from_class(i) for i in range(5)],
                "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "trainSyllables": int(len(labels)),
                "trainVoices": sorted(set(data["voice"].tolist())),
                "metrics": results[variant],
            },
        }
        name = "tone-mlp.pt" if variant == "both" else f"tone-mlp-{variant}.pt"
        torch.save(payload, out / name)
        print(f"  saved {out / name}")
    with open(Path(args.out) / "metrics.json", "w", encoding="utf-8") as handle:
        json.dump({"backbone": backbone.name, "layer": backbone.layer, "results": results, "holdoutVoices": sorted(holdout)}, handle, ensure_ascii=False, indent=2)
    print(f"\nmetrics → {Path(args.out) / 'metrics.json'}")


if __name__ == "__main__":
    main()
