import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDue, score, planWeekly, planMonthly, emptyAssessment, taskLabel } from './assessment.ts';
const now = Date.UTC(2026,9,24), day = 86400000;
const profile: any = { words: [{word:'吃饭',meaning:'ăn cơm',pinyin:'chī fàn',lastSeen:now,dueAt:now}],mistakes:[],days:[],reports:[] };
test('week due after three new sessions or seven days, monthly after thirty days', () => {
  assert.equal(isDue('week',[],3,now,now),true);
  assert.equal(isDue('week',[],0,now-7*day,now),true);
  assert.equal(isDue('month',[],10,now-29*day,now),false);
  assert.equal(isDue('month',[],0,now-30*day,now),true);
  assert.equal(isDue('week',[{kind:'week',completedAt:now,sessionCount:3} as any],5,now,now),false);
});
test('empty sections do not create a false zero or divide by zero', () => {
  assert.equal(score({tones:{earned:0,total:0}}),null);
  assert.equal(score({words:{earned:2,total:4},tones:{earned:0,total:0}}),50);
});
test('plans use actual learner material and work with sparse histories', () => {
  const data=emptyAssessment();
  assert.equal(planWeekly(profile,data,now).words[0].word,'吃饭');
  assert.equal(planMonthly(profile,data,now).open,true);
  assert.equal(planWeekly({...profile, words:[]},data,now).words.length,0);
});
test('helped goals are never reported as independent mastery', () => {
  assert.equal(taskLabel({goal:'a',status:'done',evidence:'a',helped:true}),'Làm được khi có gợi ý');
  assert.equal(taskLabel({goal:'a',status:'partly',evidence:'a',helped:false}),'Cần luyện lại');
});

test('overdue old vocabulary is still tested even when not seen this week', () => {
  const old={...profile.words[0],lastSeen:now-40*day,dueAt:now-day};
  assert.equal(planWeekly({...profile,words:[old]},emptyAssessment(),now).words[0].word,'吃饭');
});
