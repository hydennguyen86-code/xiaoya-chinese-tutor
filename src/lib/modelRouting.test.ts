import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeTask } from './modelRouting.ts';
import { DEFAULT_SETTINGS } from './storage.ts';
import type { ProviderInfo, Settings, StatusResponse } from '../types';

const local: ProviderInfo = { id: 'ollama', name: 'Ollama', url: '', online: true, models: ['qwen2.5:7b'], recommendedModel: 'qwen2.5:7b' };
const cloud: ProviderInfo = {
  id: 'compatible',
  name: 'API',
  url: 'https://api.vietapi.tech/v1',
  online: true,
  models: ['gemini-4-argon'],
  recommendedModel: 'gemini-4-argon',
  remote: true,
};
const status = (providers: ProviderInfo[]) => ({ providers }) as unknown as StatusResponse;
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, providerId: 'ollama', model: 'qwen2.5:7b', ...patch });

test('ticked jobs go to the cloud, chores stay on the local model', () => {
  const both = status([local, cloud]);
  assert.deepEqual(routeTask('chat', settings(), both), { provider: 'compatible', model: 'gemini-4-argon', cloud: true });
  assert.deepEqual(routeTask('analysis', settings(), both)?.cloud, true);
  assert.deepEqual(routeTask('lessons', settings(), both), { provider: 'ollama', model: 'qwen2.5:7b', cloud: false });
  assert.equal(routeTask('chat', settings({ cloudTasks: [] }), both)?.provider, 'ollama');
});

test('falls back to whichever model is available', () => {
  assert.equal(routeTask('lessons', settings(), status([{ ...local, online: false }, cloud]))?.provider, 'compatible');
  assert.equal(routeTask('chat', settings(), status([local, { ...cloud, online: false }]))?.provider, 'ollama');
  assert.equal(routeTask('chat', settings(), status([{ ...local, online: false }])), null);
  assert.equal(routeTask('chat', settings(), null), null);
});

test('live corrections stay off the cloud unless ticked', () => {
  const both = status([local, cloud]);
  assert.equal(routeTask('corrections', settings(), both)?.provider, 'ollama');
  assert.equal(routeTask('corrections', settings(), status([{ ...local, online: false }, cloud])), null);
  assert.equal(routeTask('corrections', settings({ cloudTasks: ['corrections'] }), both)?.provider, 'compatible');
});
