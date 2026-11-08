// So sánh các backend nhận giọng (whisper.cpp, sherpa-onnx) trên cùng một bộ ghi âm:
//   npm run eval:stt -- [thư-mục] [--synth=N] [--backends=whisper,sherpa] [--no-save]
// Mặc định đọc data/eval-recordings/ (không nằm trong repo). Thư mục chứa các file
// .wav/.m4a/.webm cùng một trong hai cách khai báo câu mẫu:
//   manifest.json  { "version": 1, "items": [{ "file": "a.wav", "text": "我今天很忙。" }] }
//   items.json     [{ "file", "text" }] hoặc { "a.wav": "我今天很忙。" }
// Không có cả hai thì lấy tên file làm câu mẫu nếu tên có chữ Hán (我今天很忙.wav).
// --synth=N sinh thêm N câu từ lessons/listening bằng giọng Edge TTS (cần mạng): bộ "trần",
// máy nhận phải đúng gần 100 %, thấp hơn nghĩa là lỗi nằm ở backend chứ không ở người đọc.
// Mỗi backend được đo: CER chữ Hán, độ đúng âm tiết theo pinyin (scoreReading), thời gian.
// Không ghi file âm thanh nào vào repo. Không có backend nào thì báo rõ và thoát mã 1.
import fs from 'node:fs';
import path from 'node:path';
import { saveResult } from './record.mjs';
import { TONE_ITEMS } from './toneItems.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || 'data/eval-recordings');
const synthCount = Number(flag('synth') || 0);
const wanted = (flag('backends') || 'whisper,sherpa').split(',').map((s) => s.trim());
const save = !args.includes('--no-save');
const HAN = /\p{Script=Han}/gu;
const hanOnly = (s) => (String(s || '').match(HAN) || []).join('');

// Tỉ lệ sai chữ: khoảng cách sửa (Levenshtein) trên chuỗi chữ Hán / độ dài câu mẫu.
function cer(target, heard) {
  const a = [...hanOnly(target)];
  const b = [...hanOnly(heard)];
  if (!a.length) return b.length ? 1 : 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length] / a.length;
}

async function tryImport(file) {
  try {
    return await import(file);
  } catch (error) {
    console.warn(`  (không nạp được ${file.split('/').slice(-2).join('/')}: ${error.message.split('\n')[0]})`);
    return null;
  }
}

// whisper đi qua server/stt.mjs (ép STT_BACKEND=whisper); sherpa gọi thẳng server/sttSherpa.mjs,
// để hai backend chạy được cạnh nhau trong cùng một lần đo.
async function loadBackends() {
  const found = [];
  if (wanted.includes('whisper')) {
    process.env.STT_BACKEND = 'whisper';
    const stt = await tryImport('../server/stt.mjs');
    try {
      if (stt) {
        await stt.startStt();
        if (stt.sttReady()) {
          found.push({ name: 'whisper', transcribe: (pcm) => stt.transcribePcm(pcm), stop: () => stt.stopStt() });
        } else console.warn('  whisper: chưa sẵn sàng (chạy npm run setup:whisper)');
      }
    } catch (error) {
      console.warn(`  whisper: lỗi khi khởi động: ${error.message}`);
    }
  }
  if (wanted.includes('sherpa')) {
    const sherpa = await tryImport('../server/sttSherpa.mjs');
    try {
      if (sherpa?.sherpaConfigured()) {
        await sherpa.startSherpa();
        if (sherpa.sherpaReady()) {
          found.push({
            name: 'sherpa',
            transcribe: async (pcm) => (await sherpa.transcribeSherpaPcm(pcm))?.text ?? '',
            stop: () => sherpa.stopSherpa(),
          });
        }
      } else if (sherpa) console.warn('  sherpa: chưa cài (chạy npm run setup:stt)');
    } catch (error) {
      console.warn(`  sherpa: lỗi khi khởi động: ${error.message}`);
    }
  }
  return found;
}

// Đọc danh sách (file, câu mẫu) từ thư mục ghi âm.
function readItems(root) {
  if (!fs.existsSync(root)) return [];
  const audio = (f) => /\.(wav|m4a|webm|audio)$/i.test(f);
  const json = (name) => (fs.existsSync(path.join(root, name)) ? JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')) : null);
  const manifest = json('manifest.json');
  let rows = Array.isArray(manifest?.items) ? manifest.items : null;
  // Bộ thu trong app (Hồ sơ học tập → bộ thu thanh điệu) ghi data/eval-recordings/<người học>/:
  // recordings[{ id, file: "<id>.audio" }], câu mẫu tra theo id trong eval/toneItems.mjs.
  if (!rows && Array.isArray(manifest?.recordings)) {
    rows = manifest.recordings
      .map((r) => ({ file: r.file || `${r.id}.audio`, text: TONE_ITEMS.find((t) => t.id === r.id)?.text || '' }))
      .filter((r) => r.text);
  }
  if (!rows) {
    const items = json('items.json');
    if (Array.isArray(items)) rows = items;
    else if (items && typeof items === 'object') rows = Object.entries(items).map(([file, text]) => ({ file, text }));
  }
  if (!rows)
    rows = fs
      .readdirSync(root)
      .filter(audio)
      .map((file) => ({ file, text: path.parse(file).name }));
  const out = [];
  for (const row of rows) {
    const file = path.join(root, path.basename(String(row.file || '')));
    if (!audio(file) || !hanOnly(row.text) || !fs.existsSync(file)) continue;
    out.push({ id: path.basename(file), text: String(row.text), source: 'recorded', read: () => fs.readFileSync(file) });
  }
  return out;
}

// Chọn N câu cách đều nhau từ lessons/listening rồi nhờ Edge TTS đọc (giữ trong bộ nhớ).
async function synthItems(count) {
  const { synthesizeSpeech } = await import('../server/tts.mjs');
  const root = new URL('../lessons/listening/', import.meta.url).pathname;
  const texts = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const item of [...(data.shadowing || []), ...(data.items || [])]) {
            const t = item.text || item.hanzi;
            if (t && hanOnly(t).length >= 3 && hanOnly(t).length <= 25) texts.push(t);
          }
        } catch {}
      }
    }
  };
  walk(root);
  const unique = [...new Set(texts)];
  const step = Math.max(1, Math.floor(unique.length / count));
  const items = [];
  for (let i = 0; i < unique.length && items.length < count; i += step) {
    try {
      const speech = await synthesizeSpeech({ text: unique[i], voice: 'zh-CN-XiaoxiaoNeural' });
      const bytes = Buffer.from(speech.audioBase64, 'base64');
      items.push({ id: `synth-${items.length + 1}`, text: unique[i], source: 'synth', read: () => bytes });
    } catch (error) {
      console.warn(`  --synth: bỏ câu "${unique[i]}": ${error.message}`);
    }
  }
  return items;
}

const pct = (x) => `${(x * 100).toFixed(1)} %`;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`Đo nhận giọng · thư mục ${dir}`);
const backends = await loadBackends();
if (!backends.length) {
  console.error('\nKhông có backend nhận giọng nào chạy được (cần whisper.cpp hoặc sherpa-onnx).');
  console.error('Cài: npm run setup:stt (sherpa-onnx) hoặc npm run setup:whisper (whisper). Xem docs/STT.md.');
  process.exit(1);
}

const { decodeToPcm } = await import('../server/tones.mjs');
const reading = await tryImport('../src/lib/readingScore.mjs');
if (!reading) console.warn('  không có chấm theo pinyin, chỉ tính CER.');

const items = [...readItems(dir), ...(synthCount ? await synthItems(synthCount) : [])];
if (!items.length) {
  console.error(`\nKhông có ghi âm nào để đo trong ${dir}. Xem docs/STT.md (cách ghi 40 câu) hoặc dùng --synth=20.`);
  await Promise.all(backends.map((b) => b.stop?.()));
  process.exit(1);
}

const rows = [];
for (const item of items) {
  let pcm;
  try {
    pcm = await decodeToPcm(item.read());
  } catch (error) {
    console.warn(`  bỏ ${item.id}: ${error.message}`);
    continue;
  }
  for (const backend of backends) {
    const started = performance.now();
    let heard = '';
    let failed = '';
    try {
      heard = String((await backend.transcribe(pcm)) ?? '');
    } catch (error) {
      failed = error.message;
    }
    const ms = performance.now() - started;
    const score = reading && !failed ? reading.scoreReading(item.text, heard) : null;
    rows.push({
      backend: backend.name,
      id: item.id,
      source: item.source,
      target: item.text,
      heard,
      error: failed || undefined,
      cer: failed ? 1 : cer(item.text, heard),
      syllableAccuracy: score && score.total ? score.matched / score.total : null,
      readingScore: score?.score ?? null,
      ok: score?.ok ?? null,
      ms: Math.round(ms),
      audioMs: Math.round((pcm.length / 16000) * 1000),
    });
  }
}
await Promise.all(backends.map((b) => b.stop?.()));

const summary = [];
for (const backend of backends) {
  for (const source of ['recorded', 'synth']) {
    const sub = rows.filter((r) => r.backend === backend.name && r.source === source);
    if (!sub.length) continue;
    const acc = sub.map((r) => r.syllableAccuracy).filter((x) => x !== null);
    summary.push({
      backend: backend.name,
      bộ: source === 'recorded' ? 'người đọc' : 'TTS',
      câu: sub.length,
      CER: pct(mean(sub.map((r) => r.cer))),
      'đúng nguyên câu': pct(sub.filter((r) => r.cer === 0).length / sub.length),
      'đúng âm tiết': acc.length ? pct(mean(acc)) : '—',
      'chấm đạt': reading ? pct(sub.filter((r) => r.ok).length / sub.length) : '—',
      'ms/câu': Math.round(mean(sub.map((r) => r.ms))),
      'tốc độ (x thời gian thật)': (mean(sub.map((r) => r.ms)) / Math.max(1, mean(sub.map((r) => r.audioMs)))).toFixed(2),
    });
  }
}
console.log('');
console.table(summary);
console.log('CER thấp là tốt; "đúng âm tiết" tính theo pinyin nên đồng âm (事/是) vẫn được tính đúng.');
if (summary.some((s) => s.bộ === 'TTS' && parseFloat(s.CER) > 5))
  console.log('Lưu ý: bộ TTS mà CER > 5 % thì lỗi nằm ở backend, chưa cần nghi người đọc.');

if (save) {
  const date = new Date().toISOString().slice(0, 10);
  saveResult('stt', { date, backends: backends.map((b) => b.name).join('+') }, { summary, rows });
}
