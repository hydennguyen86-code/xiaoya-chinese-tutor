import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { ownerRequest } from './lanAccess.mjs';
import { loadCurated } from './curatedListening.mjs';

const MAX_BYTES = 2_000_000;
const validId = (id) => /^[a-f0-9]{24}$/.test(id);
function safeFile(root, name) {
  const file = path.join(root, name);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES || stat.size < 1) throw Error('Invalid clip');
  if (path.dirname(fs.realpathSync(file)) !== fs.realpathSync(root)) throw Error('Invalid clip path');
  return file;
}
// Catalog only: never copy or modify source audio. Runtime source is explicitly configured.
const sourceKey = (source) => crypto.createHash('sha256').update(fs.realpathSync(source)).digest('hex');
export async function importCommonVoice({ source, dataDir, version, sourceUrl, limit = 200, curated = loadCurated() }) {
  if (sourceUrl && !/^https:\/\/mozilladatacollective\.com\/datasets\/[a-zA-Z0-9-]+$/.test(sourceUrl))
    throw Error('Use the official dataset page URL');
  if (!/^[\w.-]{1,60}$/.test(version || '')) throw Error('Specify dataset version');
  const curatedById = new Map(curated.map((e) => [e.sentence_id, e]));
  const matched = new Set();
  const count = Math.min(200, Math.max(1, Number(limit) || 200));
  source = fs.realpathSync(source);
  const root = path.join(dataDir, 'listening-corpus');
  fs.mkdirSync(root, { recursive: true });
  if (fs.lstatSync(root).isSymbolicLink()) throw Error('Corpus folder must not be a symlink');
  const splits = fs.existsSync(path.join(source, 'validated.tsv')) ? ['validated.tsv'] : ['train.tsv', 'dev.tsv', 'test.tsv'];
  const entries = [],
    seen = new Set();
  const stats = { rows: 0, qualityRejected: 0, difficultyRejected: 0, fileRejected: 0, duplicate: 0, eligible: 0 };
  for (const split of splits) {
    const lines = readline.createInterface({ input: fs.createReadStream(path.join(source, split)), crlfDelay: Infinity });
    let columns;
    try {
      for await (const line of lines) {
        const cells = line.replace(/^\uFEFF/, '').split('\t');
        if (!columns) {
          columns = cells;
          if (!['sentence_id', 'path', 'sentence', 'up_votes', 'down_votes'].every((name) => columns.includes(name)))
            throw Error('Unsupported TSV columns');
          continue;
        }
        stats.rows++;
        const get = (key) => cells[columns.indexOf(key)] || '';
        const text = get('sentence').trim(),
          clip = get('path');
        const up = Number(get('up_votes')),
          down = Number(get('down_votes'));
        if (
          (columns.includes('locale') && !['zh-CN', 'zh-CN-beijing'].includes(get('locale'))) ||
          !Number.isFinite(up) ||
          !Number.isFinite(down) ||
          up < 2 ||
          down !== 0
        ) {
          stats.qualityRejected++;
          continue;
        }
        const difficulty = curatedById.get(get('sentence_id'));
        if (!difficulty) {
          stats.difficultyRejected++;
          continue;
        }
        if (seen.has(text)) {
          stats.duplicate++;
          continue;
        }
        if (!/^[\w-]+\.mp3$/.test(clip)) {
          stats.fileRejected++;
          continue;
        }
        try {
          safeFile(path.join(source, 'clips'), clip);
        } catch {
          stats.fileRejected++;
          continue;
        }
        const id = crypto.createHash('sha256').update(version).update(clip).update(text).digest('hex').slice(0, 24);
        entries.push({
          id,
          clip,
          text,
          version,
          ...(sourceUrl ? { sourceUrl } : {}),
          license: 'CC0-1.0',
          locale: 'zh-CN',
          curationSource: 'AI soạn, chưa duyệt',
          ...difficulty,
        });
        matched.add(difficulty.sentence_id);
        seen.add(text);
        stats.eligible++;
      }
    } finally {
      lines.close();
    }
  }
  entries.sort((a, b) => a.level.localeCompare(b.level) || a.text.length - b.text.length || a.id.localeCompare(b.id));
  if (matched.size !== curatedById.size)
    throw Error(`Curated sentences missing/invalid in source: ${curatedById.size - matched.size}; existing catalog kept`);
  if (!entries.length) throw Error('No eligible clips found; existing catalog was kept');
  const tmp = path.join(root, `manifest-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ schema: 3, sourceKey: sourceKey(source), entries: entries.slice(0, count) }, null, 2));
  fs.renameSync(tmp, path.join(root, 'manifest.json'));
  return { ...stats, selected: Math.min(count, entries.length) };
}
export function corpusStore(dataDir, source = process.env.XIAOYA_COMMON_VOICE_DIR, curated = loadCurated()) {
  const root = path.join(dataDir, 'listening-corpus');
  const curatedById = new Map(curated.map((e) => [e.sentence_id, e]));
  function entries() {
    try {
      if (!source || fs.lstatSync(root).isSymbolicLink()) return [];
      const manifest = JSON.parse(fs.readFileSync(safeFile(root, 'manifest.json'), 'utf8'));
      if (manifest.schema !== 3 || manifest.sourceKey !== sourceKey(source)) return [];
      return (Array.isArray(manifest.entries) ? manifest.entries : [])
        .slice(0, 200)
        .filter(
          (e) =>
            validId(e.id) &&
            typeof e.text === 'string' &&
            e.text.length <= 160 &&
            /^[\w-]+\.mp3$/.test(e.clip) &&
            e.license === 'CC0-1.0' &&
            e.locale === 'zh-CN' &&
            curatedById.has(e.sentence_id),
        );
    } catch {
      return [];
    }
  }
  return {
    list() {
      return entries().map(({ id, text, version, license, sentence_id }) => ({
        id,
        text,
        version,
        license,
        curationSource: 'AI soạn, chưa duyệt',
        ...curatedById.get(sentence_id),
      }));
    },
    audio(id) {
      if (!validId(id)) return null;
      const entry = entries().find((e) => e.id === id);
      if (!entry) return null;
      try {
        return safeFile(path.join(fs.realpathSync(source), 'clips'), entry.clip);
      } catch {
        return null;
      }
    },
  };
}
export function mountListeningCorpus(app, dataDir, source = process.env.XIAOYA_COMMON_VOICE_DIR, curated = loadCurated()) {
  const store = corpusStore(dataDir, source, curated);
  // Dataset access is local to its owner; do not redistribute to LAN clients.
  app.use('/api/listening-corpus', (req, res, next) => (ownerRequest(req) ? next() : res.sendStatus(403)));
  app.get('/api/listening-corpus', (_req, res) => res.set('Cache-Control', 'no-store').json({ entries: store.list() }));
  app.get('/api/listening-corpus/:id/audio', (req, res) => {
    const file = store.audio(req.params.id);
    if (!file) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store').type('audio/mpeg').sendFile(file);
  });
}
