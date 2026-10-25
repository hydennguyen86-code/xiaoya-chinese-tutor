// Reproducible extraction from official Unihan 17.0.0. No dictionary scraping.
// node scripts/build-hanviet.mjs /path/to/Unihan.zip
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSZip from 'jszip';
const input = process.argv[2];
if (!input) throw Error('Specify official Unicode 17.0.0 Unihan.zip');
const bytes = fs.readFileSync(input),
  zip = await JSZip.loadAsync(bytes);
const readingsText = await zip.file('Unihan_Readings.txt').async('string');
const variantsText = await zip.file('Unihan_Variants.txt').async('string');
if (!readingsText.includes('Unicode Version 17.0.0')) throw Error('Expected Unicode 17.0.0');
const readings = {},
  variants = {},
  via = {};
const char = (code) => String.fromCodePoint(parseInt(code.replace('U+', ''), 16));
for (const line of readingsText.split('\n')) {
  const [code, key, value] = line.split('\t');
  if (code.startsWith('U+') && key === 'kVietnamese') readings[char(code)] = [...new Set(value.normalize('NFC').split(/\s+/))];
}
for (const line of variantsText.split('\n')) {
  const [code, key, value] = line.split('\t');
  if (code.startsWith('U+') && key === 'kTraditionalVariant') variants[char(code)] = value.split(/\s+/).map((v) => char(v.split('<')[0]));
}
const direct = { ...readings };
for (const simple of Object.keys(variants)) {
  if (direct[simple]) continue;
  const visited = new Set([simple]),
    queue = [...variants[simple]],
    found = [];
  while (queue.length) {
    const c = queue.shift();
    if (visited.has(c)) continue;
    visited.add(c);
    if (direct[c]) found.push(c);
    else queue.push(...(variants[c] || []));
  }
  if (found.length) {
    readings[simple] = [...new Set(found.flatMap((c) => direct[c]))];
    via[simple] = found;
  }
}
const output = {
  version: '17.0.0',
  property: 'kVietnamese',
  source: 'https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip',
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  copyright: '© 2025 Unicode, Inc.; Unicode License V3, see licenses/Unicode-3.0.txt',
  readings: Object.fromEntries(Object.entries(readings).sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0))),
  via,
};
fs.writeFileSync(new URL('../src/data/hanviet-unihan.json', import.meta.url), JSON.stringify(output) + '\n');
console.log(
  JSON.stringify({ direct: Object.keys(direct).length, withTraditionalFallback: Object.keys(readings).length, sha256: output.sha256 }),
);
