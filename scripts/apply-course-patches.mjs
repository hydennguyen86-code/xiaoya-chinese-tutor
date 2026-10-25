import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function applyCoursePatches(coursesDir, patchesDir) {
  const pending = [];
  for (const name of fs.readdirSync(patchesDir).filter((n) => n.endsWith('.patch.json'))) {
    const patch = JSON.parse(fs.readFileSync(path.join(patchesDir, name), 'utf8'));
    if (patch.patchVersion !== 1 || patch.reviewed !== false || !/^lessons\/courses\/hsk1-practical-(6|12)-d2\.json$/.test(patch.target))
      throw Error('Unsupported course patch');
    const file = path.join(coursesDir, path.basename(patch.target)),
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const op of patch.ops) {
      if (op.op !== 'add' || !/^\/checkpoint\/(?:listening\/\d+\/pinyin|speaking\/\d+\/pinyin|glossary)$/.test(op.path))
        throw Error('Patch may only add checkpoint learning aids');
      const parts = op.path.split('/').slice(1);
      let parent = data;
      for (const part of parts.slice(0, -1)) {
        if (!Object.hasOwn(parent, part)) throw Error('Missing patch parent');
        parent = parent[part];
      }
      const key = parts.at(-1);
      if (Object.hasOwn(parent, key) && JSON.stringify(parent[key]) !== JSON.stringify(op.value))
        throw Error('Patch cannot overwrite existing content');
      parent[key] = op.value;
    }
    pending.push([file, data]);
  }
  for (const [file, data] of pending) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return pending.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(
    'Patched checkpoint files:',
    applyCoursePatches(
      fileURLToPath(new URL('../lessons/courses/', import.meta.url)),
      fileURLToPath(new URL('../lessons/courses/patches/', import.meta.url)),
    ),
  );
