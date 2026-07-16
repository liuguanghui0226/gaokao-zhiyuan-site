#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T13:45:00.000Z";
const SOURCE_ID = "official-gansu-control-lines-2026";
const SOURCE_URL = "https://www.ganseea.cn/shouyegonggao/1904.html";
const RANK_SOURCE_ID = "gk100-gansu-rank-2026";
const RANK_SOURCE_URL = "https://www.gk100.com/read_33990869.htm";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/gansu-2026");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-gansu-control-lines-2026-import.json");

const EXPECTED = {
  controlPage: { file: "control-lines.html", bytes: 13254, sha256: "7307b7d293849ac589fe09aed5b6a5bd5f9cd65a9b5e92455ab312cc136d01ed" },
  ordinary: { file: "ordinary.png", bytes: 21564, width: 629, height: 355, sha256: "41e7dedbd2a5ecd9bf2678f38781f9119d1b133b52c1c67c26cee2340546cbec" },
  artSportsBachelor: { file: "art-sports-bachelor.png", bytes: 55919, width: 522, height: 816, sha256: "964136c81ae377d11cf4dd51379d98ceff4ffbb320c1eabdb6c8d7e54642aafc" },
  artSportsVocational: { file: "art-sports-vocational.png", bytes: 54604, width: 521, height: 816, sha256: "2064f2f6d09a4b7a5f5a3c2a1efaaab50b98b47521c908c15bf613c708506626" },
  secondaryVocational: { file: "secondary-vocational.png", bytes: 37072, width: 565, height: 610, sha256: "1c6532ba16f77be4063f90f490c2318a3848a0a4706cc3d561d52501f22436c9" },
};

const ORDINARY_ROWS = [
  { subjectType: "历史类", section: "本科", minScore: 405, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "高职（专科）", minScore: 160, route: "ordinary-vocational" },
  { subjectType: "物理类", section: "本科", minScore: 367, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "高职（专科）", minScore: 180, route: "ordinary-vocational" },
];

const SPECIAL_ROWS = [
  { subjectType: "历史类", section: "特殊类型", category: "特殊类型资格线", minScore: 508, route: "special" },
  { subjectType: "物理类", section: "特殊类型", category: "特殊类型资格线", minScore: 477, route: "special" },
];

const ART_ROWS = [
  ["美术与设计类", 275, 190],
  ["书法类", 275, 214],
  ["音乐类（音乐表演-声乐）", 275, 234],
  ["音乐类（音乐教育-声乐）", 275, 227],
  ["音乐类（音乐表演-器乐）", 275, 216],
  ["音乐类（音乐教育-器乐）", 275, 222],
  ["舞蹈类", 275, 235],
  ["播音与主持类", 367, 212],
  ["表（导）演类（戏剧影视表演）", 275, 217],
  ["表（导）演类（戏剧影视导演）", 275, 224],
  ["表（导）演类（服装表演）", 275, 211],
];

const SPORTS_ROWS = [
  ["体育类（田径）", 275, 248],
  ["体育类（足球、篮球、排球）", 275, 237],
  ["体育类（武术、体操）", 275, 237],
];

const SECONDARY_VOCATIONAL_ROWS = [
  ["农林牧渔类", 510],
  ["医药卫生类", 594],
  ["工业类", 514],
  ["土木水利类", 482],
  ["信息技术类", 508],
  ["财经商贸类", 547],
  ["旅游服务类", 455],
  ["教育与文化艺术类", 564],
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
  return `2026-gansu-control-${sha256([
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
  const requiresProfessionalQualification = Boolean(row.professionalQualification);
  const category = row.category || "普通类";
  const batch = ordinary
    ? `普通类${row.section}批录取最低控制分数线`
    : row.route === "special"
      ? `${row.subjectType}特殊类型资格线`
      : row.route === "secondary-vocational"
        ? `中职升学${category}${row.section}批录取最低控制分数线`
        : `${category}${row.section}批录取最低控制分数线`;
  const specialPath = !ordinary;
  const cautions = ordinary ? [
    "这是甘肃省2026年普通类对应科类本科或高职专科批最低控制分数线，只用于判断基本资格边界。",
    "历史类高职专科线为160分，物理类为180分，必须按首选科目分别判断，不能互换。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ] : hasProfessionalLine ? [
    "这是甘肃省2026年对应艺术或体育统考类别的文化课与专业课双门槛，不适用于普通类考生直接推荐。",
    "文化分和专业统考分必须分别达到对应类别、批次要求，不能相加，也不能只凭其中一个分数判断资格。",
    "该边界不是具体院校或专业投档线，还须核对综合成绩算法、招生章程和选科要求。",
  ] : row.route === "secondary-vocational" ? [
    "这是甘肃省2026年高等职业教育中职升学考试分类控制线，只适用于对应中职类别考生。",
    "中职升学成绩口径不同于普通高考总分，不进入普通物理类或历史类推荐路由。",
    "控制线不是具体院校或专业录取线，仍须核对招生计划、类别资格和正式投档结果。",
  ] : [
    "这是甘肃省2026年特殊类型或艺术校考资格边界，不替代普通类本科控制线。",
    "达到文化线仍不等于获得院校或专业录取资格，专业合格、统考合格或其他专项条件须另行满足。",
    "本记录保持 special-path-only，不进入普通类院校推荐概率计算。",
  ];
  return {
    id: recordId(row),
    province: "甘肃",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "甘肃省2026年普通高校招生录取最低控制分数线",
    schoolTags: ["甘肃官方控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "甘肃",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    candidateCategory: row.route === "secondary-vocational" ? category : undefined,
    minScore: row.minScore,
    cultureScoreLine: row.route === "secondary-vocational" ? undefined : row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalQualification: row.professionalQualification,
    professionalScoreMetric: hasProfessionalLine
      ? row.route === "sports" ? "甘肃体育类专业统一考试" : "甘肃艺术类专业统一考试"
      : undefined,
    scoreDimension: hasProfessionalLine
      ? "culture-and-professional"
      : requiresProfessionalQualification ? "culture-and-qualification" : "total-score",
    scoreBasis: row.route === "secondary-vocational"
      ? "secondary-vocational-entrance-exam-total"
      : hasProfessionalLine || requiresProfessionalQualification ? "culture-score" : "gaokao-total",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-gansu-control-line-direct-page-and-image-verified",
    sourceUrl: SOURCE_URL,
    formalScoreScope: specialPath ? "special-path-only" : "control-line-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: row.sourceFile || "data/admissions/raw/gansu-2026/control-lines.html",
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlHtml = fs.readFileSync(path.join(RAW_DIR, evidence.controlPage.file), "utf8");
const controlText = visibleHtmlText(Buffer.from(controlHtml));
for (const phrase of [
  "2026年甘肃省普通高校招生录取分数线公布",
  "2026年甘肃省普通高校招生录取最低控制分数线",
  "物理类367分，历史类405分",
  "戏曲类专业省际联考文化课录取最低控制分数线184分",
]) {
  assert(controlText.includes(phrase), `Official control page is missing: ${phrase}`);
}
for (const imageName of [
  "31-26062515053J45.png",
  "31-260625150629159.png",
  "31-260625150A2S6.png",
  "31-260625151124257.png",
]) {
  assert(controlHtml.includes(imageName), `Official control page image reference is missing: ${imageName}`);
}

const records = [
  ...ORDINARY_ROWS.map((row) => makeRecord({ ...row, category: "普通类", sourceFile: "data/admissions/raw/gansu-2026/ordinary.png" })),
  ...SPECIAL_ROWS.map((row) => makeRecord({ ...row, sourceFile: "data/admissions/raw/gansu-2026/ordinary.png" })),
  ...ART_ROWS.flatMap(([category, bachelorCulture, bachelorProfessional]) => [
    makeRecord({ subjectType: "艺术类", section: "本科", category, minScore: bachelorCulture, professionalMinScore: bachelorProfessional, route: "art", sourceFile: "data/admissions/raw/gansu-2026/art-sports-bachelor.png" }),
    makeRecord({ subjectType: "艺术类", section: "高职（专科）", category, minScore: 160, professionalMinScore: 160, route: "art", sourceFile: "data/admissions/raw/gansu-2026/art-sports-vocational.png" }),
  ]),
  ...SPORTS_ROWS.flatMap(([category, bachelorCulture, bachelorProfessional]) => [
    makeRecord({ subjectType: "体育类", section: "本科", category, minScore: bachelorCulture, professionalMinScore: bachelorProfessional, route: "sports", sourceFile: "data/admissions/raw/gansu-2026/art-sports-bachelor.png" }),
    makeRecord({ subjectType: "体育类", section: "高职（专科）", category, minScore: 160, professionalMinScore: 160, route: "sports", sourceFile: "data/admissions/raw/gansu-2026/art-sports-vocational.png" }),
  ]),
  makeRecord({ subjectType: "历史类", section: "艺术类专业校考本科", category: "艺术类专业校考", minScore: 405, professionalQualification: "专业课合格且相应专业统考合格", route: "art-school-exam" }),
  makeRecord({ subjectType: "物理类", section: "艺术类专业校考本科", category: "艺术类专业校考", minScore: 367, professionalQualification: "专业课合格且相应专业统考合格", route: "art-school-exam" }),
  makeRecord({ subjectType: "艺术类", section: "戏曲类专业省际联考本科", category: "戏曲类专业省际联考", minScore: 184, professionalQualification: "专业课合格", route: "opera-interprovincial" }),
  ...SECONDARY_VOCATIONAL_ROWS.flatMap(([category, bachelor]) => [
    makeRecord({ subjectType: "中职升学", section: "本科", category, minScore: bachelor, route: "secondary-vocational", sourceFile: "data/admissions/raw/gansu-2026/secondary-vocational.png" }),
    makeRecord({ subjectType: "中职升学", section: "高职（专科）", category, minScore: 120, route: "secondary-vocational", sourceFile: "data/admissions/raw/gansu-2026/secondary-vocational.png" }),
  ]),
];

assert(records.length === 53, `Expected 53 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 49, "Expected 49 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 28, "Expected 28 culture-professional records");

const payload = {
  dataset: "official-gansu-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "甘肃", year: 2026, sourceKind: "official-control-lines" },
  notes: [
    "甘肃2026普通类历史本科405分、专科160分，物理本科367分、专科180分进入普通资格路由。",
    "特殊类型2条、艺体统考28条、艺术校考/戏曲3条和中职升学16条共49条保持 special-path-only。",
    "既有1343条甘肃2026位次记录继续保持第三方图片镜像口径；本轮仅用考试院正式控制线交叉核验6个关键分数累计位次，不改任何位次数值，也不升级为官方一分一段。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "甘肃",
    title: "2026年甘肃省普通高校招生录取分数线公布",
    publisher: "甘肃省教育考试院",
    publishedAt: "2026-06-25",
    url: SOURCE_URL,
    relatedUrls: [
      "https://www.ganseea.cn/uploads/allimg/20260625/31-26062515053J45.png",
      "https://www.ganseea.cn/uploads/allimg/20260625/31-260625150629159.png",
      "https://www.ganseea.cn/uploads/allimg/20260625/31-260625150A2S6.png",
      "https://www.ganseea.cn/uploads/allimg/20260625/31-260625151124257.png",
      RANK_SOURCE_URL,
    ],
    quality: "official-gansu-control-line-direct-page-and-image-verified",
    usage: "抽取甘肃2026普通类、特殊类型、艺术体育、中职升学控制线53条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    controlPage: evidence.controlPage,
    images: [evidence.ordinary, evidence.artSportsBachelor, evidence.artSportsVocational, evidence.secondaryVocational],
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 1343,
      quality: "third-party-gk100-gansu-rank-conversion-image-tesseract-grid-validated",
      valueChanges: 0,
      officialRankPageFound: false,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 160, vocationalRankEnd: 48149, bachelorScore: 405, bachelorRankEnd: 25199, specialScore: 508, specialRankEnd: 8306 },
        physics: { vocationalScore: 180, vocationalRankEnd: 118170, bachelorScore: 367, bachelorRankEnd: 95355, specialScore: 477, specialRankEnd: 41347 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=49; culture-and-professional=28; rank rows=1343 remain third-party mirror and unchanged; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 49,
    cultureProfessionalRecords: 28,
    qualificationRecords: 3,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, art: 22, sports: 6, "art-school-exam": 2, "opera-interprovincial": 1, "secondary-vocational": 16 },
    ordinaryBoundaries: { historyBachelor: 405, historyVocational: 160, physicsBachelor: 367, physicsVocational: 180 },
    rankRecords: 1343,
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
