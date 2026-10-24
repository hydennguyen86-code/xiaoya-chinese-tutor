import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseFingerprint, gradeListening, speechText } from './coursePractice.ts';
test('listening grades use answer keys and unanswered questions do not pass', () => {
  const exercise:any={questions:[{options:['A','B'],answer:1,explanation:'B'},{options:['A','B'],answer:0,explanation:'A'}]};
  assert.equal(gradeListening(exercise,[1]).correct,1);
  assert.equal(gradeListening(exercise,[1,0]).correct,2);
  assert.equal(gradeListening(exercise,[0,1]).correct,0);
});
test('TTS removes turn labels while retaining spoken Chinese', () => {
  assert.equal(speechText('甲：你好！乙：我很好。'),' 你好！ 我很好。');
  assert.equal(speechText('客户：请确认时间。员工：好的。'),' 请确认时间。 好的。');
});

test('editing the answer key invalidates previously saved listening work', () => {
  assert.notEqual(exerciseFingerprint({answer:0}),exerciseFingerprint({answer:1}));
  assert.equal(exerciseFingerprint({answer:0}),exerciseFingerprint({answer:0}));
});
