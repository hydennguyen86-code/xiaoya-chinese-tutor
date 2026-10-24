import { spawnSync } from 'node:child_process';
// Deliberately scoped: avoid rewriting unrelated legacy files or course JSON.
const files = [
  'src/components/{Assessment,SetupCheck,CommunicationTask,DailyLesson,CoursePractice,ToneFeedback,ToneEvaluation}.tsx',
  'src/lib/{assessment,voiceInput,lessonApi,lessonPlan,coursePractice}.ts',
  'src/App.tsx',
  'src/lib/{coursePractice,lessonPlan}.test.ts',
  'server/{courseContent,lessonContent,lessonReview,recordings,toneEvaluation,tones}.test.mjs',
  'server/{assessment,index,lessonContent,syllabus,courseContent,tones,toneEvaluation,lessonReview}.mjs',
  'scripts/{format,check-public-assets,review-lesson}.mjs',
  'eval/{tones,recordings,toneItems}.mjs',
];
const result = spawnSync(
  process.execPath,
  [
    'node_modules/prettier/bin/prettier.cjs',
    process.argv.includes('--check') ? '--check' : '--write',
    '--no-error-on-unmatched-pattern',
    ...files,
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
