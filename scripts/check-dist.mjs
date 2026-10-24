import { fileURLToPath } from 'node:url';
import { checkBuildPrivacy } from './buildPrivacy.mjs';
checkBuildPrivacy(fileURLToPath(new URL('../dist/', import.meta.url)));
console.log('dist allowlist passed; no personal avatars or photos.');
