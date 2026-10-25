// Deterministic checks for errors Vietnamese speakers commonly make in Mandarin
// (word order and measure words carried over from Vietnamese). They are
// deliberately narrow: each rule only fires on forms that are wrong, and every
// rule has negative tests for the correct look-alikes (住在, 好久没去了, 比较 …).

const HANZI = '\\u4e00-\\u9fff';
const NUM = '[一二两三四五六七八九十几百千0-9]+';

const MEASURE = {
  书: '本',
  本子: '本',
  杂志: '本',
  词典: '本',
  衣服: '件',
  衬衫: '件',
  毛衣: '件',
  事情: '件',
  裤子: '条',
  裙子: '条',
  鱼: '条',
  河: '条',
  路: '条',
  车: '辆',
  汽车: '辆',
  自行车: '辆',
  出租车: '辆',
  纸: '张',
  票: '张',
  桌子: '张',
  床: '张',
  照片: '张',
  地图: '张',
  椅子: '把',
  伞: '把',
  刀: '把',
  笔: '支',
  铅笔: '支',
  猫: '只',
  鸟: '只',
  电脑: '台',
  电视: '台',
  手机: '部',
};

const LANGS = '中文|汉语|英语|越南语|日语|韩语|法语';
const SUBJECTS = '我们|你们|他们|她们|咱们|我|你|他|她';
const TIMES = '明天|昨天|今天|后天|前天|去年|明年|今年|上午|下午|晚上|早上|周末';
// verbs/adjectives that are wrong with a trailing 在+place (住在, 坐在 … are fine)
const PLACE_AFTER = '工作|学习|吃饭|吃早饭|吃午饭|吃晚饭|看书|见面|上课|上班|休息|玩|做饭|买东西|喝咖啡|等你|等我';
const FEELINGS = '(?:很|非常|特别|太|有点儿?)?(?:忙|累|开心|高兴|快乐|无聊)';

function fix(original, corrected, explanation, category) {
  return { original, corrected, explanation, category };
}

const RULES = [
  // 三个书 → 三本书
  (text) => {
    const nouns = Object.keys(MEASURE)
      .sort((a, b) => b.length - a.length)
      .join('|');
    const m = text.match(new RegExp(`(${NUM})个(${nouns})`));
    if (!m) return null;
    const right = MEASURE[m[2]];
    return fix(m[0], `${m[1]}${right}${m[2]}`, `"${m[2]}" dùng lượng từ ${right}, không dùng 个.`, 'measure_word');
  },
  // 他比我很高 → 他比我高   (not 比较 / 比赛 / 比如 / 比方)
  (text) => {
    const m = text.match(new RegExp(`比(?!较|赛|如|方|例)([${HANZI}]{1,8}?)(很|非常|特别|十分)([${HANZI}])`));
    if (
      !m ||
      text
        .slice(m.index)
        .split(/[，。！？,.!?]/)[0]
        .includes('的')
    )
      return null;
    return fix(
      m[0],
      `比${m[1]}${m[3]}`,
      `Câu so sánh với 比 không dùng ${m[2]}; nói "比…+ tính từ" (muốn nhấn mạnh dùng 更 hoặc 还).`,
      'grammar',
    );
  },
  // 我没有去了学校 → 我没有去学校   (not 好久没去了 / 没有办法了)
  (text) => {
    const m = text.match(new RegExp(`(没有?)(去|来|吃|喝|看|买|做|写|说|听|学|回|到|见|找|打)了([${HANZI}])`));
    if (!m) return null;
    // a duration right before 没 (好久没去了 / 三天没吃了) is a different structure;
    // a bare time word like 昨天 is not
    const before = text.slice(0, m.index);
    if (/(久|几天|多天|几年|几个月|好几天|长时间|[一二两三四五六七八九十几]+(天|年|个月|周|个星期))$/.test(before)) return null;
    return fix(`${m[1]}${m[2]}了`, `${m[1]}${m[2]}`, 'Câu phủ định với 没(有) không dùng 了 sau động từ.', 'grammar');
  },
  // 我会说中文一点儿 → 我会说一点儿中文   (not 说中文一点儿也不累: 一点儿也/都不 is fine)
  (text) => {
    const m = text.match(new RegExp(`(说|讲|学|懂|会)(${LANGS})(一点儿?)(?![儿也都还不])`));
    if (!m) return null;
    return fix(m[0], `${m[1]}${m[3]}${m[2]}`, `${m[3]} đứng trước tân ngữ: ${m[1]}${m[3]}${m[2]}.`, 'word_order');
  },
  // 我很忙在公司 / 我工作在银行 → 在公司很忙 / 在银行工作
  (text) => {
    // a final particle (吧/吗/呢 …) is not part of the place
    const m = text.match(new RegExp(`(${FEELINGS}|${PLACE_AFTER})在([${HANZI}]{1,6}?)(?=[吧吗呢啊呀了]?(?:[，。！？,.!?]|$))`));
    if (!m) return null;
    if (m[2].includes('的')) return null;
    // a bare 忙/累… may be the end of a compound (帮忙在银行): only take it after a
    // subject or an adverb, or when it carries its own intensifier
    if (new RegExp(`^(?:${FEELINGS})$`).test(m[1]) && !/^(很|非常|特别|太|有点)/.test(m[1])) {
      const prev = text[m.index - 1];
      if (prev && /\p{Script=Han}/u.test(prev) && !/[我你他她们也都不还又就真]/.test(prev)) return null;
    }
    return fix(
      m[0],
      `在${m[2]}${m[1]}`,
      'Trạng ngữ nơi chốn "在 + nơi" đứng trước động từ / tính từ, không đặt sau như tiếng Việt.',
      'word_order',
    );
  },
  // 我们见面明天 → 我们明天见面
  (text) => {
    const m = text.match(new RegExp(`^(${SUBJECTS})([${HANZI}]{1,10}?)(${TIMES})([。！？!?]?)$`));
    if (!m) return null;
    const middle = m[2];
    if (new RegExp(TIMES).test(middle) || /(是|在|到|等|从|喜欢|定|改|选|过|的|知道|希望|觉得|认为|相信|担心|听说|记得|忘记|忘了|打算|安排|决定|发现|说明|准备|计划|想|要)$/.test(middle)) return null;
    return fix(
      `${m[1]}${middle}${m[3]}`,
      `${m[1]}${m[3]}${middle}`,
      'Từ chỉ thời gian đứng trước động từ (sau chủ ngữ), không đặt cuối câu.',
      'word_order',
    );
  },
  // 我是昨天来 → 我是昨天来的   (是…的 for time/place of a past action)
  (text) => {
    const m = text.match(
      new RegExp(
        `(${SUBJECTS})(是)(昨天|今天|前天|去年|今年|上个月|上个星期|上周|在[^，。！？]{1,8}|跟[^，。！？]{1,8})(来|去|到|回|出生|买|做|学|见)([。！？!?]?)$`,
      ),
    );
    if (!m) return null;
    return fix(m[0], `${m[1]}是${m[3]}${m[4]}的${m[5]}`, 'Câu 是…的 nhấn mạnh thời gian/nơi chốn phải kết thúc bằng 的.', 'grammar');
  },
  // 我去也 / 我吃饭也 → 我也去 / 我也吃饭   (adverbs before the verb)
  (text) => {
    const m = text.match(
      new RegExp(
        `^(${SUBJECTS})(去|来|吃|喝|看|买|做|说|学|工作|休息|睡觉)([^也都常经已正一，。！？]{0,6})(也|都|常常|经常|已经|正在|一直)([。！？!?]?)$`,
      ),
    );
    if (!m) return null;
    return fix(m[0], `${m[1]}${m[4]}${m[2]}${m[3]}${m[5]}`, `Phó từ "${m[4]}" đứng trước động từ, không đứng sau.`, 'word_order');
  },
];

export const activeRules = RULES.map((apply, index) => ({
  id: [
    'legacy-measure',
    'comparative-guarded',
    'negative-le',
    'language-amount',
    'place-guarded',
    'time-order',
    'deepseek-shi-de',
    'deepseek-adverb-order',
  ][index],
  apply,
}));

/** Corrections found by the rules for one learner sentence. */
export function ruleCorrections(sentence) {
  const text = String(sentence ?? '').trim();
  if (!text) return [];
  const found = [];
  for (const rule of RULES) {
    const hit = rule(text);
    if (hit && text.includes(hit.original)) found.push(hit);
  }
  return found;
}

/** Rule hits first, then model corrections that do not touch the same words. */
export function mergeCorrections(ruleHits, modelHits, limit = 2) {
  const out = [...ruleHits];
  for (const item of modelHits) {
    const overlaps = out.some(
      (r) => r.original.includes(item.original) || item.original.includes(r.original) || sharedRun(r.original, item.original) >= 2,
    );
    if (!overlaps) out.push(item);
  }
  return out.slice(0, limit);
}

function sharedRun(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k += 1;
      best = Math.max(best, k);
    }
  }
  return best;
}
