import { execFileSync } from 'node:child_process';
import path from 'node:path';

const allowed = new Set(['public/avatars/brunette.glb', 'public/avatars/lam-sample.zip', 'public/favicon.svg']);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const rejected = files.filter((file) => {
  if (/^(mom|personal)/i.test(path.basename(file))) return true;
  if (!/\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|heic|glb|gltf|zip)$/i.test(file)) return false;
  return !allowed.has(file) && !file.startsWith('docs/media/');
});
if (rejected.length) {
  console.error('Unapproved assets; never commit personal avatars or photos:\n' + rejected.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Public asset allowlist passed. Review every docs/media frame manually.');
}
