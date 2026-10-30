import type { CloudTask, ProviderInfo, Settings, StatusResponse } from '../types';

/** Which jobs may go to the cloud model. A local 7B model is fine for chores, not for judging mistakes. */
export const CLOUD_TASK_OPTIONS: Array<{ id: CloudTask; label: string; hint: string }> = [
  { id: 'chat', label: 'Trò chuyện với gia sư', hint: 'Hội thoại tự nhiên, tự lồng điểm yếu của bạn vào tình huống' },
  {
    id: 'corrections',
    label: 'Bắt lỗi câu nói ngay khi nói',
    hint: 'Tắt: chỉ bộ luật lỗi hay gặp + model máy (nếu có) bắt lỗi; ghi âm vẫn lưu để phân tích sau',
  },
  { id: 'analysis', label: 'Phân tích điểm yếu & kế hoạch', hint: 'Đọc toàn bộ lỗi đã lưu, so với bản phân tích trước' },
  { id: 'assessment', label: 'Chấm bài kiểm tra', hint: 'Đánh giá câu trả lời theo mục tiêu bài' },
  { id: 'lessons', label: 'Soạn bài luyện tự sinh', hint: 'Giáo trình có sẵn không gọi model; thường để model máy làm' },
];

export const CLOUD_TASK_IDS = new Set<CloudTask>(CLOUD_TASK_OPTIONS.map((item) => item.id));
// Chat and scoring stay on the machine (fast, free); the cloud model only reads the saved history.
export const DEFAULT_CLOUD_TASKS: CloudTask[] = ['analysis'];

export const VIETAPI_PRESET = {
  url: 'https://api.vietapi.tech/v1',
  model: 'gemini-4-argon',
  topupUrl: 'https://vietapi.tech/topup.html',
  modelsUrl: 'https://vietapi.tech/models.html',
} as const;

export interface ModelRoute {
  provider: string;
  model: string;
  cloud: boolean;
}

export function cloudProvider(status: StatusResponse | null): ProviderInfo | null {
  return status?.providers.find((item) => item.remote && item.online && item.models[0]) || null;
}

/**
 * Picks the model for one job: the cloud model for ticked jobs, otherwise the model
 * chosen in "Bộ não". When the computer has no model running, everything goes to the
 * cloud — except live corrections, which never go to the cloud unless ticked (the
 * built-in rules still run). When the cloud is not configured, everything stays local.
 */
export function routeTask(task: CloudTask, settings: Settings, status: StatusResponse | null): ModelRoute | null {
  if (!status) return null;
  const cloud = cloudProvider(status);
  const main = status.providers.find((item) => item.id === settings.providerId && item.online);
  const mainReady = Boolean(main && settings.model);
  const ticked = settings.cloudTasks.includes(task);
  if (cloud && (ticked || (!mainReady && task !== 'corrections'))) return { provider: cloud.id, model: cloud.models[0], cloud: true };
  if (main && mainReady) return { provider: main.id, model: settings.model, cloud: Boolean(main.remote) };
  return null;
}
