#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "official-hebei-control-lines-2026";
const CONTROL_URL = "https://www.hebeea.edu.cn/c/2026-06-24/493121.html";
const CONTROL_IMAGE_URL = "https://file.hebeea.edu.cn/upload/resources/image/2026/06/24/27110.jpg";
const RANK_URL = "https://www.hebeea.edu.cn/c/2026-06-24/493215.html";
const RANK_PDF_URL = "https://file.hebeea.edu.cn/upload/resources/file/2026/06/24/27144.pdf";
const TITLE = "2026年河北省普通高校招生各批各类录取控制分数线";
const QUALITY = "official-hebei-control-line-image-verified";
const GENERATED_AT = "2026-07-16T07:30:00.000Z";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-hebei-control-lines-2026");

const evidence = {
  controlPage: {
    url: CONTROL_URL,
    cache: "tmp/official-hebei-control-lines-2026/control-page.html",
    raw: "control-page.html",
    bytes: 21530,
    sha256: "89137895e8126fa5d8845f7b11a9aa8e3e477e501b61eb107e16b1732fdf4591",
  },
  controlImage: {
    url: CONTROL_IMAGE_URL,
    cache: "tmp/official-hebei-control-lines-2026/control-lines.jpg",
    raw: "control-lines.jpg",
    bytes: 497717,
    sha256: "cd4adbc26dc402f2db0f24724e7e03da2dd436302e0886e68a22ec3872a5eb42",
  },
  rankPage: {
    url: RANK_URL,
    cache: "tmp/official-hebei-control-lines-2026/rank-page.html",
    raw: "rank-page.html",
    bytes: 29272,
    sha256: "67045aa3c9dcb2a6e7917c39b502ab267def279bc1296f06567871e6aed95bbe",
  },
  rankPdf: {
    url: RANK_PDF_URL,
    cache: "tmp/official-hebei-control-lines-2026/rank.pdf",
    raw: "rank.pdf",
    bytes: 6084765,
    sha256: "fcd70c8356b95dc787b92c1c1f7c97183fc5a1532dadf492714e3d5edae7cf16",
  },
};

function parseArgs(argv) {
  const args = { useCache: false, out: "data/admissions/official-hebei-control-lines-2026-import.json" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--use-cache") args.useCache = true;
    else if (argv[index] === "--out") args.out = argv[++index];
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compactHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#10;|&#13;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(180_000),
    headers: { "user-agent": "Mozilla/5.0 gaokao-evidence/3.290" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadEvidence(item, useCache) {
  const bytes = useCache ? fs.readFileSync(path.join(PROJECT_ROOT, item.cache)) : await fetchBuffer(item.url);
  assert(bytes.length === item.bytes, `${item.raw} byte count drifted: ${bytes.length}`);
  assert(sha256(bytes) === item.sha256, `${item.raw} SHA-256 drifted`);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, item.raw), bytes);
  return bytes;
}

const rows = [];

function addRow({
  category,
  subjectType,
  section,
  cultureScore,
  professionalScore,
  route,
  professionalMetric,
  scoreBasis = "gaokao-total",
  scope = "special-path-only",
}) {
  rows.push({ category, subjectType, section, cultureScore, professionalScore, route, professionalMetric, scoreBasis, scope });
}

for (const [subjectType, bachelor, vocational, special] of [["历史类", 485, 200, 512], ["物理类", 443, 200, 510]]) {
  addRow({ category: "普通类", subjectType, section: "本科", cultureScore: bachelor, route: "ordinary-bachelor", scope: "control-line-only" });
  addRow({ category: "普通类", subjectType, section: "专科", cultureScore: vocational, route: "ordinary-vocational", scope: "control-line-only" });
  addRow({ category: "特殊类型招生", subjectType, section: "特殊类型", cultureScore: special, route: "special" });
}

const artLines = [
  ["音乐表演类（声乐）", 312, 190, 140, 185, "professional-unified-exam"],
  ["音乐教育类（声乐主项）", 312, 180, 140, 175, "professional-unified-exam"],
  ["音乐表演类（器乐）", 312, 185, 140, 180, "professional-unified-exam"],
  ["音乐教育类（器乐主项）", 312, 185, 140, 180, "professional-unified-exam"],
  ["舞蹈类", 312, 205, 140, 200, "professional-unified-exam"],
  ["美术与设计类", 302, 180, 140, 160, "professional-unified-exam"],
  ["戏剧影视表演类", 312, 200, 140, 195, "professional-unified-exam"],
  ["服装表演类", 312, 200, 140, 195, "professional-unified-exam"],
  ["戏剧影视导演类", 332, 205, 140, 200, "professional-unified-exam"],
  ["播音与主持类", 332, 205, 140, 200, "professional-unified-exam"],
  ["书法类", 332, 180, 140, 160, "professional-unified-exam"],
  ["戏曲类省际联考", 221, 180, 140, 180, "xiqu-interprovincial-joint-exam"],
];
for (const [category, bachelorCulture, bachelorProfessional, vocationalCulture, vocationalProfessional, metric] of artLines) {
  addRow({ category, subjectType: "艺术类", section: "艺术本科", cultureScore: bachelorCulture, professionalScore: bachelorProfessional, route: "art", professionalMetric: metric });
  addRow({ category, subjectType: "艺术类", section: "艺术专科", cultureScore: vocationalCulture, professionalScore: vocationalProfessional, route: "art", professionalMetric: metric });
}

for (const [subjectType, bachelorCulture] of [["体育类（历史科目组合）", 318], ["体育类（物理科目组合）", 300]]) {
  addRow({ category: "体育类", subjectType, section: "体育本科", cultureScore: bachelorCulture, professionalScore: 270, route: "sports", professionalMetric: "sports-professional-test" });
  addRow({ category: "体育类", subjectType, section: "体育专科", cultureScore: 140, professionalScore: 230, route: "sports", professionalMetric: "sports-professional-test" });
}

const counterpartLines = [
  ["财经", 517], ["学前教育", 561], ["农林", 589], ["畜牧兽医", 599], ["机械", 501],
  ["电子电工", 538], ["建筑", 509], ["计算机", 504], ["医学", 564], ["旅游", 538],
];
for (const [category, bachelor] of counterpartLines) {
  addRow({ category: `对口${category}类`, subjectType: "对口类", section: "对口本科", cultureScore: bachelor, route: "counterpart", scoreBasis: "counterpart-exam-total" });
  addRow({ category: `对口${category}类`, subjectType: "对口类", section: "对口专科", cultureScore: 180, route: "counterpart", scoreBasis: "counterpart-exam-total" });
}

function recordId(row) {
  return `2026-hebei-control-${sha256([row.category, row.subjectType, row.section, row.cultureScore, row.professionalScore || "", row.professionalMetric || "", row.scoreBasis].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.scope === "control-line-only";
  const professional = Number.isFinite(row.professionalScore);
  return {
    id: recordId(row),
    province: "河北",
    year: 2026,
    subjectType: row.subjectType,
    batch: `${row.category}${row.section}录取控制分数线`,
    schoolName: TITLE,
    schoolTags: ["河北官方控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "河北",
    dataType: "control-line",
    majorName: `${row.category}${row.section}录取控制分数线`,
    majorGroup: row.category,
    minScore: row.cultureScore,
    cultureScoreLine: row.cultureScore,
    scoreDimension: professional ? "culture-score" : "total-score",
    scoreBasis: row.scoreBasis,
    ...(professional ? { professionalMinScore: row.professionalScore, professionalScoreMetric: row.professionalMetric } : {}),
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: CONTROL_URL,
    formalScoreScope: row.scope,
    controlLineRouteKind: row.route,
    controlLineKind: `${row.category}录取控制分数线`,
    controlLineSection: row.section,
    cautions: ordinary ? [
      "这是河北省2026年普通类本科或专科录取控制分数线，只用于对应首选科目的普通批资格边界。",
      "达到控制线不等于达到任何具体院校专业组、院校或专业的实际投档录取线。",
      "历史类和物理类不得混用；特殊类型、艺术、体育和对口控制线不参与普通类推荐路由。",
    ] : [
      "这是河北省2026年特殊类型、艺术、体育或对口招生控制线，不适用于普通类考生直接推荐。",
      professional ? "文化课分与专业成绩是两个必须分别达到的门槛，不得相加或互相替代。" : "该总分只适用于对应特殊招生路径和科类。",
      "控制线不是具体院校专业组、院校或专业的实际投档录取线。",
    ],
    sourceFile: "data/admissions/raw/official-hebei-control-lines-2026/control-lines.jpg",
    sourcePublishedAt: "2026-06-24 14:33:08",
  };
}

function assertOfficialPages(loaded) {
  const controlHtml = loaded.controlPage.toString("utf8");
  const controlText = compactHtml(controlHtml);
  assert(controlText.includes(TITLE), "Control-line title drifted");
  assert(controlText.includes("发布时间：[2026-06-24]"), "Control-line publish date drifted");
  assert(controlText.includes("发布：高等学校考试招生部"), "Control-line publisher drifted");
  assert(controlHtml.includes("27110.jpg"), "Control-line image link drifted");

  const rankHtml = loaded.rankPage.toString("utf8");
  const rankText = compactHtml(rankHtml);
  assert(rankText.includes("2026年河北省普通高校招生各类考生成绩统计表"), "Rank-page title drifted");
  assert(rankText.includes("发布时间：[2026-06-24]"), "Rank-page publish date drifted");
  assert(rankHtml.includes("27144.pdf"), "Rank PDF link drifted");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = {};
  for (const [key, item] of Object.entries(evidence)) loaded[key] = await loadEvidence(item, args.useCache);
  assertOfficialPages(loaded);

  const records = rows.map(makeRecord);
  assert(records.length === 54, `Expected 54 records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 50, "Expected fifty special-path records");
  assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 28, "Expected twenty-eight culture-plus-professional records");

  const payload = {
    dataset: "official-hebei-control-lines-2026-import",
    generatedAt: GENERATED_AT,
    scope: { province: "河北", year: 2026, sourceKind: "official-control-lines" },
    notes: [
      "官方正文以单张图片发布；本导入器锁定正文、原图、位次正文和位次PDF字节数及SHA-256，再按原图逐项结构化。",
      "普通类本科/专科4条只作资格路由；特殊类型、艺术、体育和对口50条保持特殊路径隔离。",
      "艺术统考和体育文化课、专业课门槛分字段保存；艺术校考和河北体育学院校测因专业线由院校确定，仅保留非数值政策说明。",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      province: "河北",
      title: TITLE,
      publisher: "河北省教育考试院",
      publishedAt: "2026-06-24 14:33:08",
      url: CONTROL_URL,
      attachmentUrls: [CONTROL_IMAGE_URL],
      relatedUrls: [RANK_URL, RANK_PDF_URL],
      quality: QUALITY,
      usage: "抽取河北2026普通类、特殊类型、艺术统考、体育和对口控制线54条；仅普通历史/物理本科与专科4条参与普通资格路由。",
      parsedRecords: records.length,
      controlPageBytes: evidence.controlPage.bytes,
      controlPageSha256: evidence.controlPage.sha256,
      controlImageBytes: evidence.controlImage.bytes,
      controlImageSha256: evidence.controlImage.sha256,
      rankEvidence: {
        url: RANK_URL,
        pageBytes: evidence.rankPage.bytes,
        pageSha256: evidence.rankPage.sha256,
        pdfUrl: RANK_PDF_URL,
        pdfBytes: evidence.rankPdf.bytes,
        pdfSha256: evidence.rankPdf.sha256,
        records: 1094,
      },
      nonNumericPolicies: [
        "艺术校考类文化课不低于普通类相应科目组合本科控制线，专业录取控制分数线由院校自行确定并要求相应类别专业统考合格。",
        "高水平运动队按教育部和各高校规定执行。",
        "河北体育学院社会体育指导与管理（少数民族传统体育项目）文化线为历史318、物理300，专业成绩按学校公布合格线执行。",
      ],
      evidenceBoundary: "control-line-only=4; special-path-only=50; culture-plus-professional=28; non-numeric institution rules are policy notes; not institution-group, institution or major admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 4,
      specialPathRecords: 50,
      cultureProfessionalRecords: 28,
      routeCounts: Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
        .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length])),
      ordinaryBoundaries: {
        "历史类": { bachelor: 485, vocational: 200 },
        "物理类": { bachelor: 443, vocational: 200 },
      },
      professionalMetricCounts: Object.fromEntries([...new Set(records.filter((record) => record.professionalScoreMetric).map((record) => record.professionalScoreMetric))]
        .map((metric) => [metric, records.filter((record) => record.professionalScoreMetric === metric).length])),
    },
  };
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outFile), sourceId: SOURCE_ID, ...payload.diagnostics }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
