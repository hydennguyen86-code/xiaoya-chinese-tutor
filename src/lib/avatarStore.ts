import type { AvatarMode } from '../types';

const DB_NAME = 'xiaoya.avatar.v1';
const STORE = 'files';
const KEY = 'custom';
const MAX_BYTES = 60 * 1024 * 1024;

export interface StoredAvatar {
  blob: Blob;
  name: string;
  kind: AvatarMode;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt này không lưu được file avatar.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Không mở được bộ nhớ lưu avatar.'));
  });
}

export function detectAvatarKind(fileName: string): AvatarMode | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'zip') return 'lam';
  if (ext === 'glb') return 'classic';
  return null;
}

export async function saveCustomAvatar(file: File): Promise<StoredAvatar> {
  const kind = detectAvatarKind(file.name);
  if (!kind) throw new Error('Chỉ nhận file .zip (LAM) hoặc .glb (avatar 3D).');
  if (file.size > MAX_BYTES) throw new Error('File avatar quá lớn (tối đa 60 MB).');

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(
        { blob: file, name: file.name, kind, savedAt: Date.now() },
        KEY,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Không lưu được file avatar.'));
    });
  } finally {
    db.close();
  }
  return { blob: file, name: file.name, kind };
}

export async function loadCustomAvatar(): Promise<StoredAvatar | null> {
  const db = await openDb();
  try {
    const record = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Không đọc được file avatar đã lưu.'));
    });
    if (!record || typeof record !== 'object') return null;
    const { blob, name, kind } = record as Partial<StoredAvatar>;
    if (!(blob instanceof Blob) || typeof name !== 'string') return null;
    if (kind !== 'lam' && kind !== 'classic') return null;
    return { blob, name, kind };
  } finally {
    db.close();
  }
}

export async function clearCustomAvatar(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Không xoá được file avatar.'));
    });
  } finally {
    db.close();
  }
}
