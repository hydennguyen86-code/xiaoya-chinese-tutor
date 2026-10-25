import type {VoiceResult} from './voiceInput';
export function retainSpokenTurn(current:Record<string,VoiceResult>,id:string,result:VoiceResult):Record<string,VoiceResult>{
 if(!result.audio||result.audio.size>15_000_000||!result.text.trim())return current;
 const next={...current,[id]:result};
 for(const old of Object.keys(next).slice(0,-10))delete next[old];
 return next;
}
