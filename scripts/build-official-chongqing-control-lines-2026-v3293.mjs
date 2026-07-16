#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T11:30:00.000Z";
const SOURCE_ID = "official-chongqing-control-lines-2026";
const SOURCE_URL = "https://jw.cq.gov.cn/zwxx_209/gggs/202606/t20260624_15774338.html";
const GOVERNMENT_URL = "https://www.cq.gov.cn/zwgk/zfxxgkzl/fdzdgknr/zdmsxx/jy/jy_ssqk/202606/t20260625_15775283.html";
const RANK_SOURCE_ID = "official-chongqing-rank-2026";
const RANK_INDEX_URL = "https://www.cqksy.cn/uploadFile/infopub/2026/ptgk/yfd/fdb.htm";
const RANK_HISTORY_URL = "https://www.cqksy.cn/uploadFile/infopub/2026/ptgk/yfd/wk.htm";
const RANK_PHYSICS_URL = "https://www.cqksy.cn/uploadFile/infopub/2026/ptgk/yfd/lk.htm";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/chongqing-2026");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-chongqing-control-lines-2026-import.json");

const EXPECTED = {
  controlPage: {
    file: "control-lines.html",
    bytes: 44018,
    sha256: "a6c014a0c36243197ebbf45bac7d5d5a60ad193b2eed558168852727a729db2a",
  },
  governmentSummary: {
    file: "government-summary.html",
    bytes: 81201,
    sha256: "4929eb5b7407407fd20d5e11d820c2d70ccc25f9b1fb6e7645e08b20099a8104",
  },
};

const ORDINARY_ROWS = [
  { subjectType: "历史类", section: "本科", minScore: 415, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "专科", minScore: 180, route: "ordinary-vocational" },
  { subjectType: "物理类", section: "本科", minScore: 406, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "专科", minScore: 180, route: "ordinary-vocational" },
];

const SPECIAL_ROWS = [
  { subjectType: "历史类", section: "特殊类型", category: "特殊类型资格线", minScore: 510, route: "special" },
  { subjectType: "物理类", section: "特殊类型", category: "特殊类型资格线", minScore: 496, route: "special" },
];

const ART_ROWS = [
  ["美术与设计类", 305, 180, 185],
  ["音乐教育", 330, 190, 180],
  ["音乐表演（声乐）", 265, 180, 175],
  ["音乐表演（器乐）", 265, 180, 175],
  ["舞蹈类", 248, 180, 190],
  ["戏剧影视表演", 345, 180, 195],
  ["服装表演", 328, 180, 200],
  ["戏剧影视导演", 376, 190, 205],
  ["播音与主持类", 368, 190, 195],
  ["书法类", 365, 190, 210],
];

const SPORTS_ROWS = [
  { section: "本科", minScore: 353, professionalMinScore: 73 },
  { section: "专科", minScore: 180, professionalMinScore: 73 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  return { ...expected };
}

function visibleHtmlText(buffer) {
  return buffer.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function recordId(row) {
  return `2026-chongqing-control-${sha256([
    row.subjectType,
    row.section,
    row.category,
    row.minScore,
    row.professionalMinScore ?? "",
    row.route,
  ].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route.startsWith("ordinary-");
  const hasProfessionalLine = Number.isFinite(row.professionalMinScore);
  const category = row.category || "普通类";
  const batch = ordinary
    ? `普通类${row.section}批录取最低控制分数线`
    : row.route === "special"
      ? `${row.subjectType}特殊类型资格线`
      : `${category}${row.section}批录取最低控制分数线`;
  const cautions = ordinary ? [
    "这是重庆市2026年普通类本科或专科批最低控制分数线，只用于判断对应批次的基本资格边界。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
    "推荐仍须结合2026一分一段位次、招生计划、选科要求、体检限制和正式投档数据复核。",
  ] : hasProfessionalLine ? [
    "这是重庆市2026年对应艺术或体育类别的文化与专业双门槛，不适用于普通类考生直接推荐。",
    "文化分和专业统考分必须同时达到对应类别、批次要求，不能只凭其中一个分数判断资格。",
    "该边界不是具体院校或专业投档线，还须核对综合成绩算法、招生章程和选科要求。",
  ] : [
    "这是重庆市2026年特殊类型资格线，只用于对应特殊类型招生资格复核，不替代普通本科线。",
    "达到资格线不等于获得任何院校或专业录取资格，仍须满足专项条件、校测或院校招生章程。",
    "本记录保持 special-path-only，不进入普通类院校推荐概率计算。",
  ];
  return {
    id: recordId(row),
    province: "重庆",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "重庆市2026年普通高校招生录取最低控制分数线",
    schoolTags: ["重庆官方控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "重庆",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMetric: hasProfessionalLine
      ? row.route === "sports" ? "重庆体育类专业统一考试" : "重庆艺术类专业统一考试"
      : undefined,
    scoreDimension: hasProfessionalLine ? "culture-and-professional" : "total-score",
    scoreBasis: hasProfessionalLine ? "culture-score" : "gaokao-total",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-chongqing-control-line-html-verified",
    sourceUrl: SOURCE_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: "data/admissions/raw/chongqing-2026/control-lines.html",
    sourcePublishedAt: "2026-06-24",
  };
}

const controlPage = verifyFile(EXPECTED.controlPage);
const governmentSummary = verifyFile(EXPECTED.governmentSummary);
const controlText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, controlPage.file)));
const governmentText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, governmentSummary.file)));

for (const phrase of [
  "重庆市2026年普通高校招生录取最低控制分数线",
  "历史类415510180",
  "物理类406496180",
  "美术与设计类305180185",
  "音乐教育330190180",
  "音乐表演（声乐）265180175",
  "戏剧影视导演376190205",
  "播音与主持类368190195",
  "书法类365190210",
  "本科批35373",
  "专科批180",
]) {
  assert(controlText.includes(phrase), `Control page is missing: ${phrase}`);
}
for (const phrase of [
  "历史类本科批为415分，特殊类型资格线510分，专科批180分",
  "物理类本科批为406分，特殊类型资格线为496分，专科批180分",
  "415分及以上38962人",
  "510分及以上15208人",
  "600分及以上2120人",
  "663分及以上60人",
  "406分及以上107000人",
  "496分及以上65519人",
  "600分及以上12895人",
  "684分及以上157人",
]) {
  assert(governmentText.includes(phrase), `Government summary is missing: ${phrase}`);
}

const records = [
  ...ORDINARY_ROWS.map((row) => makeRecord({ ...row, category: "普通类" })),
  ...SPECIAL_ROWS.map(makeRecord),
  ...ART_ROWS.flatMap(([category, bachelor, vocational, professionalMinScore]) => [
    makeRecord({ subjectType: "艺术类", section: "本科", category, minScore: bachelor, professionalMinScore, route: "art" }),
    makeRecord({ subjectType: "艺术类", section: "专科", category, minScore: vocational, professionalMinScore, route: "art" }),
  ]),
  ...SPORTS_ROWS.map((row) => makeRecord({ ...row, subjectType: "体育类", category: "体育类", route: "sports" })),
];

assert(records.length === 28, `Expected 28 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 24, "Expected 24 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 22, "Expected 22 culture-professional records");

const payload = {
  dataset: "official-chongqing-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "重庆", year: 2026, sourceKind: "official-control-lines" },
  notes: [
    "重庆2026普通类历史本科415分、专科180分，物理本科406分、专科180分进入普通资格路由。",
    "历史510分、物理496分特殊类型资格线，以及20条艺术、2条体育文化/专业双门槛均保持 special-path-only。",
    "既有988条重庆2026普通类一分一段记录不改分数和位次；本轮补齐历史/物理正式页面URL，并用重庆市政府摘要交叉核验关键累计人数。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "重庆",
    title: "重庆市2026年普通高校招生录取最低控制分数线",
    publisher: "重庆市教育委员会 / 重庆市教育考试院",
    publishedAt: "2026-06-24",
    url: SOURCE_URL,
    relatedUrls: [GOVERNMENT_URL, RANK_INDEX_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL],
    quality: "official-chongqing-control-line-html-verified",
    usage: "抽取重庆2026普通类、特殊类型、艺术和体育录取控制线28条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    controlPageBytes: controlPage.bytes,
    controlPageSha256: controlPage.sha256,
    governmentSummaryBytes: governmentSummary.bytes,
    governmentSummarySha256: governmentSummary.sha256,
    governmentCrossCheck: {
      url: GOVERNMENT_URL,
      history: { bachelorScore: 415, bachelorCumulative: 38962, specialScore: 510, specialCumulative: 15208, score600Cumulative: 2120, topScore: 663, topCumulative: 60 },
      physics: { bachelorScore: 406, bachelorCumulative: 107000, specialScore: 496, specialCumulative: 65519, score600Cumulative: 12895, topScore: 684, topCumulative: 157 },
    },
    rankEvidence: { sourceId: RANK_SOURCE_ID, records: 988, historyUrl: RANK_HISTORY_URL, physicsUrl: RANK_PHYSICS_URL },
    evidenceBoundary: "control-line-only=4; special-path-only=24; culture-and-professional=22; rank rows=988 unchanged; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 24,
    cultureProfessionalRecords: 22,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, art: 20, sports: 2 },
    ordinaryBoundaries: { historyBachelor: 415, historyVocational: 180, physicsBachelor: 406, physicsVocational: 180 },
    rankRecords: 988,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  out: path.relative(PROJECT_ROOT, OUTPUT_FILE),
  diagnostics: payload.diagnostics,
  evidence: { controlPage, governmentSummary },
}, null, 2));
