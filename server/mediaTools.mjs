import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function mediaToolPath(name, env = process.env, exists = fs.existsSync, home = os.homedir(), platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const binary = platform === 'win32' ? `${name}.exe` : name;
  const configured = env[name === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'];
  if (configured) return configured;
  const candidates = [
    ...(name === 'ffprobe' && env.FFMPEG_PATH ? [paths.join(paths.dirname(env.FFMPEG_PATH), binary)] : []),
    ...(platform === 'win32'
      ? [
          paths.join(env.LOCALAPPDATA || home, 'Microsoft', 'WinGet', 'Links', binary),
          paths.join(env.ProgramFiles || 'C:\\Program Files', 'ffmpeg', 'bin', binary),
        ]
      : [
          paths.join(home, '.local', 'bin', binary),
          '/usr/local/bin/' + binary,
          ...(platform === 'darwin' ? ['/opt/homebrew/bin/' + binary] : []),
        ]),
  ];
  return candidates.find(exists) || binary;
}
export function mediaToolEnv(env = process.env) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === 'path') || 'PATH';
  const executable = mediaToolPath('ffmpeg', env);
  const additions = path.isAbsolute(executable) ? [path.dirname(executable)] : [];
  if (process.platform !== 'win32')
    additions.push(path.join(os.homedir(), '.local', 'bin'), ...(process.platform === 'darwin' ? ['/opt/homebrew/bin'] : []));
  return { ...env, [key]: [...additions, env[key] || ''].join(path.delimiter) };
}
