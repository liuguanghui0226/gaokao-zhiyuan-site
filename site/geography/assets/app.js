const state = {
  data: null,
  query: "",
  course: "",
  sourceFilter: "all",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function geographySummaryMetrics(data) {
  const items = data?.items || [];
  return {
    courses: data?.courses?.length || 0,
    items: items.length,
    sources: data?.sources?.length || 0,
    authoredSummaries: items.filter((item) => item.licenseStatus === "authored-summary").length,
    citationOnlyItems: items.filter((item) => item.licenseStatus === "citation-only").length,
  };
}

function filteredItems(courseMap = new Map((state.data?.courses || []).map((course) => [course.id, course]))) {
  if (!state.data || !Array.isArray(state.data.items)) return [];
  const query = normalizeText(state.query);
  return state.data.items.filter((item) => {
    if (state.course && item.courseId !== state.course) return false;
    if (!query) return true;
    const text = normalizeText([
      item.title,
      item.summary,
      ...(item.keywords || []),
      courseMap.get(item.courseId)?.name || "",
    ].join(" "));
    return text.includes(query);
  });
}

function renderSource(source) {
  const rawTitle = source?.title || source?.id || "未命名来源";
  const title = esc(rawTitle);
  const externalLabel = esc(`${rawTitle}（在新窗口打开）`);
  const revision = [
    source?.commitSha ? `commit ${source.commitSha}` : "",
    source?.accessedAt ? `访问 ${source.accessedAt}` : "",
  ].filter(Boolean).join(" · ");
  const label = revision ? `${title} · ${esc(revision)}` : title;
  if (source?.url) {
    return `<a class="geography-source-link" href="${esc(source.url)}" aria-label="${externalLabel}" target="_blank" rel="noreferrer">${label}</a>`;
  }
  return `<span class="geography-source-local" title="本地索引或教材来源，无公开链接">${label}</span>`;
}

function sourceMatchesQuery(source, query) {
  return !query || normalizeText([
    source.title,
    source.publisher,
    source.editionNote,
    source.licenseNote,
  ].join(" ")).includes(query);
}

function renderSourceDirectory(data = state.data) {
  const sourceRecords = data?.sources || [];
  if (!sourceRecords.length) return "";
  const query = normalizeText(state.query);
  const queryLabel = state.query.trim();
  const querySources = sourceRecords.filter((source) => sourceMatchesQuery(source, query));
  const sourceFilter = ["all", "public", "local"].includes(state.sourceFilter) ? state.sourceFilter : "all";
  const counts = {
    all: querySources.length,
    public: querySources.filter((source) => source?.url).length,
    local: querySources.filter((source) => !source?.url).length,
  };
  const sources = querySources.filter((source) => (
    sourceFilter === "all" || (sourceFilter === "public" ? source?.url : !source?.url)
  ));
  const publicCount = sources.filter((source) => source?.url).length;
  const localCount = sources.length - publicCount;
  const controls = [
    ["all", "全部来源"],
    ["public", "公开链接"],
    ["local", "本地/教材"],
  ].map(([value, label]) => (
    `<button class="source-filter ${sourceFilter === value ? "active" : ""}" type="button" data-geography-source-filter="${value}" aria-pressed="${sourceFilter === value}">${label} · ${fmtNumber(counts[value])}</button>`
  )).join("");
  const rows = sources.map((source) => {
    const rawTitle = source?.title || source?.id || "未命名来源";
    const externalLabel = esc(`${rawTitle}（在新窗口打开）`);
    const title = source?.url
      ? `<a class="geography-directory-link" href="${esc(source.url)}" aria-label="${externalLabel}" target="_blank" rel="noreferrer">${esc(rawTitle)}</a>`
      : `<span class="geography-directory-local" title="本地索引或教材来源，无公开链接">${esc(rawTitle)}</span>`;
    const metadata = [
      source?.publisher,
      source?.commitSha ? `commit ${source.commitSha}` : "",
      source?.accessedAt ? `访问 ${source.accessedAt}` : "",
    ].filter(Boolean).join(" · ");
    return `<article class="source-row"><div><h3>${title}</h3>${metadata ? `<p>${esc(metadata)}</p>` : ""}${source?.editionNote ? `<p>${esc(source.editionNote)}</p>` : ""}</div><span class="status">${source?.url ? "公开链接" : "本地/教材"}</span></article>`;
  }).join("");
  const empty = queryLabel
    ? `<div class="empty-state">当前检索“${esc(queryLabel)}”没有匹配的地理来源。</div>`
    : `<div class="empty-state">当前来源类型筛选没有匹配项。</div>`;
  return `<section class="panel geography-source-directory"><div class="section-heading"><div><h2>来源目录</h2><p>集中查看教材、本地资料与公开网页；公开来源保留访问日期或固定提交版本。</p><div class="source-filters" role="group" aria-label="地理来源类型">${controls}</div></div><span class="status">${fmtNumber(sources.length)} 条来源 · ${fmtNumber(publicCount)} 个公开链接 · ${fmtNumber(localCount)} 个本地/教材</span></div><div class="source-list">${rows || empty}</div></section>`;
}

function renderMetric(label, value) {
  return `<div class="metric"><strong>${fmtNumber(value)}</strong><span>${esc(label)}</span></div>`;
}

function renderGeography() {
  const app = $("#geographyApp");
  const data = state.data;
  if (!app || !data) return;
  const metrics = geographySummaryMetrics(data);
  const courseMap = new Map(data.courses.map((course) => [course.id, course]));
  const visibleItems = filteredItems(courseMap);
  const courseButtons = [
    `<button class="course-filter ${state.course ? "" : "active"}" type="button" data-geography-course="" aria-pressed="${!state.course}">全部课程 · ${fmtNumber(metrics.items)}</button>`,
    ...data.courses.map((course) => {
      const count = data.items.filter((item) => item.courseId === course.id).length;
      return `<button class="course-filter ${state.course === course.id ? "active" : ""}" type="button" data-geography-course="${esc(course.id)}" aria-pressed="${state.course === course.id}">${esc(course.name)} · ${fmtNumber(count)}</button>`;
    }),
  ].join("");
  const cards = visibleItems.map((item) => {
    const course = courseMap.get(item.courseId);
    const sources = (item.sourceIds || []).map((sourceId) => data.sources.find((source) => source.id === sourceId) || { id: sourceId });
    const evidence = (item.evidence || []).map((entry) => {
      const source = data.sources.find((candidate) => candidate.id === entry.sourceId);
      return `${source?.title || entry.sourceId} · ${entry.locator}`;
    });
    return `<article class="geography-card"><header><div><span class="course-label">${esc(course?.name || item.courseId)}</span><h3>${esc(item.title)}</h3></div><span class="status">${esc(item.reviewStatus === "reviewed" ? "已复核摘要" : "待复核")}</span></header><p>${esc(item.summary)}</p><div class="tags">${(item.keywords || []).map((keyword) => `<span>${esc(keyword)}</span>`).join("")}</div><details><summary>教材证据与来源</summary><div class="evidence">${evidence.map((entry) => `<span>${esc(entry)}</span>`).join("")}</div><p class="license-note">${esc(item.licenseStatus === "authored-summary" ? "本站为原创摘要；请回到教材原页核对完整定义、图表与案例。" : "本站仅提供来源索引，不复制原文。")}</p><div class="source-links" aria-label="来源列表">${sources.map(renderSource).join("")}</div></details></article>`;
  }).join("");
  app.innerHTML = `<section class="hero"><p class="eyebrow">课程化整理 · 来源可追溯</p><h2>高中地理知识库：按课程复习自然地理、人文地理与资源环境</h2><p>${esc(data.description || "")}</p><div class="course-filters" role="group" aria-label="地理课程筛选">${courseButtons}</div></section><section class="panel provenance" data-geography-version="${esc(data.version)}"><div class="section-heading"><div><h2>资料边界与更新</h2><p>资料版本 ${esc(data.version)} · 来源索引与原创摘要分开标识。</p></div><span class="status">${fmtNumber(metrics.sources)} 条来源</span></div><div class="metrics">${renderMetric("课程", metrics.courses)}${renderMetric("知识摘要", metrics.items)}${renderMetric("原创摘要", metrics.authoredSummaries)}${renderMetric("引文型方法卡", metrics.citationOnlyItems)}</div><p class="boundary-note">引文型方法卡只用于概念与题型交叉核对，不复制题面、答案或竞赛知识点清单；原始许可未核验的本地资料不提供公开链接。</p></section>${cards ? `<section class="card-list" aria-label="地理知识摘要">${cards}</section>` : `<div class="empty-state">没有匹配的地理摘要，请换一个关键词或切换课程范围。</div>`}${renderSourceDirectory(data)}`;
  $$('[data-geography-course]').forEach((button) => {
    button.addEventListener("click", () => {
      state.course = button.dataset.geographyCourse || "";
      syncControls();
      renderGeography();
    });
  });
  $$('[data-geography-source-filter]').forEach((button) => {
    button.addEventListener("click", () => {
      state.sourceFilter = button.dataset.geographySourceFilter || "all";
      syncControls();
      renderGeography();
    });
  });
}

function syncControls() {
  const clear = $("#clearFilters");
  if (clear) clear.hidden = !state.query.trim() && !state.course && state.sourceFilter === "all";
  const course = state.data?.courses?.find((item) => item.id === state.course);
  const active = [];
  if (state.query.trim()) active.push(`检索“${state.query.trim()}”`);
  if (course) active.push(`课程“${course.name}”`);
  if (state.sourceFilter === "public") active.push("公开来源");
  if (state.sourceFilter === "local") active.push("本地/教材来源");
  const count = filteredItems().length;
  $("#filterStatus").textContent = active.length
    ? `当前${active.join("、")}；显示 ${fmtNumber(count)} 条地理摘要。`
    : `共 ${fmtNumber(count)} 条地理摘要。`;
}

function clearFilters() {
  state.query = "";
  state.course = "";
  state.sourceFilter = "all";
  const input = $("#searchInput");
  if (input) input.value = "";
  syncControls();
  renderGeography();
}

async function fetchKnowledge() {
  const response = await fetch("../data/geography/knowledge.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`高中地理资料载入失败（HTTP ${response.status}）`);
  return response.json();
}

function formatFreshness(version) {
  const match = /^geo-(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\.\d+)?$/.exec(String(version || ""));
  return match ? `资料版本 ${match[1]}/${Number(match[2])}/${Number(match[3])}` : "资料版本待核";
}

function bindEvents() {
  $("#searchInput")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    syncControls();
    renderGeography();
  });
  $("#clearFilters")?.addEventListener("click", clearFilters);
}

async function boot() {
  state.data = await fetchKnowledge();
  $("#freshness").textContent = formatFreshness(state.data.version);
  bindEvents();
  syncControls();
  renderGeography();
}

function renderBootFailure(error) {
  const app = $("#geographyApp");
  if (!app) return;
  const message = error instanceof Error ? error.message : String(error || "未知错误");
  app.innerHTML = `<div class="empty-state" role="alert"><h2>资料载入失败</h2><p>${esc(message)}</p><button class="retry-button" type="button" onclick="location.reload()">重新加载资料</button></div>`;
}

boot().catch(renderBootFailure);
