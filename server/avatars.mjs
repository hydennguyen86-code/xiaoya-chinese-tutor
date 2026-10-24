import fs from 'node:fs';
import path from 'node:path';
export const PRIVATE_AVATARS = ['personal.glb', 'personal-lam.zip'];
export function createAvatarStore({ dataDir, publicDir, samplesOnly = false }) {
  const directory = path.resolve(dataDir, 'avatars');
  // Migration copies only known avatar names; never removes or overwrites originals.
  if (!samplesOnly)
    for (const name of PRIVATE_AVATARS) {
      const old = path.join(publicDir, 'avatars', name);
      if (!fs.existsSync(old)) continue;
      fs.mkdirSync(directory, { recursive: true });
      try {
        fs.copyFileSync(old, path.join(directory, name), fs.constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  function resolve(name) {
    if (samplesOnly || !PRIVATE_AVATARS.includes(name)) return null;
    const file = path.join(directory, name);
    return fs.existsSync(file) ? file : null;
  }
  function url(name, fallback) {
    const file = resolve(name);
    return file ? `/api/avatars/${name}?v=${Math.round(fs.statSync(file).mtimeMs)}` : `/avatars/${fallback}`;
  }
  return { resolve, glbUrl: () => url('personal.glb', 'brunette.glb'), lamUrl: () => url('personal-lam.zip', 'lam-sample.zip') };
}
