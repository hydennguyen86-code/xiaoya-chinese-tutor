import type { ListeningExercise } from './lessonApi';

/** Only objectively keyed listening items are scored automatically. */
export function gradeListening(exercise: ListeningExercise, answers: number[]) {
  const items = exercise.questions.map((question, index) => ({
    correct: Number.isInteger(answers[index]) && answers[index] === question.answer,
    answer: question.options[question.answer],
    explanation: question.explanation,
  }));
  return { correct: items.filter((item) => item.correct).length, total: items.length, items };
}
export function speechText(transcript: string) {
  // A single TTS voice reads the turns; don't pronounce the written speaker labels.
  return transcript.replace(/(^|[。？！])\s*[\p{Script=Han}]{1,6}：/gu, '$1 ');
}

export function exerciseFingerprint(value: unknown) {
  let hash = 2166136261;
  for (const char of JSON.stringify(value)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(36);
}
