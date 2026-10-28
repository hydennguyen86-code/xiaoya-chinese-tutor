import fs from 'node:fs';
import path from 'node:path';
export const PUBLIC_FILES = ['avatars/brunette.glb', 'avatars/lam-sample.zip', 'images/moonlit-mountains.png', 'favicon.svg', 'manifest.webmanifest', 'sw.js'];
export function checkBuildPrivacy(dir) {
  const names = JSON.parse(fs.readFileSync(path.join(dir, '.misu-build-files.json'), 'utf8'));
  const allowed = new Set([...PUBLIC_FILES, '.misu-build-files.json', ...names]);
  const rejected = [];
  function walk(folder, prefix = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) walk(path.join(folder, entry.name), relative + '/');
      else if (
        entry.isSymbolicLink() ||
        !allowed.has(relative) ||
        /^(mom|personal)/i.test(entry.name) ||
        (!PUBLIC_FILES.includes(relative) &&
          relative !== '.misu-build-files.json' &&
          relative !== 'index.html' &&
          !/^assets\/[\w.-]+\.(js|css|wasm|woff2?)$/.test(relative))
      )
        rejected.push(relative);
    }
  }
  walk(dir);
  if (rejected.length) throw new Error('dist chứa file ngoài allowlist: ' + rejected.join(', '));
  return allowed;
}
export function publicPrivacyPlugin() {
  let root, outDir;
  return {
    name: 'misu-private-assets',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname.startsWith('/avatars/') && !PUBLIC_FILES.includes(url.pathname.slice(1))) {
          res.statusCode = 404;
          res.end();
          return;
        }
        next();
      });
    },
    writeBundle(_options, bundle) {
      for (const relative of PUBLIC_FILES) {
        const dest = path.join(outDir, relative);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(root, 'public', relative), dest);
      }
      fs.writeFileSync(path.join(outDir, '.misu-build-files.json'), JSON.stringify(Object.keys(bundle)));
      checkBuildPrivacy(outDir);
    },
  };
}
