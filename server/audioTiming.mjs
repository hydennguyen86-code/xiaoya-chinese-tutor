// Advisory timing only; does not alter pitch thresholds or syllable segmentation.
export function energyTiming(pcm, sampleRate=16000) {
 const hop=Math.max(1,Math.round(sampleRate*.02)), frames=[];
 for(let i=0;i<pcm.length;i+=hop){let sum=0;for(let j=i;j<Math.min(i+hop,pcm.length);j++)sum+=pcm[j]*pcm[j];frames.push(Math.sqrt(sum/Math.min(hop,pcm.length-i)));}
 const peak=frames.reduce((peak,r)=>Math.max(peak,r),0), threshold=Math.max(.01,peak*.12);
 const active=frames.map(r=>r>threshold), first=active.indexOf(true), last=active.lastIndexOf(true);
 if(first<0)return null;
 const pauses=[];let start=-1;
 for(let i=first;i<=last;i++){if(!active[i]&&start<0)start=i;if(active[i]&&start>=0){if((i-start)*.02>1)pauses.push({start:start*.02,end:i*.02});start=-1;}}
 return {duration:pcm.length/sampleRate,speechStart:first*.02,speechEnd:Math.min((last+1)*.02,pcm.length/sampleRate),voicedSeconds:active.filter(Boolean).length*.02,pauses};
}
