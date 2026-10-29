import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const guide = 'https://github.com/hydennguyen86-code/xiaoya-chinese-tutor#readme';
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error(`Cần Node.js 24 trở lên: https://nodejs.org/\nHướng dẫn: ${guide}`);
  process.exit(1);
}
async function runNpm(args) {
  return new Promise((resolve, reject) => {
    const proc =
      process.platform === 'win32'
        ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { stdio: 'inherit' })
        : spawn('npm', args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} thất bại`))));
  });
}
try {
  if (
    !fs.existsSync('node_modules/.package-lock.json') ||
    !fs.existsSync('node_modules/.misu-installed-lock') ||
    fs.readFileSync('package-lock.json', 'utf8') !== fs.readFileSync('node_modules/.misu-installed-lock', 'utf8')
  ) {
    console.log('Đang cài dependency từ package-lock…');
    await runNpm(['ci']);
    fs.writeFileSync('node_modules/.misu-installed-lock', fs.readFileSync('package-lock.json'));
  }
  await runNpm(['run', 'build']);
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (!response.ok || !(await response.json()).models?.length) throw new Error();
    console.log('Đã thấy Ollama. Chọn model trong Cài đặt.');
  } catch {
    console.log(
      'Chưa thấy Ollama/model. Bài học cố định vẫn dùng được. Xem gợi ý RAM trong Kiểm tra hệ thống; hoặc tự cấu hình API trong Cài đặt. Cài Ollama: https://ollama.com/download',
    );
  }
  const { totalmem } = await import('node:os');
  const ramGB = Math.round(totalmem() / 1024 ** 3);
  if (ramGB >= 16) {
    console.log(`RAM ${ramGB} GB: Đủ để chạy model local qwen3.5:4b. Gợi ý: ollama pull qwen3.5:4b (tốc độ còn phụ thuộc CPU/GPU).`);
  } else if (ramGB >= 8) {
    console.log(`RAM ${ramGB} GB: Cần 16 GB để chạy model AI local và chấm điểm nói mượt mà. Avatar tự chuyển sang chế độ nhẹ (3D). Xem gợi ý trong Kiểm tra hệ thống; cân nhắc API hoặc chỉ học bài cố định.`);
  } else {
    console.log(`RAM ${ramGB} GB: Máy cần ít nhất 16 GB RAM để chạy model AI local. Avatar đã tự chuyển sang chế độ nhẹ (3D). Ưu tiên bài cố định hoặc API.`);
  }
  const child = spawn(process.execPath, ['server/index.mjs'], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: { ...process.env, HOST: '127.0.0.1' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Server quá thời gian khởi động.'));
    }, 20000);
    const failed = () => {
      clearTimeout(timer);
      reject(new Error('Không mở được server; kiểm tra cổng đang dùng.'));
    };
    child.once('error', failed);
    child.once('exit', failed);
    child.on('message', (message) => {
      if (message?.type !== 'misu-ready') return;
      clearTimeout(timer);
      child.off('error', failed);
      child.off('exit', failed);
      resolve();
    });
  });
  const url = `http://127.0.0.1:${process.env.PORT || 8787}`;
  const open =
    process.platform === 'win32'
      ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url])
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
  open.on('error', () => console.log(`Mở trình duyệt tại ${url}`));
} catch {
  console.error(`Khởi động chưa thành công. Kiểm tra Node/npm, kết nối mạng và thư mục có quyền ghi.\nHướng dẫn: ${guide}`);
  process.exitCode = 1;
}
