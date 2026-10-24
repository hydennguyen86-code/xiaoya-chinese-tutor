import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Keep each evaluation run as a JSON file in eval/results/ with when it ran,
// on which commit (and whether the working tree had changes) and the settings,
// so numbers quoted in the README can be traced and compared later.
export function saveResult(name, settings, result) {
  const git = (...args) => {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const ranAt = new Date().toISOString();
  const record = { name, ranAt, commit: git('rev-parse', '--short', 'HEAD'), dirty: Boolean(git('status', '--porcelain')), settings, result };
  const dir = new URL('./results/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const slug = `${name}-${Object.values(settings).join('-')}`.replace(/[^A-Za-z0-9.-]+/g, '_').slice(0, 80);
  const file = new URL(`${slug}-${ranAt.replace(/[:.]/g, '-')}.json`, dir);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 1)}\n`);
  console.log(`\nsaved ${file.pathname.split('/eval/')[1] ? `eval/${file.pathname.split('/eval/')[1]}` : file.pathname}`);
}
