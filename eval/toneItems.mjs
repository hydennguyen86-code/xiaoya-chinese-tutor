export const SYLLABLES = {
  1: '妈八衣汤诗温天方书飞',
  2: '麻拔姨糖十文甜房熟肥',
  3: '马把椅躺使稳舔访鼠匪',
  4: '骂爸意烫是问店放树费',
};
export const WORDS = [
  '中国',
  '学习',
  '汉语',
  '老师',
  '银行',
  '工作',
  '电脑',
  '飞机',
  '回家',
  '地铁',
  '北京',
  '上海',
  '手机',
  '音乐',
  '周末',
  '咖啡',
];
export const TONE_ITEMS = [
  ...Object.entries(SYLLABLES).flatMap(([tone, chars]) =>
    [...chars].map((text, i) => ({ id: `single-${tone}-${i + 1}`, text, kind: 'single' })),
  ),
  ...WORDS.map((text, i) => ({ id: `word-${i + 1}`, text, kind: 'word' })),
];
