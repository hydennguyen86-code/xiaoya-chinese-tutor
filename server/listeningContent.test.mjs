import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
for (const kind of ['tone-pairs']) test(`${kind}: supplied structure, pinyin and sandhi checks run in repo`,()=>{
 const file = new URL(`../lessons/listening/${kind}.json`,import.meta.url);
 assert.equal(JSON.parse(fs.readFileSync(file)).source,'AI soạn, chưa duyệt');
 const result=spawnSync(process.execPath,[`scripts/listening-checks/${kind}.check.mjs`,file.pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
