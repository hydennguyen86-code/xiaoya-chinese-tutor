// A fragment match is partial evidence, never proof that the full sentence is fixed.
const normalize = (text) =>
  String(text)
    .normalize('NFKC')
    .replace(/[\s，。！？、；：,.!?;:“”"'‘’]/gu, '');
export function scoreCorrection(text, expected, hits) {
  const spans = [];
  let ambiguous = 0;
  for (const hit of hits) {
    if (!hit.original || typeof hit.corrected !== 'string') continue;
    let index = hit.index;
    if (!Number.isInteger(index)) {
      index = text.indexOf(hit.original);
      if (index >= 0 && text.indexOf(hit.original, index + 1) >= 0) {
        ambiguous++;
        continue;
      }
    }
    if (index < 0 || text.slice(index, index + hit.original.length) !== hit.original) {
      ambiguous++;
      continue;
    }
    if (spans.some((s) => index < s.index + s.original.length && s.index < index + hit.original.length)) {
      ambiguous++;
      continue;
    }
    spans.push({ ...hit, index });
  }
  let result = text;
  for (const hit of spans.sort((a, b) => b.index - a.index))
    result = result.slice(0, hit.index) + hit.corrected + result.slice(hit.index + hit.original.length);
  const actual = normalize(result),
    target = normalize(expected);
  const exact = spans.length > 0 && !ambiguous && target.length > 0 && actual === target;
  return { exact, partial: !exact && spans.length > 0 && target.length > 0 && actual.includes(target), ambiguous, result };
}
