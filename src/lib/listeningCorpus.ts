import { pinyin } from 'pinyin-pro';
export interface CommunityClip {
  id: string;
  text: string;
  version: string;
  sourceUrl?: string;
  difficulty?: 'basic' | 'extended';
  vocabularyBasis?: string;
  license: string;
}
const han = (value: string) => [...value].filter((ch) => /\p{Script=Han}/u.test(ch));
export function compareDictation(expected: string, answer: string) {
  const chars = han(expected);
  const chinese = /\p{Script=Han}/u.test(answer);
  const actual = chinese ? han(answer) : answer.toLowerCase().replace(/ü/g, 'v').replace(/[1-5]/g, '').trim().split(/\s+/).filter(Boolean);
  const target = chinese ? chars : pinyin(chars.join(''), { toneType: 'none', type: 'array', v: true });
  // Edit distance alignment keeps one omission from falsely shifting every later character.
  const dp = Array.from({ length: target.length + 1 }, () => Array<number>(actual.length + 1).fill(0));
  for (let i = 0; i <= target.length; i++) dp[i][0] = i;
  for (let j = 0; j <= actual.length; j++) dp[0][j] = j;
  for (let i = 1; i <= target.length; i++)
    for (let j = 1; j <= actual.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + Number(target[i - 1] !== actual[j - 1]));
  const result: { expected: string; actual: string; ok: boolean }[] = [];
  let i = target.length,
    j = actual.length;
  while (i || j) {
    if (i && j && dp[i][j] === dp[i - 1][j - 1] + Number(target[i - 1] !== actual[j - 1])) {
      result.unshift({ expected: chars[i - 1], actual: actual[j - 1], ok: target[i - 1] === actual[j - 1] });
      i--;
      j--;
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) {
      result.unshift({ expected: chars[i - 1], actual: '', ok: false });
      i--;
    } else {
      result.unshift({ expected: '', actual: actual[j - 1], ok: false });
      j--;
    }
  }
  return result;
}
