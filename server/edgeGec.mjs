// SPDX-License-Identifier: LGPL-3.0-only
// GEC v2 port derived from rany2/edge-tts/src/edge_tts/drm.py (LGPLv3).
// Upstream copyright: rany and edge-tts contributors. Modified 2026-10-24:
// JavaScript/Buffer/Math.imul port, generic SHA rounds, explicit timestamp API.
// Keep this replaceable server-only module and its source with distributions.
// See licenses/edge-tts-LGPL-3.0.txt, licenses/GPL-3.0.txt and NOTICE.md.
const _SHA256_INITIAL = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
const _SHA256_STATE = [4255104674, 2435071207, 3192492180, 3442351626, 1811967817, 79508907, 4272990180, 66059218];
const _SHA256_SCHEDULE = [
  3945054110, 358115615, 2696978146, 217723578, 2787307148, 3520959633, 3235718560, 4192668342, 4039316851, 1884868174, 1904797190,
  15051571, 3529027680, 1920361828,
];
const _SHA256_ROUND_CONSTANTS = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278,
  1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122,
  1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205,
  773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771,
  3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
  1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298,
];
const _CS64_COEFFICIENTS = [
  [3895366065, 3005677776],
  [1155409094, 2296378653],
  [1005282748, 693190712],
  [3365689651, 3005795295],
  [2367603217, 3557143765],
  [827258325, 652566332],
  [3911487921, 1618477510],
  [4037392853, 2192753147],
  [101076211, 4199654362],
  [3665427040, 545047652],
  [3201434976, 1010595059],
  [2314848760, 3536931681],
  [905590982, 3137643201],
  [3410617286, 3311559015],
];
const rol16 = (x) => ((x << 16) | (x >>> 16)) >>> 0;
const ror = (x, n) => (x >>> n) | (x << (32 - n));
const sigma0 = (x) => (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) >>> 0;
const sigma1 = (x) => (ror(x, 17) ^ ror(x, 19) ^ (x >>> 10)) >>> 0;
function expand(words, start = 16) {
  for (let i = start; i < 64; i++) words[i] = (sigma1(words[i - 2]) + words[i - 7] + sigma0(words[i - 15]) + words[i - 16]) >>> 0;
}
function rounds(state, words, first = 0) {
  let [a, b, c, d, e, f, g, h] = state;
  for (let i = first; i < 64; i++) {
    const constant = first === 14 && i === 14 ? 0xc9dc06a7 : _SHA256_ROUND_CONSTANTS[i];
    const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ (ror(e, 25) >>> 0)) + ((e & f) ^ (~e & g)) + constant + words[i]) >>> 0;
    const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
    [a, b, c, d, e, f, g, h] = [(t1 + t2) >>> 0, a, b, c, (d + t1) >>> 0, e, f, g];
  }
  return [a, b, c, d, e, f, g, h];
}
function saltedHash(data) {
  const words = new Array(14).fill(0);
  words.push(data.readUIntBE(0, 3), data.readUInt32BE(3));
  for (let i = 16; i < 30; i++) {
    let value = _SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) value += i === 16 ? (sigma1(words[i - 2]) ^ 0x000b92c0) >>> 0 : sigma1(words[i - 2]);
    if (i - 7 >= 14) value += words[i - 7];
    if (i - 15 >= 14) value += i === 29 ? (sigma0(words[i - 15]) ^ 0x059c0b80) >>> 0 : sigma0(words[i - 15]);
    words.push(value >>> 0);
  }
  words.push((sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + 0xc9dc06a7 - _SHA256_ROUND_CONSTANTS[14]) >>> 0);
  expand(words, 31);
  let state = rounds(_SHA256_STATE, words, 14).map((v, i) => (v + _SHA256_INITIAL[i]) >>> 0);
  const length = 57 + data.length;
  const padding = (55 - (length % 64) + 64) % 64;
  const padded = Buffer.concat([data.subarray(7), Buffer.from([128]), Buffer.alloc(padding + 8)]);
  padded.writeBigUInt64BE(BigInt(length * 8), padded.length - 8);
  for (let offset = 0; offset < padded.length; offset += 64) {
    const block = Array.from({ length: 16 }, (_, i) => padded.readUInt32BE(offset + 4 * i));
    expand(block);
    state = rounds(state, block).map((v, i) => (v + state[i]) >>> 0);
  }
  const digest = Buffer.alloc(32);
  state.forEach((v, i) => digest.writeUInt32BE(v, 4 * i));
  return digest;
}
function cs64(data, digest) {
  const keys = [digest.readUInt32LE(0) | 1, digest.readUInt32LE(4) | 1];
  const factors = keys.map((v) => Math.imul(v, 0x82893933));
  const terms = _CS64_COEFFICIENTS.map(([c], i) => Math.imul(c, factors[i % 2]));
  const offsets = _CS64_COEFFICIENTS.map(([, v]) => v);
  const count = Math.ceil((data.length + 1) / 8) * 8;
  const padded = Buffer.alloc(count);
  data.copy(padded, 1);
  for (let i = 0; i < count / 4; i++) {
    const word = padded.readUInt32LE(i * 4);
    terms.push((Math.imul(word, keys[i % 2]) + (i === 0 ? Math.imul(0xf2f90b1a, factors[0]) : 0)) >>> 0);
    offsets.push((Math.imul(rol16(word), i % 2 === 0 ? 0xef0569fb : 0xc31713db) + (i === 0 ? 0x0b1a0000 : 0)) >>> 0);
  }
  let swapAcc = 0,
    swapLast = 0,
    state = 0,
    acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    let q = Math.imul(rol16((offsets[i] + terms[i]) >>> 0), 0x76f50f34);
    swapAcc = (swapAcc + Math.imul(rol16(q), 0xc3efea97) + q) >>> 0;
    q = Math.imul(rol16((offsets[i + 1] + terms[i + 1]) >>> 0), 0x1881ce3c);
    swapLast = (Math.imul(rol16(q), 0x35bd1ec9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
    state = (Math.imul(state, keys[0]) + terms[i]) >>> 0;
    for (const c of [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83]) state = Math.imul(rol16(state), c) >>> 0;
    acc = (acc + state) >>> 0;
    state = (Math.imul(state, keys[1]) + terms[i + 1]) >>> 0;
    for (const c of [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69]) state = Math.imul(rol16(state), c) >>> 0;
    acc = (acc + state) >>> 0;
  }
  const result = Buffer.alloc(8);
  result.writeUInt32LE((swapLast ^ state) >>> 0, 0);
  result.writeUInt32LE((swapAcc ^ acc) >>> 0, 4);
  return result;
}
export const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export function generateGecV2(now = Date.now()) {
  const seconds = BigInt(Math.floor(now / 1000)) + 11644473600n;
  const ticks = (seconds - (seconds % 300n)) * 10000000n;
  const data = Buffer.from(`${ticks}${EDGE_TOKEN}`, 'ascii');
  const digest = saltedHash(data);
  return `${cs64(data, digest).toString('hex')}-${digest.toString('hex')}`.toUpperCase();
}
