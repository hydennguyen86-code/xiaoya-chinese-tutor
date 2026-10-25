import { bundledSyllabus } from './courseContent.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Course outline for 《体验汉语口语》 (Experiencing Chinese: Oral Course).
// Only the table of contents is stored (volume, lesson number, lesson title,
// topics, pages) — never dialogues or texts from the book. The real outline is
// typed in by the user at data/syllabus/tiyan-hanyu-kouyu.json; until then a
// clearly-marked placeholder of everyday topics is used.

export const SYLLABUS_FILE = path.join('syllabus', 'tiyan-hanyu-kouyu.json');
const LEVELS = ['HSK1-2', 'HSK3-4', 'HSK5-6', 'free'];

function cleanStr(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value, max = 20, itemMax = 60) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanStr(item, itemMax))
        .filter(Boolean)
        .slice(0, max)
    : [];
}

export function validateSyllabus(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.volumes) || !raw.volumes.length) {
    throw new Error('Mục lục cần có "volumes" là một mảng không rỗng.');
  }
  const ids = new Set();
  const volumes = raw.volumes.map((vol, vi) => {
    const id = cleanStr(vol?.id, 40).replace(/[^A-Za-z0-9_-]/g, '');
    if (!id) throw new Error(`Tập thứ ${vi + 1} thiếu "id" (chỉ chữ, số, - và _).`);
    if (ids.has(id)) throw new Error(`Trùng id tập "${id}".`);
    ids.add(id);
    const levels = cleanList(vol.levels, 4, 10).filter((level) => LEVELS.includes(level));
    if (!Array.isArray(vol.lessons) || !vol.lessons.length) {
      throw new Error(`Tập "${id}" chưa có bài nào.`);
    }
    const lessons = vol.lessons.map((lesson, li) => {
      const no = Number(lesson?.no);
      const title = cleanStr(lesson?.title);
      if (!Number.isInteger(no) || no < 1) throw new Error(`Tập "${id}", bài thứ ${li + 1}: "no" phải là số nguyên ≥ 1.`);
      if (!title) throw new Error(`Tập "${id}", bài ${no}: thiếu "title".`);
      const days = Number.isInteger(lesson.days) && lesson.days >= 1 && lesson.days <= 5 ? lesson.days : 2;
      return {
        no,
        title,
        pages: cleanStr(lesson.pages, 20),
        topics: cleanList(lesson.topics, 6),
        vocab: Array.isArray(lesson.vocab)
          ? lesson.vocab
              .map((item) =>
                typeof item === 'string'
                  ? { word: cleanStr(item, 12) }
                  : { word: cleanStr(item?.word, 12), meaning: cleanStr(item?.meaning, 60) },
              )
              .filter((item) => item.word)
              .slice(0, 16)
          : [],
        patterns: cleanList(lesson.patterns, 4, 40),
        days,
      };
    });
    lessons.sort((a, b) => a.no - b.no);
    return {
      id,
      title: cleanStr(vol.title, 40) || id,
      levels: levels.length ? levels : [...LEVELS],
      lessons,
      authored: Boolean(vol.authored),
      trackId: cleanStr(vol.trackId, 40),
      trackTitle: cleanStr(vol.trackTitle, 100),
      nextVolumeId: cleanStr(vol.nextVolumeId, 40).replace(/[^A-Za-z0-9_-]/g, ''),
      targetLevel: cleanStr(vol.targetLevel, 20),
    };
  });
  return { book: cleanStr(raw.book, 100) || '体验汉语口语', volumes, placeholder: false, authored: Boolean(raw.authored) };
}

// Everyday topics chosen by us, not taken from the book.
function placeholderVolume(id, title, levels, topics) {
  return {
    id,
    title,
    levels,
    lessons: topics.map(([vi, zh], i) => ({
      no: i + 1,
      title: `Chủ đề tạm: ${vi}`,
      pages: '',
      topics: [vi, zh],
      vocab: [],
      patterns: [],
      days: 2,
    })),
  };
}

export const PLACEHOLDER_SYLLABUS = {
  book: '体验汉语口语',
  placeholder: true,
  volumes: [
    placeholderVolume(
      'tam-so-cap',
      'Sơ cấp (tạm)',
      ['HSK1-2'],
      [
        ['chào hỏi, giới thiệu bản thân', '问候与介绍'],
        ['gia đình', '家庭'],
        ['số đếm, thời gian', '时间'],
        ['mua đồ ở chợ', '买东西'],
        ['gọi món ăn', '点菜'],
        ['hỏi đường', '问路'],
        ['thời tiết', '天气'],
        ['sở thích', '爱好'],
      ],
    ),
    placeholderVolume(
      'tam-trung-cap',
      'Trung cấp (tạm)',
      ['HSK3-4'],
      [
        ['đặt phòng khách sạn', '订房间'],
        ['đi khám bệnh', '看病'],
        ['thuê nhà', '租房子'],
        ['ở ngân hàng', '在银行'],
        ['lên kế hoạch du lịch', '旅行计划'],
        ['mời bạn đi ăn', '请客吃饭'],
        ['phàn nàn và xin lỗi', '投诉和道歉'],
        ['phỏng vấn xin việc', '面试'],
      ],
    ),
    placeholderVolume(
      'tam-cao-cap',
      'Cao cấp (tạm)',
      ['HSK5-6', 'free'],
      [
        ['công việc và áp lực', '工作与压力'],
        ['giáo dục con cái', '子女教育'],
        ['sức khỏe và lối sống', '健康生活'],
        ['công nghệ trong đời sống', '科技与生活'],
        ['văn hoá và phong tục', '文化习俗'],
        ['môi trường', '环境保护'],
        ['đàm phán, thương lượng', '谈判'],
        ['kể chuyện, chia sẻ trải nghiệm', '分享经历'],
      ],
    ),
  ],
};

export function loadSyllabus(dataDir) {
  const file = path.join(dataDir, SYLLABUS_FILE);
  if (!fs.existsSync(file)) {
    return validateSyllabus(bundledSyllabus());
  }
  try {
    return validateSyllabus(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    return { ...PLACEHOLDER_SYLLABUS, warning: `Mục lục sách bị lỗi (${error.message}); đang dùng chủ đề tạm.` };
  }
}

export function findLesson(syllabus, volumeId, lessonNo) {
  const volume = syllabus.volumes.find((vol) => vol.id === volumeId);
  const lesson = volume?.lessons.find((item) => item.no === lessonNo);
  return volume && lesson ? { volume, lesson } : null;
}
