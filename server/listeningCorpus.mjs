import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const MAX_BYTES = 2_000_000;
const validId = (id) => /^[a-f0-9]{24}$/.test(id);
function safeFile(root, name) {
  const file = path.join(root, name);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES || stat.size < 1) throw Error('Invalid clip');
  if (path.dirname(fs.realpathSync(file)) !== fs.realpathSync(root)) throw Error('Invalid clip path');
  return file;
}
// Read only validated.tsv from an official, already downloaded zh-CN release.
// Speaker IDs, demographic fields and original file paths never enter the manifest.
export async function importCommonVoice({ source, dataDir, version, sourceUrl, limit = 50 }) {
  if (!/^https:\/\/mozilladatacollective\.com\/datasets\/[a-zA-Z0-9-]+$/.test(sourceUrl || ''))
    throw Error('Use the official dataset page URL');
  if (!/^[\w.-]{1,60}$/.test(version || '')) throw Error('Specify dataset version');
  const count = Math.min(200, Math.max(1, Number(limit) || 50));
  const root = path.join(dataDir, 'listening-corpus');
  fs.mkdirSync(root, { recursive: true });
  if (fs.lstatSync(root).isSymbolicLink()) throw Error('Corpus folder must not be a symlink');
  const entries = [];
  const seen = new Set();
  const lines = readline.createInterface({ input: fs.createReadStream(path.join(source, 'validated.tsv')), crlfDelay: Infinity });
  let columns;
  try {
    for await (const line of lines) {
      const cells = line.replace(/^\uFEFF/, '').split('\t');
      if (!columns) {
        columns = cells;
        if (!['path', 'sentence', 'locale', 'up_votes', 'down_votes'].every((name) => columns.includes(name)))
          throw Error('Unsupported validated.tsv columns');
        continue;
      }
      const get = (key) => cells[columns.indexOf(key)] || '';
      const text = get('sentence').trim();
      const clip = get('path');
      if (get('locale') !== 'zh-CN' || !/^[\p{Script=Han}\s，。！？、；：“”‘’《》…,.!?]+$/u.test(text)) continue;
      const chars = [...text.matchAll(/\p{Script=Han}/gu)].length;
      const up = Number(get('up_votes')),
        down = Number(get('down_votes'));
      if (chars < 2 || chars > 40 || seen.has(text) || !Number.isFinite(up) || !Number.isFinite(down) || up < 2 || down !== 0) continue;
      if (!/^[\w-]+\.mp3$/.test(clip)) continue;
      let file;
      try {
        file = safeFile(path.join(source, 'clips'), clip);
      } catch {
        continue;
      }
      const bytes = fs.readFileSync(file);
      const id = crypto.createHash('sha256').update(bytes).update(text).digest('hex').slice(0, 24);
      const target = path.join(root, `${id}.mp3`);
      if (fs.existsSync(target)) safeFile(root, `${id}.mp3`);
      else fs.writeFileSync(target, bytes, { flag: 'wx' });
      entries.push({ id, text, version, sourceUrl, license: 'CC0-1.0', locale: 'zh-CN' });
      seen.add(text);
      if (entries.length >= count) break;
    }
  } finally {
    lines.close();
  }
  if (!entries.length) throw Error('No eligible clips found; existing catalog was kept');
  const tmp = path.join(root, `manifest-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2));
  fs.renameSync(tmp, path.join(root, 'manifest.json'));
  return entries.length;
}
export function corpusStore(dataDir) {
  const root = path.join(dataDir, 'listening-corpus');
  function list() {
    try {
      if (fs.lstatSync(root).isSymbolicLink()) return [];
      const manifest = safeFile(root, 'manifest.json');
      const { entries } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      return (Array.isArray(entries) ? entries : [])
        .slice(0, 200)
        .filter(
          (e) => validId(e.id) && typeof e.text === 'string' && e.text.length <= 160 && e.license === 'CC0-1.0' && e.locale === 'zh-CN',
        )
        .map(({ id, text, version, sourceUrl, license }) => ({ id, text, version, sourceUrl, license }));
    } catch {
      return [];
    }
  }
  return {
    list,
    audio(id) {
      if (!validId(id) || !list().some((e) => e.id === id)) return null;
      try {
        return safeFile(root, `${id}.mp3`);
      } catch {
        return null;
      }
    },
  };
}
export function mountListeningCorpus(app, dataDir) {
  const store = corpusStore(dataDir);
  app.get('/api/listening-corpus', (_req, res) => res.set('Cache-Control', 'no-store').json({ entries: store.list() }));
  app.get('/api/listening-corpus/:id/audio', (req, res) => {
    const file = store.audio(req.params.id);
    if (!file) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store').type('audio/mpeg').sendFile(file);
  });
}
