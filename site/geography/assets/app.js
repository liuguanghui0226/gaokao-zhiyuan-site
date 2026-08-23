const state = {
  data: null,
  visuals: null,
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

function filteredVisuals() {
  if (!Array.isArray(state.visuals?.cards)) return [];
  const query = normalizeText(state.query);
  return state.visuals.cards.filter((card) => {
    if (state.course && card.courseId !== state.course) return false;
    if (!query) return true;
    const text = normalizeText([
      card.title,
      card.caption,
      card.scene,
      ...(card.steps || []).flatMap((step) => [step.label, step.detail]),
      ...(card.lenses || []).flatMap((lens) => [lens.label, lens.detail]),
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

function renderVisualScene(card) {
  const titleId = `visual-${card.id}`;
  const common = `role="img" aria-labelledby="${esc(titleId)}" viewBox="0 0 720 300" focusable="false"`;
  const scenes = {
    "water-cycle": `<defs><linearGradient id="sky-${esc(card.id)}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#bde8f2"/><stop offset="1" stop-color="#eef8f5"/></linearGradient><linearGradient id="sea-${esc(card.id)}" x1="0" x2="1"><stop stop-color="#2387a2"/><stop offset="1" stop-color="#0d5b78"/></linearGradient></defs><rect width="720" height="300" fill="url(#sky-${esc(card.id)})"/><circle cx="94" cy="72" r="34" fill="#f6bd4b"/><g fill="none" stroke="#f6bd4b" stroke-width="4" stroke-linecap="round"><path d="M94 20v-12M94 124v12M42 72H30M158 72h12M57 35 48 26M131 109l9 9M131 35l9-9M57 109l-9 9"/></g><path d="M0 226C120 196 214 250 332 220s236-22 388 4v76H0Z" fill="url(#sea-${esc(card.id)})"/><path d="M0 226C120 196 214 250 332 220s236-22 388 4" fill="none" stroke="#a9e2df" stroke-width="4"/><path d="M188 216c-26-40-12-80 24-102 29-18 83-13 104 14 18 24-4 51-36 51-25 0-47 13-50 37" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="12 12"/><path d="M318 180c20-47 66-48 92-18 21 24 10 55-17 65-36 13-68-13-51-47" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="12 12"/><path d="M494 114c-32-23-73-7-80 26-8 35 28 46 64 34 42-14 76 15 62 50" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="12 12"/><g fill="#fff"><ellipse cx="272" cy="92" rx="58" ry="22"/><ellipse cx="324" cy="96" rx="48" ry="24"/><ellipse cx="228" cy="104" rx="36" ry="18"/></g><path d="M245 126v42m34-47v56m32-54v46" stroke="#31849a" stroke-width="4" stroke-linecap="round"/><text x="42" y="270" fill="#e8ffff" font-size="16">蒸发</text><text x="270" y="62" fill="#185c6c" font-size="16">凝结成云</text><text x="500" y="270" fill="#e8ffff" font-size="16">降水 · 汇流</text>`,
    "population-service": `<defs><linearGradient id="city-${esc(card.id)}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f6dfb1"/><stop offset="1" stop-color="#fff8e8"/></linearGradient></defs><rect width="720" height="300" fill="url(#city-${esc(card.id)})"/><path d="M35 238h650" stroke="#8a9b9c" stroke-width="5"/><path d="M86 236V184h42v52m12 0v-88h58v88m16 0v-53h41v53m12 0v-126h68v126m18 0v-72h47v72m14 0v-101h55v101" fill="#3d6871" stroke="#28535e" stroke-width="3"/><path d="M38 244c104-105 230-121 324-42 92 78 173-25 320-60" fill="none" stroke="#d67b45" stroke-width="7" stroke-linecap="round"/><path d="M38 244c104-105 230-121 324-42 92 78 173-25 320-60" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="9 9"/><circle cx="360" cy="181" r="25" fill="#e77658" stroke="#fff" stroke-width="5"/><circle cx="114" cy="217" r="13" fill="#49a48e" stroke="#fff" stroke-width="5"/><circle cx="612" cy="163" r="18" fill="#f2b84b" stroke="#fff" stroke-width="5"/><circle cx="522" cy="215" r="11" fill="#49a48e" stroke="#fff" stroke-width="5"/><circle cx="360" cy="181" r="48" fill="none" stroke="#e77658" stroke-opacity=".35" stroke-width="3" stroke-dasharray="7 8"/><circle cx="360" cy="181" r="96" fill="none" stroke="#e77658" stroke-opacity=".22" stroke-width="3" stroke-dasharray="7 8"/><text x="330" y="145" fill="#8f3d31" font-size="16">高等级中心</text><text x="74" y="278" fill="#28535e" font-size="16">小聚落</text><text x="550" y="278" fill="#28535e" font-size="16">服务半径</text>`,
    "climate-circulation": `<defs><linearGradient id="climate-${esc(card.id)}" x1="0" x2="1"><stop stop-color="#f7d8aa"/><stop offset=".48" stop-color="#fff8e8"/><stop offset="1" stop-color="#b8e1ec"/></linearGradient></defs><rect width="720" height="300" fill="url(#climate-${esc(card.id)})"/><path d="M360 20v260" stroke="#8aa9ad" stroke-width="2" stroke-dasharray="5 7"/><path d="M64 80C164 28 270 36 340 92s-55 116-141 85S98 184 64 80" fill="none" stroke="#d36d47" stroke-width="9" stroke-linecap="round"/><path d="M656 220c-100 52-206 44-276-12s55-116 141-85 101-7 135 77" fill="none" stroke="#3f8eaa" stroke-width="9" stroke-linecap="round"/><path d="M104 73l-18 4 13 13m504 137 18-4-13-13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M206 132c44-18 90-17 136 4m172 32c-44 18-90 17-136-4" fill="none" stroke="#6f9c9d" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 10"/><text x="70" y="44" fill="#9a432d" font-size="18">高压 · 暖</text><text x="570" y="264" fill="#2c6b83" font-size="18">低压 · 冷</text><text x="294" y="282" fill="#476d72" font-size="16">气压梯度力 + 地转偏向力</text>`,
    "gis-planning": `<defs><linearGradient id="map-${esc(card.id)}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d8efdf"/><stop offset="1" stop-color="#f8edce"/></linearGradient></defs><rect width="720" height="300" fill="url(#map-${esc(card.id)})"/><path d="M0 74c96 16 112-45 195-5s111 9 173-18 97 68 165 37 125-23 187 7v205H0Z" fill="#b7d9b7" opacity=".7"/><path d="M18 235c87-88 167-88 238-34 67 52 100-66 184-71 91-5 122 75 262 44" fill="none" stroke="#3693ac" stroke-width="5"/><path d="M78 63 628 258M128 285 606 42" stroke="#fff" stroke-width="7" opacity=".75"/><path d="M78 63 628 258M128 285 606 42" stroke="#d36d47" stroke-width="2" stroke-dasharray="12 9"/><circle cx="188" cy="157" r="18" fill="#d36d47" stroke="#fff" stroke-width="5"/><circle cx="417" cy="146" r="13" fill="#e7aa3d" stroke="#fff" stroke-width="5"/><circle cx="557" cy="207" r="16" fill="#3f8eaa" stroke="#fff" stroke-width="5"/><path d="M55 44h150" stroke="#447c70" stroke-width="14" opacity=".55"/><path d="M55 44h150" stroke="#d36d47" stroke-width="5" stroke-dasharray="12 8"/><text x="56" y="31" fill="#386d60" font-size="16">生态约束层</text><text x="245" y="285" fill="#2b6977" font-size="16">交通 · 人口 · 公共服务图层</text>`,
    "forest-security": `<defs><linearGradient id="forest-${esc(card.id)}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#dff1da"/><stop offset="1" stop-color="#f8edcf"/></linearGradient></defs><rect width="720" height="300" fill="url(#forest-${esc(card.id)})"/><circle cx="580" cy="68" r="34" fill="#f5bf4e" opacity=".9"/><path d="M0 232c92-52 162-40 238-8 83 35 144-42 236-9 91 33 149-9 246-5v90H0Z" fill="#8dbb79"/><g stroke="#356b50" stroke-width="5" stroke-linecap="round"><path d="M90 236v-82m0 22-30-27m30 8 34-35m76 114v-116m0 32-38-34m38 9 39-44m88 153v-92m0 34-32-29m32 13 35-41m88 113v-126m0 36-42-29m42 15 37-40"/></g><g fill="#4c9b63"><circle cx="58" cy="154" r="25"/><circle cx="122" cy="114" r="31"/><circle cx="168" cy="138" r="27"/><circle cx="208" cy="96" r="36"/><circle cx="254" cy="144" r="29"/><circle cx="326" cy="142" r="32"/><circle cx="382" cy="114" r="28"/><circle cx="416" cy="147" r="34"/><circle cx="480" cy="101" r="37"/><circle cx="532" cy="139" r="32"/></g><path d="M42 70c100-42 195-15 283 23s176-4 327-24" fill="none" stroke="#2b8890" stroke-width="5" stroke-dasharray="12 10"/><path d="M592 176c28-20 59-1 57 27-2 27-43 31-62 13-20-19-11-28 5-40" fill="none" stroke="#d36d47" stroke-width="5"/><text x="48" y="48" fill="#287470" font-size="17">碳汇 · 水土保持 · 生物多样性</text><text x="572" y="238" fill="#a64e38" font-size="16">风险</text><text x="284" y="278" fill="#356b50" font-size="16">保护 · 监测 · 可持续经营</text>`
  };
  return `<svg class="visual-scene visual-scene-${esc(card.scene)}" ${common}><title id="${esc(titleId)}">${esc(card.title)}示意图</title>${scenes[card.scene] || scenes["water-cycle"]}</svg>`;
}

function renderVisualQuiz(card) {
  const quiz = card?.quiz;
  if (!quiz?.prompt || !Array.isArray(quiz.options) || quiz.options.length !== 3) return "";
  const answer = quiz.options[quiz.answerIndex] || quiz.options[0];
  const options = quiz.options.map((option, index) => (
    `<li><strong>${String.fromCharCode(65 + index)}. ${esc(option.label)}</strong><span>${esc(option.detail)}</span></li>`
  )).join("");
  return `<details class="visual-quiz" data-visual-quiz="${esc(card.id)}"><summary>先观察图示，再选择最合理的解释</summary><p class="visual-quiz-prompt">${esc(quiz.prompt)}</p><ol class="visual-quiz-options">${options}</ol><div class="visual-quiz-answer" role="note"><strong>正确思路：${esc(answer.label)}</strong><p>${esc(quiz.explanation || answer.detail)}</p></div></details>`;
}

function renderVisualLenses(card) {
  const lenses = Array.isArray(card?.lenses) ? card.lenses : [];
  if (lenses.length !== 3) return "";
  const initial = lenses[0];
  const controls = lenses.map((lens, index) => (
    `<button type="button" class="visual-lens-button${index === 0 ? " active" : ""}" data-visual-lens="${esc(lens.id)}" data-visual-lens-card="${esc(card.id)}" aria-pressed="${index === 0}">${esc(lens.label)}</button>`
  )).join("");
  return `<section class="visual-lens" aria-label="${esc(card.title)}观察镜头"><div class="visual-lens-heading"><span>观察镜头</span><small>切换读图角度</small></div><div class="visual-lens-controls" role="group" aria-label="${esc(card.title)}观察镜头选项">${controls}</div><p class="visual-lens-current" data-visual-lens-current="${esc(card.id)}">${esc(initial.label)}</p><p class="visual-lens-detail" data-visual-lens-detail="${esc(card.id)}">${esc(initial.detail)}</p></section>`;
}

function bindVisualLensEvents() {
  $$('[data-visual-lens]').forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.visualLensCard;
      const card = state.visuals?.cards?.find((candidate) => candidate.id === cardId);
      const lens = card?.lenses?.find((candidate) => candidate.id === button.dataset.visualLens);
      if (!lens) return;
      $$(`[data-visual-lens-card="${cardId}"]`).forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });
      const detail = $(`[data-visual-lens-detail="${cardId}"]`);
      const current = $(`[data-visual-lens-current="${cardId}"]`);
      if (detail) detail.textContent = lens.detail;
      if (current) current.textContent = lens.label;
    });
  });
}

function renderVisualLearning(data = state.data, visuals = state.visuals) {
  const cards = filteredVisuals();
  if (!data || !Array.isArray(visuals?.cards) || !visuals.cards.length) return "";
  const sourceMap = new Map((data.sources || []).map((source) => [source.id, source]));
  const cardMarkup = cards.map((card) => {
    const sources = (card.sourceIds || []).map((sourceId) => sourceMap.get(sourceId) || { id: sourceId });
    const steps = (card.steps || []).map((step) => `<li><strong>${esc(step.label)}</strong><span>${esc(step.detail)}</span></li>`).join("");
    const media = (card.mediaLinks || []).map((link) => `<a class="visual-media-link" href="${esc(link.url)}" target="_blank" rel="noreferrer"><span>${esc(link.mediaType)}</span>${esc(link.label)} ↗</a>`).join("");
    const evidence = sources.map((source) => source.url
      ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title || source.id)}</a>`
      : `<span>${esc(source.title || source.id)}</span>`).join("");
    return `<article class="visual-story-card" data-visual-course="${esc(card.courseId)}"><div class="visual-story-copy"><p class="visual-kicker">三步看懂 · ${esc(card.scene)}</p><h3>${esc(card.title)}</h3><p class="visual-caption">${esc(card.caption)}</p><ol class="visual-steps">${steps}</ol>${renderVisualLenses(card)}${renderVisualQuiz(card)}<div class="visual-media" aria-label="${esc(card.title)}媒体与数据入口">${media}</div><div class="visual-evidence"><span>证据入口</span>${evidence}</div></div><figure class="visual-figure">${renderVisualScene(card)}<figcaption>原创示意图：${esc(card.caption)}</figcaption></figure></article>`;
  }).join("");
  const empty = `<div class="empty-state visual-empty">当前课程或检索条件下没有匹配的视觉故事。</div>`;
  const markup = `<section class="visual-learning" aria-labelledby="visual-learning-title"><div class="section-heading"><div><p class="eyebrow">看图 · 读过程 · 点开数据</p><h2 id="visual-learning-title">视觉学习：把地理过程变成可观察的故事</h2><p>每张卡片用原创 SVG 拆成三步，再连接视频入口、互动地图或公开数据图层；外部资源负责展示原始证据，本站只保留学习路径。</p></div><span class="status">${fmtNumber(cards.length)} 张视觉故事</span></div><div class="visual-story-list">${cardMarkup || empty}</div></section>`;
  const app = $("#geographyApp");
  if (app) app.innerHTML = markup;
  bindVisualLensEvents();
  return markup;
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
  app.innerHTML = `<section class="hero"><p class="eyebrow">课程化整理 · 来源可追溯</p><h2>高中地理知识库：按课程复习自然地理、人文地理与资源环境</h2><p>${esc(data.description || "")}</p><div class="course-filters" role="group" aria-label="地理课程筛选">${courseButtons}</div></section><section class="panel provenance" data-geography-version="${esc(data.version)}"><div class="section-heading"><div><h2>资料边界与更新</h2><p>资料版本 ${esc(data.version)} · 来源索引与原创摘要分开标识。</p></div><span class="status">${fmtNumber(metrics.sources)} 条来源</span></div><div class="metrics">${renderMetric("课程", metrics.courses)}${renderMetric("知识摘要", metrics.items)}${renderMetric("原创摘要", metrics.authoredSummaries)}${renderMetric("引文型方法卡", metrics.citationOnlyItems)}</div><p class="boundary-note">引文型方法卡只用于概念与题型交叉核对，不复制题面、答案或竞赛知识点清单；原始许可未核验的本地资料不提供公开链接。</p></section>${renderVisualLearning(data)}${cards ? `<section class="card-list" aria-label="地理知识摘要">${cards}</section>` : `<div class="empty-state">没有匹配的地理摘要，请换一个关键词或切换课程范围。</div>`}${renderSourceDirectory(data)}`;
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

async function fetchVisuals() {
  const response = await fetch("../data/geography/visuals.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`地理视觉学习资料载入失败（HTTP ${response.status}）`);
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
  [state.data, state.visuals] = await Promise.all([fetchKnowledge(), fetchVisuals()]);
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
