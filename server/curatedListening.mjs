import fs from 'node:fs';
export function validateCurated(data) {
  if (
    data?.kind !== 'cv-curated' ||
    data.source !== 'AI soạn, chưa duyệt' ||
    data.version !== 1 ||
    !Array.isArray(data.items) ||
    !data.items.length
  )
    throw Error('Invalid curated metadata');
  const seen = new Set();
  for (const item of data.items) {
    if (
      !item ||
      Object.keys(item).some((k) => !['sentence_id', 'level', 'meaningVi', 'focus'].includes(k)) ||
      !/^[a-f0-9]{64}$/.test(item.sentence_id) ||
      seen.has(item.sentence_id) ||
      !['HSK1-2', 'HSK3-4', 'HSK5-6'].includes(item.level) ||
      typeof item.meaningVi !== 'string' ||
      !item.meaningVi.trim() ||
      !Array.isArray(item.focus) ||
      !item.focus.length ||
      item.focus.some((f) => typeof f !== 'string' || !f.trim())
    )
      throw Error('Invalid curated item');
    seen.add(item.sentence_id);
  }
  return data.items;
}
export function loadCurated() {
  return validateCurated(JSON.parse(fs.readFileSync(new URL('../lessons/listening/cv-curated.json', import.meta.url), 'utf8')));
}
