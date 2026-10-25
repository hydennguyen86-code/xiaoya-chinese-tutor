import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createHash } from 'node:crypto';
import { TONE_ITEMS } from '../eval/toneItems.mjs';
import { expectedTones, analyseTones } from './tones.mjs';

// self: the learner on their own recording; peer: another learner listening;
// expert: a teacher or native speaker. Never inferred, always chosen by the labeler.
export const TONE_LABEL_SOURCES = ['self', 'peer', 'expert'];

export function validateToneLabel(value, count, maxTone = 4) {
  return Boolean(
    value &&
    TONE_LABEL_SOURCES.includes(value.source) &&
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
  const safeRoot = (dir) => {
    if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('Invalid dataset symlink.');
  };
  app.delete('/api/tone-evaluation/:learner', (req, res) => {
    try {
      const { dir } = locate(req);
      safeRoot(dir);
      if (req.body?.confirm !== req.params.learner) throw new Error('Confirm the learner before deleting.');
      fs.rmSync(dir, { recursive: true, force: true });
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get('/api/tone-evaluation/:learner/export', async (req, res) => {
    try {
      const { dir } = locate(req);
      safeRoot(dir);
      const zip = new JSZip();
      const entries = manifest(dir).recordings.filter((r) => TONE_ITEMS.some((i) => i.id === r.id && i.text === r.text));
      const addFile = (relative) => {
        const file = path.join(dir, relative);
        if (!fs.existsSync(file)) return;
        const resolved = fs.realpathSync(file),
          rootPath = fs.realpathSync(dir);
        if (!resolved.startsWith(rootPath + path.sep) || !fs.lstatSync(file).isFile()) throw new Error('Invalid export file.');
        zip.file(relative, fs.readFileSync(file));
      };
      zip.file(
        'manifest.json',
        JSON.stringify(
          {
            version: 1,
            recordings: entries.map((r) => ({
              id: r.id,
              text: r.text,
              kind: r.kind,
              file: `${r.id}.audio`,
              mime: r.mime,
              recordedAt: r.recordedAt,
              label: r.label,
            })),
          },
          null,
          2,
        ),
      );
      for (const r of entries) addFile(`${r.id}.audio`);
      const folder = path.join(dir, 'feedback');
      if (fs.existsSync(folder)) {
        if (fs.lstatSync(folder).isSymbolicLink()) throw new Error('Invalid feedback symlink.');
        for (const file of fs.readdirSync(folder))
          if (/^(?:[a-f0-9]{32}|[a-f0-9-]{36})\.(?:json|audio)$/.test(file)) addFile(`feedback/${file}`);
      }
      res
        .set('Cache-Control', 'no-store')
        .set('Content-Disposition', 'attachment; filename="misu-tone-labels-private.zip"')
        .type('application/zip')
        .send(await zip.generateAsync({ type: 'nodebuffer' }));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
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
  app.post('/api/tone-feedback/:learner', async (req, res) => {
    try {
      const { dir } = locate(req);
      const { text, label, audioBase64, mime, itemId: requestedItem } = req.body ?? {};
      const chars = typeof text === 'string' ? [...text].filter((c) => /\p{Script=Han}/u.test(c)) : [];
      if (!chars.length || chars.length > 100 || !validateToneLabel(label, chars.length, 5))
        throw new Error('Cần người gắn nhãn và thanh 0–5 cho từng chữ (0: không rõ; 5: thanh nhẹ).');
      if (typeof audioBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64) || !/^audio\/[\w.+-]+$/.test(mime))
        throw new Error('Cần bản ghi âm để đối chiếu nhãn.');
      const audio = Buffer.from(audioBase64, 'base64');
      if (audio.length < 1000 || audio.length > 3 * 1024 * 1024) throw new Error('Bản ghi phải từ 1 KB đến 3 MB.');
      const normalized = chars.join('');
      const digest = (value) => createHash('sha256').update(value).digest('hex');
      const item = TONE_ITEMS.find((i) => i.text === normalized);
      const itemId = item?.id ?? `practice:${digest(normalized).slice(0, 24)}`;
      if (requestedItem && requestedItem !== itemId && requestedItem !== `text:${normalized}`)
        throw new Error('Mục phản hồi không khớp chữ.');
      const recordingId = digest(audio);
      const report = await analyseTones(audio, normalized);
      const id = digest(`${itemId}|${label.reviewedBy.trim().normalize('NFC').toLowerCase()}`).slice(0, 32),
        folder = path.join(dir, 'feedback');
      fs.mkdirSync(folder, { recursive: true });
      const entry = {
        version: 1,
        id,
        itemId,
        recordingId,
        roleVerification: 'self-declared; not verified',
        text: chars.join(''),
        file: `${id}.audio`,
        mime,
        label: { source: label.source, reviewedBy: label.reviewedBy.trim(), tones: label.tones, reviewedAt: new Date().toISOString() },
        machine: report.syllables.map((s) => ({ char: s.char, expected: s.expected, heard: s.heard })),
        machineSource: 'server; no saved speaker calibration',
        kind: 'feedback',
        recordedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(folder, `${id}.audio.tmp`), audio);
      fs.renameSync(path.join(folder, `${id}.audio.tmp`), path.join(folder, entry.file));
      fs.writeFileSync(path.join(folder, `${id}.json.tmp`), JSON.stringify(entry, null, 2));
      fs.renameSync(path.join(folder, `${id}.json.tmp`), path.join(folder, `${id}.json`));
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
