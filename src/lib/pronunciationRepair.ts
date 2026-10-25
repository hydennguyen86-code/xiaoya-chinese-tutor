import type { VoiceResult } from './voiceInput';
export interface RepairState { stage:number; streak:number; complete:boolean }
export function repairStep(state:RepairState,outcome:boolean|null):RepairState {
 if(state.complete||outcome===null)return state;
 if(!outcome)return {...state,streak:0};
 if(state.streak<1)return {...state,streak:state.streak+1};
 return state.stage>=2?{...state,streak:2,complete:true}:{stage:state.stage+1,streak:0,complete:false};
}
export function repairOutcome(result:VoiceResult,target:string,acceptTones?:number[][]):boolean|null {
 const han=(s:string)=>s.replace(/[^\p{Script=Han}]/gu,'');
 if(!result.tones||result.tones.mode==='sentence'||!result.text)return null;
 if(han(result.text)!==han(target))return false;
 const syl=result.tones.syllables;
 if(syl.length!==han(target).length||syl.some(s=>s.ok===null||!s.heard))return null;
 if(acceptTones?.length)return acceptTones.some(t=>t.length===syl.length&&t.every((tone,i)=>tone===syl[i].heard));
 return syl.every(s=>s.ok===true);
}
