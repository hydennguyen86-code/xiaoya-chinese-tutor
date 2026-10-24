import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVi, normalizeLesson, matchesPattern } from './lessonContent.mjs';

const lesson = { no: 1, title: 'Ăn uống', topics: [], vocab: [], patterns: [], days: 2 };
const word = (w, example) => ({ word: w, meaning: 'gọi món ăn', example, exampleVi: 'Tôi muốn gọi món.' });
const base = {
  vocab: [word('点菜', '我们点菜吧。'), word('服务员', '服务员，请过来一下。'), word('菜单', '请给我菜单。'), word('辣', '这个菜很辣。')],
  patterns: [{ pattern: '……一点儿', explanation: 'Dùng sau tính từ để nói "hơi… một chút".', example: '少放一点儿辣。', exampleVi: 'Cho ít cay một chút.' }],
  roleplay: { setting: 'Ở nhà hàng', avatarRole: 'Phục vụ', learnerRole: 'Khách', goals: ['Gọi một món'], opening: '您想吃点儿什么？', openingVi: 'Anh muốn ăn gì?' },
  freeTalk: { question: '你喜欢吃辣的吗？', questionVi: 'Bạn có thích ăn cay không?' },
};

test('Vietnamese text must look Vietnamese', () => {
  assert.ok(isVi('Gọi một món ăn'));
  assert.ok(isVi('xe buýt'));
  assert.equal(isVi('I would like to order'), false);
  assert.equal(isVi('Tôi muốn 点菜'), false);
});

test('a valid lesson passes', () => {
  assert.deepEqual(normalizeLesson(base, lesson).problems, []);
});

test('examples must use the word or pattern they teach', () => {
  const raw = { ...base, vocab: [...base.vocab.slice(0, 3), word('辣', '这个菜很好吃。')] };
  const { content, problems } = normalizeLesson(raw, lesson);
  assert.equal(content.vocab.some((v) => v.word === '辣'), false);
  assert.ok(problems.includes('quá ít từ vựng hợp lệ'));
  const badPattern = { ...base, patterns: [{ ...base.patterns[0], example: '少放辣。' }] };
  assert.ok(normalizeLesson(badPattern, lesson).problems.includes('không có mẫu câu hợp lệ'));
});

test('words and patterns from the outline are required on the first day', () => {
  const withGiven = { ...lesson, vocab: [{ word: '买单' }], patterns: ['……一点儿', '一边……一边……'] };
  const { problems } = normalizeLesson(base, withGiven, { day: 1 });
  assert.ok(problems.some((p) => p.includes('买单')));
  assert.ok(problems.some((p) => p.includes('一边')));
  assert.equal(normalizeLesson(base, withGiven, { day: 2 }).problems.length, 0);
});

test('role-play needs tasks and translations in Vietnamese', () => {
  const noGoals = { ...base, roleplay: { ...base.roleplay, goals: ['Order one dish please'] } };
  assert.ok(normalizeLesson(noGoals, lesson).problems.includes('nhập vai chưa có nhiệm vụ'));
  const english = { ...base, freeTalk: { ...base.freeTalk, questionVi: 'Do you like spicy food?' } };
  assert.ok(normalizeLesson(english, lesson).problems.includes('thiếu câu hỏi nói tự do'));
});

test('pattern slots A/B/V are ignored but Chinese anchors must appear in order', () => {
  assert.ok(matchesPattern('A 跟 B 一起……', '我跟朋友一起吃饭。'));
  assert.ok(matchesPattern('……的时候', '下雨的时候我在家。'));
  assert.ok(matchesPattern('一边……一边……', '他一边吃饭一边看电视。'));
  assert.equal(matchesPattern('一边……一边……', '他一边吃饭。'), false);
  assert.equal(matchesPattern('因为……所以……', '所以我走了，因为下雨。'), false);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getLessonContent } from './lessonContent.mjs';
test('reviewed material is validated, level matched, and loaded without model generation', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'misu-reviewed-'));
  try {
    fs.mkdirSync(path.join(dir,'lessons-reviewed'));
    fs.writeFileSync(path.join(dir,'lessons-reviewed','unit-1-d1.json'),JSON.stringify({...base,level:'HSK1-2',reviewed:true,review:{reviewer:'Người duyệt thử',date:'2026-10-24'}}));
    const content=await getLessonContent({dataDir:dir,syllabus:{volumes:[{id:'unit',title:'Tự soạn',lessons:[lesson]}]},volumeId:'unit',lessonNo:1,day:1,level:'HSK1-2',provider:'not-used',model:'not-used'});
    assert.equal(content.reviewed,true);
    assert.equal(content.review.reviewer,'Người duyệt thử');
    assert.ok(content.vocab[0].pinyin);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('all bundled original drafts pass structural checks without being marked reviewed', () => {
  const root=path.resolve('lessons/drafts');
  for(const name of fs.readdirSync(root).filter((n)=>n.startsWith('misu-original-'))) {
    const raw=JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
    assert.equal(raw.reviewed,false);
    assert.deepEqual(normalizeLesson(raw,lesson).problems,[],name);
  }
});
