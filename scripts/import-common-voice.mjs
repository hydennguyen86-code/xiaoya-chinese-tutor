import path from 'node:path';
import { parseArgs } from 'node:util';
import { importCommonVoice } from '../server/listeningCorpus.mjs';
const { values } = parseArgs({
  options: { source: { type: 'string' }, version: { type: 'string' }, url: { type: 'string' }, limit: { type: 'string' } },
});
if (!values.source || !values.version) {
  console.error(
    'Usage: npm run corpus:import -- --source /download/zh-CN --version cv-27.0 [--url https://mozilladatacollective.com/datasets/ID] [--limit 50]',
  );
  process.exitCode = 1;
} else {
  try {
    const result = await importCommonVoice({
      source: path.resolve(values.source),
      dataDir: path.resolve(process.env.XIAOYA_DATA_DIR || 'data'),
      version: values.version,
      sourceUrl: values.url,
      limit: values.limit,
    });
    console.log(JSON.stringify(result));
    console.log('Catalog only; source audio was not copied. Set XIAOYA_COMMON_VOICE_DIR to the same source when starting the app.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
