// Deterministic rule evaluation. This does NOT measure the LLM correction pipeline.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { activeRules, ruleCorrections } from '../server/grammarRules.mjs';
import { candidateRules } from './candidates/grammar-deepseek.mjs';
import { ruleCorrections as baseline } from './candidates/grammar-baseline.mjs';
import { saveResult } from './record.mjs';
const cases = JSON.parse(fs.readFileSync(new URL('./corrections.json', import.meta.url), 'utf8'));
export function evaluate(corrector) {
  const falseCorrections = cases.correct.flatMap((text) => {
    const hits = corrector(text);
    return hits.length ? [{ text, hits }] : [];
  });
  const wrong = cases.wrong.map(([text, expected]) => {
    const hits = corrector(text);
    return {
      text,
      expected,
      detected: hits.length > 0,
      fixed: hits.some((c) => text.replace(c.original, c.corrected).includes(expected) || c.corrected.includes(expected)),
    };
  });
  return {
    correctSentences: cases.correct.length,
    wrongSentences: cases.wrong.length,
    falseCorrections: falseCorrections.length,
    falseCorrectionDetails: falseCorrections,
    detected: wrong.filter((c) => c.detected).length,
    fixed: wrong.filter((c) => c.fixed).length,
    missed: wrong.filter((c) => !c.fixed),
  };
}
const candidateAudit = candidateRules.map((apply, index) => ({
  rule: index + 1,
  ...evaluate((text) => {
    const hit = apply(text);
    return hit ? [hit] : [];
  }),
}));
const activeAudit = activeRules.map(({ id, apply }) => ({
  id,
  ...evaluate((text) => {
    const hit = apply(text);
    return hit ? [hit] : [];
  }),
}));
const result = {
  scope: 'deterministic rules only; AI-authored benchmark, no human-reviewed accuracy claim',
  baseline: evaluate(baseline),
  candidateAudit,
  activeAudit,
  final: evaluate(ruleCorrections),
};
result.sourceHashes = Object.fromEntries(
  ['../server/grammarRules.mjs', './corrections.json', './candidates/grammar-deepseek.mjs', './candidates/grammar-baseline.mjs'].map(
    (file) => [
      file,
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(new URL(file, import.meta.url)))
        .digest('hex'),
    ],
  ),
);
console.log(
  JSON.stringify(
    {
      baseline: { falseCorrections: result.baseline.falseCorrections, detected: result.baseline.detected, fixed: result.baseline.fixed },
      rejectedCandidateRules: candidateAudit.filter((r) => r.falseCorrections).map((r) => r.rule),
      final: {
        falseCorrections: result.final.falseCorrections,
        correct: cases.correct.length,
        wrong: cases.wrong.length,
        detected: result.final.detected,
        fixed: result.final.fixed,
      },
    },
    null,
    2,
  ),
);
saveResult('grammar-rules', { suite: 'deepseek-merged' }, result);
if (result.final.falseCorrections || activeAudit.some((r) => r.falseCorrections)) process.exitCode = 1;
