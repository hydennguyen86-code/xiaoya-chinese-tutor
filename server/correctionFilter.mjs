// Guards against "corrections" that only change style. A small local model
// likes to swap synonyms (说→讲), intensifiers (很→非常), drop 儿 or a final
// particle (吧), none of which makes the learner's sentence wrong.

const INTENSIFIERS = ['很', '非常', '挺', '特别', '十分', '真', '太', '蛮', '相当'];
const SYNONYM_SETS = [
  ['说', '讲'],
  ['和', '跟', '与', '同'],
  ['但是', '可是', '不过', '但'],
  ['因为', '由于'],
  ['所以', '因此'],
  ['已经', '已'],
  ['觉得', '认为', '感觉'],
  ['一些', '一点', '一点儿', '有点', '有点儿'],
  ['怎么样', '如何'],
  ['还是', '或者'],
  ['马上', '立刻', '立即'],
];
const FINAL_PARTICLES = /[吧呢啊呀啦嘛哦哈吗了]+$/u;
const PUNCT = /[\s，。！？、；：,.!?;:“”"'‘’…（）()《》]/gu;

function strip(text) {
  return String(text ?? '').replace(PUNCT, '');
}

function canonical(text) {
  let t = strip(text).replace(/儿/g, '');
  for (const set of SYNONYM_SETS) {
    for (const word of [...set].sort((a, b) => b.length - a.length)) {
      t = t.split(word).join(set[0]);
    }
  }
  for (const word of [...INTENSIFIERS].sort((a, b) => b.length - a.length)) {
    t = t.split(word).join('很');
  }
  return t;
}

function droppedIntensifier(a, b) {
  // 挺大的 / 很大的 → 大: the intensifier and a trailing 的 both go
  const bare = (t) => INTENSIFIERS.reduce((acc, w) => acc.split(w).join(''), t).replace(/的$/, '');
  if (a !== b && bare(a) === bare(b)) return true;
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  for (const word of INTENSIFIERS) {
    let at = longer.indexOf(word);
    while (at >= 0) {
      if (longer.slice(0, at) + longer.slice(at + word.length) === shorter) return true;
      at = longer.indexOf(word, at + 1);
    }
  }
  return false;
}

/**
 * True when the "correction" only changes style. `sentence` is the learner's
 * whole sentence: dropping 很 is a real fix only in a 比 comparison.
 */
export function isStyleOnlyEdit(original, corrected, sentence = '') {
  const a = strip(original);
  const b = strip(corrected);
  if (!a || !b || a === b) return true;
  if (droppedIntensifier(a, b) && !/比(?!较|赛|如|方|例)/.test(`${sentence}${original}`)) return true;
  // only a trailing particle added or removed
  if (a.replace(FINAL_PARTICLES, '') === b.replace(FINAL_PARTICLES, '')) return true;
  // only 儿, synonyms or intensifiers changed
  return canonical(a) === canonical(b);
}
