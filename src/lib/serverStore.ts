// Mirrors the app's `xiaoya.*` browser-storage keys into the server's data
// folder. The rest of the app keeps using localStorage synchronously; this
// module loads the folder into localStorage before the app starts and pushes
// every later change back to the folder.

const PREFIX = 'xiaoya.';
const DEBOUNCE_MS = 400;
const pending = new Map<string, number>();
let syncing = false;

function send(key: string) {
  const value = window.localStorage.getItem(key);
  const url = `/api/store/${encodeURIComponent(key)}`;
  const init: RequestInit =
    value === null
      ? { method: 'DELETE', keepalive: true }
      : {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
          // keepalive bodies are capped (~64 KB); larger values just send normally
          keepalive: value.length < 60_000,
        };
  fetch(url, init).catch(() => {
    // server unreachable: the value stays in the browser and is re-sent on the next change
  });
}

function schedule(key: string) {
  if (!syncing) return;
  const previous = pending.get(key);
  if (previous !== undefined) window.clearTimeout(previous);
  pending.set(
    key,
    window.setTimeout(() => {
      pending.delete(key);
      send(key);
    }, DEBOUNCE_MS),
  );
}

function flushAll() {
  for (const [key, timer] of pending) {
    window.clearTimeout(timer);
    send(key);
  }
  pending.clear();
}

// Patch the prototype (assigning to localStorage.setItem would store an item
// named "setItem"), and only react to localStorage, not sessionStorage.
function watchLocalStorage() {
  const proto = Storage.prototype;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;
  proto.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
    setItem.call(this, key, value);
    if (this === window.localStorage && key.startsWith(PREFIX)) schedule(key);
  };
  proto.removeItem = function patchedRemoveItem(this: Storage, key: string) {
    removeItem.call(this, key);
    if (this === window.localStorage && key.startsWith(PREFIX)) schedule(key);
  };
}

export async function initServerStore() {
  let items: Record<string, string>;
  try {
    const res = await fetch('/api/store', { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return;
    items = ((await res.json()) as { items?: Record<string, string> }).items ?? {};
  } catch {
    return; // no server store: the app keeps working on browser storage alone
  }

  // The folder wins for every key it has.
  for (const [key, value] of Object.entries(items)) {
    if (key.startsWith(PREFIX)) window.localStorage.setItem(key, value);
  }
  // Data that so far only exists in this browser moves into the folder.
  const browserOnly: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(PREFIX) && !(key in items)) browserOnly.push(key);
  }

  watchLocalStorage();
  syncing = true;
  for (const key of browserOnly) send(key);
  window.addEventListener('pagehide', flushAll);
}
