import { spawnSync } from 'node:child_process';
// Deliberately scoped: avoid rewriting unrelated legacy files or course JSON.
const files = [
  'src/components/{Assessment,SetupCheck,CommunicationTask,DailyLesson,CoursePractice,ToneFeedback,ToneEvaluation,ConnectivitySettings,VoiceSourceNotice,SettingsDialog}.tsx',
  'src/lib/{assessment,voiceInput,lessonApi,lessonPlan,coursePractice,browserVoice,api,avatar,lamAvatar,serverStore}.ts',
  'src/App.tsx',
  'src/main.tsx',
  'src/types.ts',
  'src/lib/{coursePractice,lessonPlan,browserVoice}.test.ts',
  'server/{courseContent,lessonContent,lessonReview,recordings,toneEvaluation,tones,edgeGec,mediaTools,remoteProvider,lanAccess}.test.mjs',
  'server/{assessment,index,lessonContent,syllabus,courseContent,tones,toneEvaluation,lessonReview,edgeGec,mediaTools,remoteProvider,providers,llm,lanAccess,stt}.mjs',
  'scripts/{format,check-public-assets,review-lesson,start,test-edge-live}.mjs',
  'eval/{tones,recordings,toneItems,corrections}.mjs',
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
