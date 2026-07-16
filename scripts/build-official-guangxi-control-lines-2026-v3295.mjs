#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T15:30:00.000Z";
const SOURCE_ID = "official-guangxi-control-lines-2026";
const SOURCE_URL = "https://www.gxeea.cn/view/content_619_32889.htm";
const RANK_SOURCE_ID = "official-guangxi-rank-2026";
const RANK_INDEX_URL = "https://www.gxeea.cn/view/content_722_32896.htm";
const RANK_HISTORY_URL = "https://www.gxeea.cn/2026yfyd/yifenyidang/2026_yifenyidang_lishi_qg.html";
const RANK_PHYSICS_URL = "https://www.gxeea.cn/2026yfyd/yifenyidang/2026_yifenyidang_wuli_qg.html";
const UNIVERSITY_LINK_URL = "https://zsw.bbgu.edu.cn/info/1005/3223.htm";
const UNIVERSITY_MIRROR_URL = "https://www.tic-gx.com/info/1033/42692.htm";
const UNIVERSITY_IMAGE_URL = "https://www.tic-gx.com/__local/F/ED/26/5F5396BF556C34AC4F9C3C1CFBC_0165BE39_8E40C.png";
const CHINANEWS_MIRROR_URL = "https://m.sohu.com/a/1041526143_123753";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/guangxi-2026");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-guangxi-control-lines-2026-import.json");

const EXPECTED = {
  universityLinkPage: { file: "university-link-mirror-page.html", bytes: 14393, sha256: "b38d68575fb3ab14c6e5cc5f7026b6af9ab47bde53a627548feece29979700f7" },
  universityMirrorPage: { file: "university-mirror-page.html", bytes: 56701, sha256: "e9b1503379a61a59375cd02fa9bee5647e7f58015c03277b1d5eab8f093fc1c5" },
  universityOfficialImage: { file: "university-official-content-mirror.png", bytes: 582668, width: 1132, height: 3264, sha256: "51404304947a3671f30e18256fd692f1984f4f6270b8d6f0e89489f45563724c" },
  chinaNewsTextMirror: { file: "chinanews-text-mirror.html", bytes: 15335, sha256: "507f2e5f7b69521c549ffed0176f91c14d4b297581cdc3b1752e86e51ff14ac7" },
  independentImageMirror1: { file: "third-party-content-mirror-1.png", bytes: 1498154, width: 1133, height: 3264, sha256: "2272aead22c0f7e83f14544147d4908763691f6e93d9ed33eb48e197dd5e4c90" },
  independentImageMirror2: { file: "third-party-content-mirror-2.png", bytes: 1497974, width: 1133, height: 3264, sha256: "c1eacb925b3abdac087002e44f0a2ea85d6f224f7422027a4891c7f98d0b95f5" },
};

const ORDINARY_ROWS = [
  { subjectType: "历史类", section: "本科", minScore: 398, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "高职高专", minScore: 180, route: "ordinary-vocational" },
  { subjectType: "物理类", section: "本科", minScore: 368, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "高职高专", minScore: 180, route: "ordinary-vocational" },
];

const SPECIAL_ROWS = [
  { subjectType: "历史类", section: "特殊类型招生", category: "特殊类型资格线", minScore: 520, route: "special" },
  { subjectType: "物理类", section: "特殊类型招生", category: "特殊类型资格线", minScore: 510, route: "special" },
];

const SPORTS_ROWS = [
  { subjectType: "历史类", section: "本科", category: "体育类", minScore: 285, professionalMinScore: 83, route: "sports" },
  { subjectType: "物理类", section: "本科", category: "体育类", minScore: 297, professionalMinScore: 83, route: "sports" },
  { subjectType: "历史类", section: "高职高专", category: "体育类", minScore: 160, professionalMinScore: 60, route: "sports" },
  { subjectType: "物理类", section: "高职高专", category: "体育类", minScore: 160, professionalMinScore: 60, route: "sports" },
];

const ART_ROWS = [
  ["音乐类（音乐表演方向）", 175, 170],
  ["音乐类（音乐教育方向）", 175, 170],
  ["舞蹈类", 195, 190],
  ["表（导）演类（戏剧影视表演方向）", 210, 195],
  ["表（导）演类（服装表演方向）", 210, 205],
  ["表（导）演类（戏剧影视导演方向）", 210, 205],
  ["播音与主持类", 205, 200],
  ["美术与设计类", 200, 195],
  ["书法类", 225, 210],
  ["戏曲类", 180, 180],
];

const ART_CULTURE_LINES = {
  本科: { 历史类: 299, 物理类: 276 },
  高职高专: { 历史类: 126, 物理类: 126 },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pngDimensions(buffer) {
  assert(buffer.subarray(1, 4).toString("ascii") === "PNG", "Expected PNG evidence");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  if (expected.width) {
    const dimensions = pngDimensions(bytes);
    assert(dimensions.width === expected.width && dimensions.height === expected.height, `${expected.file} dimensions drifted`);
  }
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
  return `2026-guangxi-control-${sha256([
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
    ? `普通类${row.section}批次录取最低控制分数线`
    : row.route === "special"
      ? `${row.subjectType}特殊类型招生录取最低控制分数线`
      : `${category}${row.section}批次录取最低控制分数线`;
  const cautions = ordinary ? [
    "这是广西2026年普通类对应首选科目本科或高职高专批次录取最低控制分数线，只用于判断基本资格边界。",
    "历史类本科398分、物理类本科368分；高职高专两科均为180分，必须按首选科目和批次判断。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ] : hasProfessionalLine ? [
    `这是广西2026年${category}${row.section}批次的文化课与专业统考双门槛，只适用于对应艺体类别考生。`,
    "文化分和专业统考分必须分别达到对应类别、科类和批次要求，不能相加，也不能只凭其中一个分数判断资格。",
    "该边界不是具体院校或专业投档线，还须核对综合成绩算法、招生章程、选科要求和当年招生计划。",
  ] : [
    "这是广西2026年特殊类型招生资格线，适用于强基计划、高校专项计划、军队院校等相应路径，不替代普通类本科控制线。",
    "达到资格线不等于获得院校或专业录取资格，专项条件、体检政审、校测或招生章程要求须另行满足。",
    "本记录保持 special-path-only，不进入普通类院校推荐概率计算。",
  ];
  return {
    id: recordId(row),
    province: "广西",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "广西2026年普通高校招生录取最低控制分数线",
    schoolTags: ["广西官方内容镜像控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "广西",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMetric: hasProfessionalLine
      ? row.route === "sports" ? "广西体育统考" : "广西艺术统考"
      : undefined,
    scoreDimension: hasProfessionalLine ? "culture-and-professional" : "total-score",
    scoreBasis: hasProfessionalLine ? "culture-score" : "gaokao-total",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-content-mirror-guangxi-control-line-image-and-chinanews-text-verified",
    sourceUrl: SOURCE_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: "data/admissions/raw/guangxi-2026/university-official-content-mirror.png",
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const universityLinkHtml = fs.readFileSync(path.join(RAW_DIR, evidence.universityLinkPage.file));
const universityMirrorHtml = fs.readFileSync(path.join(RAW_DIR, evidence.universityMirrorPage.file));
const chinaNewsHtml = fs.readFileSync(path.join(RAW_DIR, evidence.chinaNewsTextMirror.file));
const universityLinkText = visibleHtmlText(universityLinkHtml);
const universityMirrorText = visibleHtmlText(universityMirrorHtml);
const chinaNewsText = visibleHtmlText(chinaNewsHtml);

for (const phrase of [
  "广西2026年普通高校招生录取最低控制分数线公布",
  "来源：广西招生考试院",
  "作者：广西招生考试院",
  SOURCE_URL,
]) {
  assert(universityLinkText.includes(phrase), `University link mirror is missing: ${phrase}`);
}
for (const phrase of [
  "广西2026年普通高校招生录取最低控制分数线公布",
  "发布时间：2026-06-25",
  "来源：广西招生考试院",
]) {
  assert(universityMirrorText.includes(phrase), `University content mirror is missing: ${phrase}`);
}
assert(universityMirrorHtml.toString("utf8").includes("/__local/F/ED/26/5F5396BF556C34AC4F9C3C1CFBC_0165BE39_8E40C.png"), "University content mirror image reference drifted");
for (const phrase of [
  "广西壮族自治区招生考试院公布广西2026年普通高校招生录取最低控制分数线",
  "本科批次录取最低控制分数线：首选历史398分，首选物理368分",
  "特殊类型招生录取最低控制分数线：首选历史520分，首选物理510分",
  "高职高专批次录取最低控制分数线：首选历史180分，首选物理180分",
  "体育类本科批次(文化/体育统考)首选历史285分/83分，首选物理297分/83分",
  "体育类高职高专批次(文化/体育统考)首选历史160分/60分，首选物理160分/60分",
  "艺术类本科批次文化分数线首选历史299分，首选物理276分",
  "书法类225分，戏曲类180分",
  "艺术类高职高专批次文化分数线首选历史126分，首选物理126分",
  "书法类210分，戏曲类180分",
]) {
  assert(chinaNewsText.includes(phrase), `China News text mirror is missing: ${phrase}`);
}

const records = [
  ...ORDINARY_ROWS.map((row) => makeRecord({ ...row, category: "普通类" })),
  ...SPECIAL_ROWS.map(makeRecord),
  ...SPORTS_ROWS.map(makeRecord),
  ...ART_ROWS.flatMap(([category, bachelorProfessional, vocationalProfessional]) =>
    ["历史类", "物理类"].flatMap((subjectType) => [
      makeRecord({ subjectType, section: "本科", category, minScore: ART_CULTURE_LINES.本科[subjectType], professionalMinScore: bachelorProfessional, route: "art" }),
      makeRecord({ subjectType, section: "高职高专", category, minScore: ART_CULTURE_LINES.高职高专[subjectType], professionalMinScore: vocationalProfessional, route: "art" }),
    ])),
];

assert(records.length === 50, `Expected 50 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 46, "Expected 46 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 44, "Expected 44 culture-professional records");

const payload = {
  dataset: "official-guangxi-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "广西", year: 2026, sourceKind: "official-content-mirror-control-lines" },
  notes: [
    "广西2026普通类历史本科398分、专科180分，物理本科368分、专科180分进入普通资格路由。",
    "特殊类型2条、体育4条和艺术40条共46条保持 special-path-only；44条艺体记录把文化分和专业统考分分字段保存。",
    "广西招生考试院原站在本轮网络环境中TLS连接失败；控制线依据广西高校转载的考试院原图和中新网文字镜像交叉核验，明确标注 official-content-mirror，不声称原站页面已重新下载。",
    "既有1012条广西2026普通类官方一分一档记录不改分数和位次，本轮只补齐历史/物理对应考试院页面URL。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "广西",
    title: "广西2026年普通高校招生录取最低控制分数线公布",
    publisher: "广西壮族自治区招生考试院（广西高校转载原图；中新网文字交叉核验）",
    publishedAt: "2026-06-25",
    url: SOURCE_URL,
    relatedUrls: [UNIVERSITY_LINK_URL, UNIVERSITY_MIRROR_URL, UNIVERSITY_IMAGE_URL, CHINANEWS_MIRROR_URL, RANK_INDEX_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL],
    quality: "official-content-mirror-guangxi-control-line-image-and-chinanews-text-verified",
    usage: "抽取广西2026普通类、特殊类型、体育和艺术控制线50条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    directPageRedownloadStatus: "blocked-current-session-tls",
    canonicalOfficialUrlRetained: true,
    evidence,
    manualVisualVerification: {
      verifiedAt: "2026-07-16",
      finding: "高校转载原图清晰展示全部控制线，底部署名为广西壮族自治区招生考试院，日期为2026年6月25日；逐项数值与中新网文字镜像一致。",
    },
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 1012,
      historyUrl: RANK_HISTORY_URL,
      physicsUrl: RANK_PHYSICS_URL,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 180, vocationalRankEnd: 109518, bachelorScore: 398, bachelorRankEnd: 49420, specialScore: 520, specialRankEnd: 11410 },
        physics: { vocationalScore: 180, vocationalRankEnd: 255675, bachelorScore: 368, bachelorRankEnd: 179539, specialScore: 510, specialRankEnd: 60703 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=46; culture-and-professional=44; rank rows=1012 official URL inventory retained and values unchanged; control source is official-content-mirror, not current-session direct download; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 46,
    cultureProfessionalRecords: 44,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 4, art: 40 },
    ordinaryBoundaries: { historyBachelor: 398, historyVocational: 180, physicsBachelor: 368, physicsVocational: 180 },
    rankRecords: 1012,
    rankValueChanges: 0,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  out: path.relative(PROJECT_ROOT, OUTPUT_FILE),
  diagnostics: payload.diagnostics,
  evidence,
}, null, 2));
