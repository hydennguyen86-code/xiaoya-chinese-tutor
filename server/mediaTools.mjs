import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Keep decoding and local TTS consistent when launched outside a login shell.
export function mediaToolPath(name, env = process.env, exists = fs.existsSync, home = os.homedir()) {
  const configured = env[name === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'];
  if (configured) return configured;
  const candidates = [
    ...(name === 'ffprobe' && env.FFMPEG_PATH ? [path.join(path.dirname(env.FFMPEG_PATH), name)] : []),
    path.join(home, '.local', 'bin', name),
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
  ];
  return candidates.find(exists) || name;
}
