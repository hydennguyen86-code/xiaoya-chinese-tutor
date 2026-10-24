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

export function isStyleOnlyEdit(original, corrected) {
  const a = strip(original);
  const b = strip(corrected);
  if (!a || !b || a === b) return true;
  // only a trailing particle added or removed
  if (a.replace(FINAL_PARTICLES, '') === b.replace(FINAL_PARTICLES, '')) return true;
  // only 儿, synonyms or intensifiers changed
  return canonical(a) === canonical(b);
}
