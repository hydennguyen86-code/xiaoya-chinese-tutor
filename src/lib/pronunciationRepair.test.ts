import {test} from 'node:test';import assert from 'node:assert/strict';import {repairOutcome,repairStep} from './pronunciationRepair.ts';
test('each repair stage requires two consecutive clear matches; unclear cannot advance and mistakes reset streak',()=>{
 let state={stage:0,streak:0,complete:false};state=repairStep(state,true);assert.equal(repairStep(state,null).streak,1);assert.equal(repairStep(state,false).streak,0);state=repairStep(state,true);assert.equal(state.stage,1);for(let i=0;i<4;i++)state=repairStep(state,true);assert.ok(state.complete);
 assert.equal(repairOutcome({text:'',tones:null},'好'),null);assert.equal(repairOutcome({text:'你好',tones:{mode:'sentence',syllables:[],correct:0,checked:0}},'你好'),null);
});
