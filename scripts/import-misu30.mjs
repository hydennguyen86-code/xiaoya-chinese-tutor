// Convert the user's AI curriculum, not textbook material. No audio is imported.
// Usage: node scripts/import-misu30.mjs <curriculum directory>
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pinyinCitation } from '../server/coursePinyin.mjs';
import { normalizeLesson } from '../server/lessonContent.mjs';
const source = process.argv[2];
if (!source) throw new Error('Pass the curriculum directory.');
const root = new URL('../lessons/courses/', import.meta.url);
const syllabus = JSON.parse(fs.readFileSync(new URL('syllabus.json', root), 'utf8'));
const title = '30 bài giao tiếp HSK1–6';
const volumes = [],
  prepared = [];
for (let v = 1; v <= 3; v++) {
  const bytes = fs.readFileSync(path.join(source, `volume-${v}.json`));
  const input = JSON.parse(bytes);
  if (input.lessons.length !== 10) throw new Error('Each volume must have 10 lessons.');
  const id = `misu30-${v}`;
  const volume = {
    id,
    title: `30 bài giao tiếp · Tập ${v} · ${input.levels[0].replace('-', '–')}`,
    levels: input.levels,
    authored: true,
    targetLevel: input.levels[0],
    trackId: 'misu30',
    trackTitle: title,
    ...(v < 3 ? { nextVolumeId: `misu30-${v + 1}` } : {}),
    source: { file: `curriculum/volume-${v}.json`, sha256: createHash('sha256').update(bytes).digest('hex') },
    lessons: input.lessons.map((l) => ({
      no: l.no,
      title: l.title,
      topics: l.topics,
      days: 1,
      vocab: l.vocab.map((w) => ({ word: w.word, meaning: w.meaning })),
      patterns: l.patterns.map((p) => p.pattern),
    })),
  };
  volumes.push(volume);
  for (const [index, lesson] of input.lessons.entries()) {
    if (lesson.no !== (v - 1) * 10 + index + 1) throw new Error('Lessons must be numbered 1–30.');
    const words = lesson.vocab;
    // Recognition of the source example, with distractors from this lesson only.
    const questions = words.slice(0, 3).map((word, q) => {
      const wrong = words
        .filter((w) => w.meaning !== word.meaning)
        .slice(q + 1, q + 3)
        .map((w) => w.meaning);
      if (wrong.length < 2) throw new Error('Not enough distinct distractors.');
      const answer = (lesson.no + q) % 3,
        options = [...wrong];
      options.splice(answer, 0, word.meaning);
      return {
        prompt: `Cụm “${word.word}” trong đoạn nghe có nghĩa gì?`,
        options,
        answer,
        explanation: `“${word.word}”: ${word.meaning}. Ví dụ đã nghe: ${word.example}`,
      };
    });
    const transcript = words
      .slice(0, 3)
      .map((w) => w.example)
      .join(' ');
    const raw = {
      volumeId: id,
      volumeTitle: volume.title,
      lessonNo: lesson.no,
      lessonTitle: lesson.title,
      day: 1,
      days: 1,
      level: input.levels[0],
      targetLevel: input.levels[0],
      trackTitle: title,
      authored: true,
      reviewed: false,
      placeholder: false,
      editorialStatus: 'AI soạn, chưa duyệt',
      recommendedMinutes: 20,
      source: volume.source,
      vocab: words.map((w) => ({ ...w, pinyin: pinyinCitation(w.word), examplePinyin: pinyinCitation(w.example) })),
      patterns: lesson.patterns.map((p) => ({ ...p, examplePinyin: pinyinCitation(p.example) })),
      roleplay: lesson.roleplay,
      freeTalk: lesson.freeTalk,
      prerequisites: lesson.no > 1 ? [lesson.no - 1] : [],
      learningNotes: [
        'AI soạn, chưa duyệt. Mức HSK là định hướng chủ đề, chưa đối chiếu đầy đủ danh sách từ hay đề thi chính thức.',
        'Bài nghe nhận nghĩa dùng câu ví dụ của bài. Hãy áp dụng vào nhập vai rồi tự đổi thông tin.',
      ],
      listening: {
        title: 'Nghe ví dụ thực tế',
        playLimit: 2,
        transcript,
        translation: words
          .slice(0, 3)
          .map((w) => w.exampleVi)
          .join(' '),
        pinyin: pinyinCitation(transcript),
        questions,
      },
      speaking: [
        {
          kind: 'repeat',
          prompt: 'Nghe rồi nhắc lại câu ví dụ, sau đó đổi thông tin cho phù hợp với bạn.',
          prepareSeconds: 15,
          responseSeconds: 30,
          audioText: words[0].example,
          reference: words[0].example,
          pinyin: pinyinCitation(words[0].example),
          checklist: ['Giữ thông tin chính', 'Nói rõ để người nghe hiểu', 'Tự thay ít nhất một thông tin khi thử lại'],
        },
        {
          kind: 'answer',
          prompt: lesson.freeTalk.question,
          promptVi: lesson.freeTalk.questionVi,
          prepareSeconds: 20,
          responseSeconds: 60,
          reference: 'Không có một đáp án duy nhất. Dùng mẫu của bài để nói về hoàn cảnh của bạn.',
          checklist: ['Trả lời đúng việc được hỏi', 'Dùng ít nhất một mẫu của bài', 'Nêu chi tiết cụ thể'],
        },
      ],
      transferTask: `Đổi tên, địa điểm hoặc thời gian trong tình huống: ${lesson.roleplay.setting}`,
    };
    const problems = normalizeLesson(raw, volume.lessons[index]).problems;
    if (problems.length) throw new Error(`${id}/${lesson.no}: ${problems.join('; ')}`);
    prepared.push([`${id}-${lesson.no}-d1.json`, raw]);
  }
}
// Validate everything before writing any file.
for (const [name, raw] of prepared) fs.writeFileSync(new URL(name, root), JSON.stringify(raw, null, 2) + '\n');
syllabus.volumes = [...syllabus.volumes.filter((v) => v.trackId !== 'misu30'), ...volumes];
syllabus.book = 'Misu · Nghe nói thực tế và 30 bài giao tiếp HSK1–6';
fs.writeFileSync(new URL('syllabus.json', root), JSON.stringify(syllabus, null, 2) + '\n');
console.log('Imported 30 AI draft sessions; all structural validators passed.');
