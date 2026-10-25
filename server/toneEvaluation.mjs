import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { TONE_ITEMS } from '../eval/toneItems.mjs';
import { expectedTones } from './tones.mjs';

export function validateToneLabel(value, count, maxTone = 4) {
  return Boolean(
    value &&
    ['self', 'expert'].includes(value.source) &&
    typeof value.reviewedBy === 'string' &&
    value.reviewedBy.trim().length > 0 &&
    value.reviewedBy.length <= 100 &&
    Array.isArray(value.tones) &&
    value.tones.length === count &&
    value.tones.every((tone) => Number.isInteger(tone) && tone >= 0 && tone <= maxTone),
  );
}
export function mountToneEvaluation(app, dataDir) {
  const root = path.join(dataDir, 'eval-recordings');
  const locate = (req) => {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(req.params.learner)) throw new Error('Mã người học không hợp lệ.');
    const item = TONE_ITEMS.find((entry) => entry.id === req.params.item);
    if (req.params.item && !item) throw new Error('Mục ghi âm không hợp lệ.');
    return { dir: path.join(root, req.params.learner), item };
  };
  const manifest = (dir) =>
    fs.existsSync(path.join(dir, 'manifest.json'))
      ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
      : { version: 1, recordings: [] };
  const save = (dir, data) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json.tmp'), JSON.stringify(data, null, 2));
    fs.renameSync(path.join(dir, 'manifest.json.tmp'), path.join(dir, 'manifest.json'));
  };
  app.get('/api/tone-feedback/:learner', (req, res) => {
    try {
      const { dir } = locate(req);
      const data = manifest(dir);
      const feedbackDir = path.join(dir, 'feedback');
      const feedback = fs.existsSync(feedbackDir) ? fs.readdirSync(feedbackDir).filter((f) => f.endsWith('.json')).length : 0;
      res.json({ labeled: data.recordings.filter((r) => r.label).length, feedback });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post('/api/tone-feedback/:learner', (req, res) => {
    try {
      const { dir } = locate(req);
      const { text, label, audioBase64, mime, machine } = req.body ?? {};
      const chars = typeof text === 'string' ? [...text].filter((c) => /\p{Script=Han}/u.test(c)) : [];
      if (!chars.length || chars.length > 100 || !validateToneLabel(label, chars.length, 5))
        throw new Error('Cần người gắn nhãn và thanh 0–5 cho từng chữ (0: không rõ; 5: thanh nhẹ).');
      if (typeof audioBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64) || !/^audio\/[\w.+-]+$/.test(mime))
        throw new Error('Cần bản ghi âm để đối chiếu nhãn.');
      const audio = Buffer.from(audioBase64, 'base64');
      if (audio.length < 1000 || audio.length > 3 * 1024 * 1024) throw new Error('Bản ghi phải từ 1 KB đến 3 MB.');
      const id = randomUUID(),
        folder = path.join(dir, 'feedback');
      fs.mkdirSync(folder, { recursive: true });
      const entry = {
        version: 1,
        id,
        text: chars.join(''),
        file: `${id}.audio`,
        mime,
        label: { source: label.source, reviewedBy: label.reviewedBy.trim(), tones: label.tones, reviewedAt: new Date().toISOString() },
        machine: Array.isArray(machine)
          ? machine.slice(0, chars.length).map((s) => ({
              expected: Number.isInteger(s.expected) ? s.expected : null,
              heard: Number.isInteger(s.heard) ? s.heard : null,
            }))
          : [],
        kind: 'feedback',
        recordedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(folder, entry.file), audio, { flag: 'wx' });
      fs.writeFileSync(path.join(folder, `${id}.json`), JSON.stringify(entry, null, 2), { flag: 'wx' });
      res.json({ ok: true, id });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get('/api/tone-evaluation/:learner', (req, res) => {
    try {
      const { dir } = locate(req);
      res.json({
        items: TONE_ITEMS.map((item) => ({ ...item, expected: expectedTones(item.text).map((s) => s.expected) })),
        recordings: manifest(dir).recordings,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post('/api/tone-evaluation/:learner/:item', express.raw({ type: 'audio/*', limit: '5mb' }), (req, res) => {
    try {
      const { dir, item } = locate(req);
      if (!Buffer.isBuffer(req.body) || req.body.length < 1000) throw new Error('Cần bản ghi âm hợp lệ.');
      const data = manifest(dir);
      fs.mkdirSync(dir, { recursive: true });
      const file = `${item.id}.audio`;
      fs.writeFileSync(path.join(dir, file), req.body);
      const recording = {
        id: item.id,
        text: item.text,
        kind: item.kind,
        file,
        mime: String(req.headers['content-type']),
        recordedAt: new Date().toISOString(),
        label: null,
      };
      data.recordings = [...data.recordings.filter((r) => r.id !== item.id), recording];
      save(dir, data);
      res.json(recording);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get('/api/tone-evaluation/:learner/:item/audio', (req, res) => {
    try {
      const { dir, item } = locate(req);
      const entry = manifest(dir).recordings.find((r) => r.id === item.id);
      if (!entry) return res.sendStatus(404);
      res
        .set('Cache-Control', 'no-store')
        .type(entry.mime)
        .sendFile(path.join(dir, `${item.id}.audio`));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.put('/api/tone-evaluation/:learner/:item/label', (req, res) => {
    try {
      const { dir, item } = locate(req);
      if (!validateToneLabel(req.body, expectedTones(item.text).length))
        throw new Error('Cần người gắn nhãn, nguồn nhãn và từng thanh 0–4.');
      const data = manifest(dir);
      const recording = data.recordings.find((r) => r.id === item.id);
      if (!recording) throw new Error('Hãy ghi âm trước khi gắn nhãn.');
      recording.label = {
        source: req.body.source,
        reviewedBy: req.body.reviewedBy.trim(),
        tones: req.body.tones,
        reviewedAt: new Date().toISOString(),
      };
      save(dir, data);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
}
