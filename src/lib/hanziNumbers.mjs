// Máy nhận giọng (SenseVoice khi bật chuẩn hoá, whisper) hay ghi số bằng chữ số: người học đọc
// 二十五岁 thì bản chép ra "25岁". Bộ chấm so theo âm tiết pinyin nên phải đổi chữ số về chữ Hán
// trước khi chấm. Một chuỗi số có nhiều cách đọc (一三五 kiểu số điện thoại, 一百三十五 kiểu giá trị,
// 两百 / 二百), nên module sinh các cách đọc rồi để bộ chấm chọn cách khớp câu mẫu nhất.
// Dùng chung client + server.

const DIGIT = '零一二三四五六七八九';
const FULLWIDTH = /[０-９．％：]/g;
// Một cụm số: 7.2 / 25 / 4% / 8:10. Dấu phẩy/khoảng trắng tách cụm (135,7208 là hai cụm).
const RUN = /\d+(?:[.:]\d+)?%?/g;

export const hasDigits = (s) => /[0-9０-９]/.test(String(s ?? ''));

const toHalfwidth = (s) => String(s ?? '').replace(FULLWIDTH, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** Đọc từng chữ số: 135 → 一三五. */
export function digitwise(digits) {
  return [...digits].map((d) => DIGIT[+d]).join('');
}

/** Đọc theo giá trị dưới một vạn: 2160 → 两千一百六十 (liang=true) / 二千一百六十. */
function under10k(n, liang, leadingTen) {
  const units = ['千', '百', '十', ''];
  const ds = String(n).padStart(4, '0').split('').map(Number);
  let out = '';
  let zero = false;
  ds.forEach((d, i) => {
    if (d === 0) {
      if (out) zero = true;
      return;
    }
    if (zero) out += '零';
    zero = false;
    const unit = units[i];
    if (unit === '十' && d === 1 && !out && leadingTen) out += '十';
    else if (d === 2 && liang && (unit === '千' || unit === '百')) out += `两${unit}`;
    else out += DIGIT[d] + unit;
  });
  return out;
}

/** Đọc theo giá trị: 25 → 二十五, 120 → 一百二十, 20000 → 两万. Ngoài 0–99 999 999 thì đọc từng số. */
export function positional(digits, { liang = false } = {}) {
  if (!/^\d+$/.test(digits) || digits.length > 8 || (digits.length > 1 && digits[0] === '0')) return digitwise(digits);
  const n = Number(digits);
  if (n === 0) return '零';
  const wan = Math.floor(n / 10000);
  const rest = n % 10000;
  let out = '';
  if (wan) out += (wan === 2 && liang ? '两' : under10k(wan, liang, true)) + '万';
  if (rest) {
    if (wan && rest < 1000) out += '零';
    out += under10k(rest, liang, !wan);
  }
  return out;
}

/** Các cách đọc của một cụm số (đã bỏ trùng). */
export function readingsOf(run) {
  const pct = run.endsWith('%');
  const core = pct ? run.slice(0, -1) : run;
  let list;
  if (core.includes(':')) {
    const [h, m] = core.split(':');
    const hour = positional(h, { liang: true }).replace(/^二$/, '两');
    const mm = Number(m);
    list = [
      `${hour}点${mm === 30 ? '半' : mm ? `${positional(String(mm))}分` : ''}`,
      `${hour}点${mm ? `${positional(String(mm))}分` : ''}`,
    ];
    if (mm && mm < 10) list.push(`${hour}点零${positional(String(mm))}分`);
  } else if (core.includes('.')) {
    const [a, b] = core.split('.');
    // 7.2 đọc 七点二, nhưng là tiền thì nói 七块二 (một chữ số lẻ = hào).
    list = [`${positional(a)}点${digitwise(b)}`, `${positional(a, { liang: true })}点${digitwise(b)}`];
    if (b.length === 1) list.push(`${positional(a, { liang: true })}块${digitwise(b)}`);
  } else {
    list = [positional(core), positional(core, { liang: true }), digitwise(core)];
    // Số đứng một mình 2 trước lượng từ thường đọc 两 (两个, 两点): để bộ chấm chọn.
    if (core === '2') list.push('两');
  }
  if (pct) list = list.map((r) => `百分之${r}`);
  return [...new Set(list)];
}

const MAX_CANDIDATES = 81;

/**
 * Mọi cách viết lại chuỗi bằng chữ Hán (tổ hợp cách đọc từng cụm số). Không có chữ số → [text].
 * Nhiều cụm quá thì mỗi cụm chỉ giữ cách đọc đầu để tránh bùng nổ tổ hợp.
 */
export function numberCandidates(text) {
  const src = toHalfwidth(text);
  const runs = [...src.matchAll(RUN)];
  if (!runs.length) return [String(text ?? '')];
  let options = runs.map((m) => readingsOf(m[0]));
  const combos = options.reduce((n, o) => n * o.length, 1);
  if (combos > MAX_CANDIDATES) {
    // Cùng một kiểu đọc cho mọi cụm (giá trị / 两 / từng số).
    const k = Math.max(...options.map((o) => o.length));
    return [
      ...new Set(
        Array.from({ length: k }, (_, i) =>
          rebuild(
            src,
            runs,
            options.map((o) => o[Math.min(i, o.length - 1)]),
          ),
        ),
      ),
    ];
  }
  let acc = [[]];
  for (const o of options) acc = acc.flatMap((prefix) => o.map((r) => [...prefix, r]));
  return [...new Set(acc.map((choice) => rebuild(src, runs, choice)))];
}

function rebuild(src, runs, choice) {
  let out = '';
  let pos = 0;
  runs.forEach((m, i) => {
    out += src.slice(pos, m.index) + choice[i];
    pos = m.index + m[0].length;
  });
  return out + src.slice(pos);
}
