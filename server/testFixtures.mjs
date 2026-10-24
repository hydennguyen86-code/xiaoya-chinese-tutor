// Synthetic PCM only; this is never evidence of accuracy on human speech.
export function fixtureWav(seconds = 0.25) {
  const rate = 16000, count = Math.round(rate * seconds), wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(36 + count * 2, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i=0; i<count; i++) wav.writeInt16LE(Math.round(6000 * Math.sin(2*Math.PI*180*i/rate)),44+i*2);
  return wav;
}
