import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateGecV2 } from './edgeGec.mjs';
test('GEC v2 matches upstream reference vectors and five-minute windows', () => {
  const vectors = [
    [0, '52BC7A17B50DFEC9-28C4394775C8751CD2F6859C030C06DB1489ACAB3B3A7651831FC26895177ED6'],
    [1700000000, '2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2'],
    [1792836000, 'FE1E8446BA4667F0-DFE28B3A7FEAC1D4EE964DBA9EEEB0699792777827C7FD9FC1F31079FCDF5C1B'],
  ];
  for (const [time, value] of vectors) assert.equal(generateGecV2(time * 1000), value);
  assert.equal(generateGecV2(1792836000000), generateGecV2(1792836000999));
  assert.notEqual(generateGecV2(1792836000000), generateGecV2(1792836300000));
});
