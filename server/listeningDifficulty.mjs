import fs from 'node:fs';

// App course vocabulary, not an official/exhaustive HSK vocabulary list.
const common = `我 你 您 他 她 它 我们 你们 他们 她们 自己 大家 这 那 这个 那个 这里 那里 哪 哪里 谁 什么 为什么 怎么 怎么样 怎样 多少 几 一 二 三 四 五 六 七 八 九 十 两 个 些 本 杯 瓶 碗 张 件 次 的 地 得 了 过 着 吗 呢 吧 啊 呀 哦 和 跟 与 但 但是 因为 所以 如果 就 也 都 还 又 再 很 太 真 真的 最 更 比 没 没有 不 别 已经 正在 一起 一点 有点 一下 一直 一定 可能 可以 能 会 要 想 得到 是 有 在 去 来 回 到 让 给 把 被 对 从 向 离 为 为了 用 叫 说 讲 听 看 读 写 问 答 知道 觉得 以为 明白 懂 忘了 忘记 记得 认识 看到 看见 听到 出来 进去 出去 回来 回去 起来 住 坐 走 跑 开 关 做 带 拿 找 放 帮 帮忙 等 送 买 卖 吃 喝 喜欢 爱 谢谢 请 对不起 没关系 好 好的 行 不行 对 错 是的 不是 没事 好吧 你好 再见 见 早 晚 早上 晚上 上午 下午 中午 今天 明天 昨天 现在 时候 时间 时候 到时候 刚 才 马上 后 前 以后 之前 之后 每天 星期 周 年 月 日 天 点 分 分钟 小时 晚点 早点 家 回家 学校 公司 工作 上班 下班 上学 老师 学生 同学 朋友 男朋友 女朋友 爸爸 妈妈 父亲 母亲 孩子 儿子 女儿 阿姨 人 男人 女人 东西 事 事情 问题 办法 原因 意思 结果 事情 饭 早餐 午饭 晚饭 水 茶 咖啡 苹果 菜 水果 面 米饭 钱 车 出租车 公交 地铁 站 出站 进站 票 位子 座位 这里 里面 外面 上面 下面 楼下 房间 医生 看病 生病 看医生 医院 电话 手机 电脑 衣服 买东西 休息 睡觉 起床 身体 天气 下雨 冷 热 高兴 开心 快乐 累 忙 大 小 多 少 长 短 快 慢 新 旧 贵 便宜 远 近 方便 容易 难 一样 这样 那样 这么 那么 还有 然后 不过 还是 或者 虽然 可是 只 只是 只有 只要 需要 希望 觉得 认为 相信 同意 完成 准备 开始 结束 帮手 进 来到 分手 哭 整个 晚上 约 家乡 看看 知不知道 不知道 不可以 可以的`;
const encyclopedia =
  /出生|生于|逝世|去世|可以指|可指|位于|境内|县|乡|省|市|王朝|皇帝|政党|政治|战争|抗战|军事|坦克|集团|机构|公司成立|成立于|担任|曾任|公元|世纪|法医学|疾病|药物|化学|反应|定义|分类|理论|三段论|服务器|比特币|货币|算法|宗教|祈祷|信仰|教堂|皇室|演员|歌手|演唱会|文艺|群众|地球|星系|物种|平方|公里|史料|以下简称|以下简称|他说|她说/;
const everyday =
  /我|你|您|咱|请|谢谢|对不起|早上|晚上|今天|明天|昨天|早餐|午饭|晚饭|吃饭|喝水|咖啡|买菜|买东西|回家|上班|下班|学校|医院|医生|睡觉|起床|车站|出站|进站|地铁|公交|天气|下雨|多少钱/;
function vocabulary() {
  const basic = new Set(common.trim().split(/\s+/));
  const advanced = new Set(basic);
  const root = new URL('../lessons/courses/', import.meta.url);
  for (const file of fs.readdirSync(root).filter((f) => /^hsk[15]-.*\.json$/.test(f))) {
    const lesson = JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'));
    for (const entry of lesson.vocab || []) {
      advanced.add(entry.word);
      if (file.startsWith('hsk1-')) basic.add(entry.word);
    }
  }
  return { basic, advanced };
}
const words = vocabulary();
function coverage(text, vocab) {
  const chars = text.replace(/[^\p{Script=Han}]/gu, '');
  let unknown = 0;
  for (let i = 0; i < chars.length;) {
    let length = Math.min(8, chars.length - i);
    while (length && !vocab.has(chars.slice(i, i + length))) length--;
    if (!length) {
      unknown++;
      i++;
    } else i += length;
  }
  return { chars: chars.length, unknown };
}
export function listeningDifficulty(text) {
  if (!/^[\p{Script=Han}\s，。！？、；：,.!?]+$/u.test(text) || encyclopedia.test(text) || !everyday.test(text)) return null;
  const basic = coverage(text, words.basic);
  if (basic.chars < 2 || basic.chars > 24) return null;
  if (basic.chars <= 16 && basic.unknown === 0)
    return { difficulty: 'basic', vocabularyBasis: 'app-hsk1-practical+common', unknownChars: 0 };
  const advanced = coverage(text, words.advanced);
  if (advanced.unknown === 0) return { difficulty: 'extended', vocabularyBasis: 'app-hsk1+hsk5-practical+common', unknownChars: 0 };
  return null;
}
