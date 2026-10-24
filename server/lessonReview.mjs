/** Review metadata is a human declaration; structural validation cannot certify language quality. */
export function reviewProblems(raw) {
  const problems = [];
  if (raw.reviewed !== true) problems.push('reviewed phải là true');
  if (typeof raw.reviewedBy !== 'string' || !raw.reviewedBy.trim()) problems.push('thiếu reviewedBy (người duyệt)');
  const date = typeof raw.reviewedAt === 'string' ? raw.reviewedAt : '';
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date.slice(0, 10)
  )
    problems.push('reviewedAt phải là ngày hợp lệ YYYY-MM-DD hoặc ISO UTC');
  if (typeof raw.notes !== 'string' || !raw.notes.trim()) problems.push('thiếu notes (phạm vi kiểm tra và sửa lỗi)');
  return problems;
}
