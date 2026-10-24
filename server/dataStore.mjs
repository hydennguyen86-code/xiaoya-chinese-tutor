import fs from 'node:fs';
import path from 'node:path';

// Learner data (profiles, chat, progress, learning history, settings) lives in
// one JSON file per browser-storage key, so it survives clearing the browser
// and is shared by every browser on this computer.
const KEY_RE = /^xiaoya\.[A-Za-z0-9._:-]{1,120}$/;
const MAX_VALUE_CHARS = 2 * 1024 * 1024;
const KEEP_BACKUP_DAYS = 14;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createDataStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const backupRoot = path.join(dir, 'backups');
  const fileFor = (key) => path.join(dir, `${encodeURIComponent(key)}.json`);
  let backedUpOn = '';

  // Before the first change of each day, copy the current files aside.
  function backupOncePerDay() {
    const day = today();
    if (backedUpOn === day) return;
    const target = path.join(backupRoot, day);
    if (fs.existsSync(target)) {
      backedUpOn = day;
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    if (!files.length) return; // nothing to protect yet; try again on the next change
    backedUpOn = day;
    fs.mkdirSync(target, { recursive: true });
    for (const f of files) fs.copyFileSync(path.join(dir, f), path.join(target, f));
    const days = fs.readdirSync(backupRoot).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    for (const old of days.slice(0, Math.max(0, days.length - KEEP_BACKUP_DAYS))) {
      fs.rmSync(path.join(backupRoot, old), { recursive: true, force: true });
    }
  }

  return {
    dir,

    isValidKey(key) {
      return typeof key === 'string' && KEY_RE.test(key);
    },

    readAll() {
      const items = {};
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        let key;
        try {
          key = decodeURIComponent(f.slice(0, -'.json'.length));
        } catch {
          continue;
        }
        if (!KEY_RE.test(key)) continue;
        try {
          items[key] = fs.readFileSync(path.join(dir, f), 'utf8');
        } catch {
          // unreadable file: skip it rather than fail the whole load
        }
      }
      return items;
    },

    write(key, value) {
      if (!this.isValidKey(key)) throw Object.assign(new Error('Khoá dữ liệu không hợp lệ.'), { status: 400 });
      if (typeof value !== 'string') throw Object.assign(new Error('Giá trị phải là chuỗi.'), { status: 400 });
      if (value.length > MAX_VALUE_CHARS) throw Object.assign(new Error('Dữ liệu quá lớn.'), { status: 413 });
      backupOncePerDay();
      const target = fileFor(key);
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, value, 'utf8');
      fs.renameSync(tmp, target); // atomic: a crash never leaves a half-written file
    },

    remove(key) {
      if (!this.isValidKey(key)) throw Object.assign(new Error('Khoá dữ liệu không hợp lệ.'), { status: 400 });
      backupOncePerDay();
      fs.rmSync(fileFor(key), { force: true });
    },
  };
}
