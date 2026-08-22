const FILTER_RESULT_LABELS = {
  sources: "资料来源",
  disciplines: "相关资料",
  geography: "地理摘要",
};

export function formatFilterResultCount(view, count) {
  const label = FILTER_RESULT_LABELS[view];
  const numericCount = Number(count);
  if (!label || !Number.isFinite(numericCount)) return "";
  return `当前显示 ${Math.max(0, Math.trunc(numericCount))} 条${label}。`;
}
