#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T16:30:00.000Z";
const SOURCE_ID = "official-heilongjiang-control-lines-2026";
const RANK_SOURCE_ID = "official-heilongjiang-rank-2026";
const CONTROL_URL = "https://www.hlj.gov.cn/hlj/c108427/202606/c00_31953024.shtml";
const RANK_PAGE_URL = "https://jyt.hlj.gov.cn/jyt/c110476/202606/c00_31952462.shtml";
const RANK_HISTORY_URL = "https://jyt.hlj.gov.cn/jyt/c110476/202606/31952462/files/1.%E9%BB%91%E9%BE%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E5%8E%86%E5%8F%B2%E7%B1%BB%E6%96%87%E5%8C%96%E8%AF%BE%E4%B8%80%E5%88%86%E6%AE%B5%E7%BB%9F%E8%AE%A1%E8%A1%A8.xls";
const RANK_PHYSICS_URL = "https://jyt.hlj.gov.cn/jyt/c110476/202606/31952462/files/2.%E9%BB%91%E9%BE%99%E6%B1%9F%E7%9C%812026%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E7%89%A9%E7%90%86%E7%B1%BB%E6%96%87%E5%8C%96%E8%AF%BE%E4%B8%80%E5%88%86%E6%AE%B5%E7%BB%9F%E8%AE%A1%E8%A1%A8.xls";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/heilongjiang-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-heilongjiang-control-lines-2026-import.json");

const EXPECTED = {
  controlPage: { file: "official-government-control-lines.html", bytes: 18911, sha256: "26ff5c8469380e854a5346b4b0ec262823daee4a30051872fa08af376b921159" },
  rankPage: { file: "official-education-rank-page.html", bytes: 63639, sha256: "e2b079cd87480dee32e8f5e285179eb6b384b7bcc6e26889ed1b4cd730b220d2" },
  rankHistory: { file: "official-rank-history.xls", bytes: 46592, sha256: "e7beb16f3d3a925ad2fbe6fcc83d35bce16a216bda394e22e37052bbb2f00bcd" },
  rankPhysics: { file: "official-rank-physics.xls", bytes: 48128, sha256: "9e70a27172d6c1a4ebe1b57386d14feaa13e71b5bab03c6a798aaadda53007e0" },
};

const ART_ROWS = [
  ["美术与设计类", 255, 150],
  ["音乐类", 255, 140],
  ["舞蹈类", 255, 180],
  ["播音与主持类", 255, 180],
  ["书法类", 255, 180],
  ["表（导）演类", 255, 170],
  ["戏曲类", 170, 180],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
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

function rankUrlForSubject(subjectType) {
  if (subjectType === "历史类") return RANK_HISTORY_URL;
  if (subjectType === "物理类") return RANK_PHYSICS_URL;
  throw new Error(`Unexpected Heilongjiang rank subject: ${subjectType}`);
}

function parseRankXls(expected, subjectType, topScore, expectedRows, expectedFinal) {
  const input = path.join(RAW_DIR, expected.file);
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaokao-hlj-rank-csv-"));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaokao-hlj-soffice-"));
  const result = spawnSync("soffice", [
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    "--headless",
    "--convert-to",
    "csv",
    "--outdir",
    outputDir,
    input,
  ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert(result.status === 0, `LibreOffice conversion failed for ${expected.file}: ${result.stderr}`);
  const csvFile = path.join(outputDir, `${path.basename(expected.file, ".xls")}.csv`);
  assert(fs.existsSync(csvFile), `Converted CSV is missing for ${expected.file}`);
  const rows = fs.readFileSync(csvFile, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((cells) => /^\d+(以上)?$/.test(cells[0]) && /^\d+$/.test(cells[1]) && /^\d+$/.test(cells[2]))
    .map((cells) => ({
      score: Number(cells[0].replace("以上", "")),
      topBucket: cells[0].includes("以上"),
      sameRankScore: Number(cells[1]),
      rankEnd: Number(cells[2]),
    }));
  assert(rows.length === expectedRows, `${subjectType} rank XLS row count drifted: ${rows.length}`);
  assert(rows[0].score === topScore && rows[0].topBucket, `${subjectType} top bucket drifted`);
  assert(rows.at(-1).score === 150 && rows.at(-1).rankEnd === expectedFinal, `${subjectType} final rank row drifted`);
  assert(new Set(rows.map((row) => row.score)).size === rows.length, `${subjectType} contains duplicate score rows`);
  let prior = 0;
  for (const row of rows) {
    assert(row.rankEnd === prior + row.sameRankScore, `${subjectType}/${row.score} cumulative count is discontinuous`);
    row.rankStart = prior + 1;
    prior = row.rankEnd;
  }

  const shard = readGzipJson(path.join(RELEASE_DIR, "heilongjiang.json.gz"));
  const runtimeRows = shard.rankConversions.filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === subjectType);
  assert(runtimeRows.length === expectedRows, `${subjectType} runtime rank row count drifted: ${runtimeRows.length}`);
  const allUnlinked = runtimeRows.every((row) => !row.sourceUrl);
  const allLinked = runtimeRows.every((row) => row.sourceUrl === rankUrlForSubject(subjectType));
  assert(allUnlinked || allLinked, `${subjectType} rank URLs are partially applied or unexpected`);
  const byScore = new Map(runtimeRows.map((row) => [row.score, row]));
  for (const parsed of rows) {
    const runtime = byScore.get(parsed.score);
    assert(runtime, `Missing runtime ${subjectType} row at ${parsed.score}`);
    assert(runtime.sameRankScore === parsed.sameRankScore, `${subjectType}/${parsed.score} same-score count drifted`);
    assert(runtime.rankStart === parsed.rankStart && runtime.rankEnd === parsed.rankEnd, `${subjectType}/${parsed.score} rank bounds drifted`);
    if (parsed.topBucket) {
      assert(runtime.scoreRange?.min === topScore && runtime.scoreRange?.max === 750, `${subjectType} top score range drifted`);
    }
  }
  return {
    subjectType,
    rowsCompared: rows.length,
    exactRows: rows.length - 1,
    topBucketRows: 1,
    scoreMin: 150,
    scoreMax: topScore,
    finalCumulative: expectedFinal,
    zeroPersonScoresOmitted: topScore - 150 + 1 - rows.length,
    valueDifferences: 0,
    rankRowsNeedingSourceUrlOnV3297Base: runtimeRows.filter((row) => !row.sourceUrl).length,
  };
}

function recordId(row) {
  return `2026-heilongjiang-control-${sha256([
    row.subjectType,
    row.section,
    row.category,
    row.minScore,
    row.professionalMinScore,
    row.route,
  ].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route.startsWith("ordinary-");
  const art = row.route === "art";
  const sports = row.route === "sports";
  const hasProfessionalScore = Number.isFinite(row.professionalMinScore);
  const hasProfessionalQualification = Boolean(row.professionalQualification);
  const category = row.category || "普通类";
  const batch = row.route === "ordinary-bachelor"
    ? "普通本科批录取控制分数线"
    : row.route === "ordinary-vocational"
      ? "普通高职（专科）批录取控制分数线"
      : row.route === "special"
        ? "特殊类型招生资格线"
        : sports
          ? `体育类${row.section}文化课录取控制分数线`
          : art && row.section === "本科"
            ? `艺术类本科批（${category}）文化课和专业课录取控制分数线`
            : "艺术类高职（专科）批文化课录取控制分数线";
  const cautions = ordinary ? [
    `这是黑龙江省2026年${batch}，只用于判断${row.subjectType}普通${row.section}基本资格边界。`,
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ] : sports ? [
    `这是黑龙江省2026年${batch}，只适用于体育类${row.subjectType}考生。`,
    hasProfessionalScore
      ? `文化成绩${row.minScore}分和术科成绩${row.professionalMinScore}分是两个独立门槛，不得相加。`
      : "本公告只公布该专科路径文化线，未给出专科术科数值；仍须核对当年专业要求和招生章程。",
    "该记录保持 special-path-only，不进入普通类资格线或普通录取概率计算。",
  ] : art ? [
    `这是黑龙江省2026年${batch}，只适用于对应艺术类别考生。`,
    hasProfessionalScore
      ? `文化成绩${row.minScore}分和专业课成绩${row.professionalMinScore}分是两个独立门槛，不得相加。`
      : "本公告只公布艺术类专科文化线，未给出专科专业课数值；仍须满足对应专业要求。",
    "该记录保持 special-path-only，不进入普通类资格线或普通录取概率计算。",
  ] : [
    `这是黑龙江省2026年${batch}，属于特殊类型路径，不替代普通本科或普通专科控制线。`,
    "达到该线不等于获得具体院校或专业录取资格，仍须核对项目资格和招生章程。",
    "该记录保持 special-path-only，不进入普通类院校推荐概率计算。",
  ];
  return {
    id: recordId(row),
    province: "黑龙江",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "黑龙江省2026年普通高校招生各批次录取控制分数线",
    schoolTags: ["黑龙江官方控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "黑龙江",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMetric: hasProfessionalScore ? (sports ? "体育类术科" : "艺术类专业课") : undefined,
    professionalQualification: row.professionalQualification,
    scoreDimension: hasProfessionalScore
      ? "culture-and-professional"
      : hasProfessionalQualification
        ? "culture-and-qualification"
        : ordinary || row.route === "special"
          ? "total-score"
          : "culture-score",
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-heilongjiang-government-control-lines-html",
    sourceUrl: CONTROL_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: "data/admissions/raw/heilongjiang-2026/official-government-control-lines.html",
    sourcePublishedAt: "2026-06-24",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, EXPECTED.controlPage.file)));
const rankPageHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.rankPage.file));
const rankPageText = visibleHtmlText(rankPageHtml);
for (const phrase of [
  "2026年黑龙江省普通高校招生录取控制分数线发布公告",
  "来源：黑龙江省招生考试委员会办公室",
  "普通本科批录取控制分数线：历史类385分，物理类340分",
  "普通高职（专科）批录取控制分数线：历史类150分，物理类150分",
  "特殊类型招生资格线：历史类466分，物理类464分",
  "体育类本科批文化课录取控制分数线：体育（历史类）269分，体育（物理类）238分",
  "体育类本科批术科录取控制分数线：体育（历史类）70分，体育（物理类）70分",
  "艺术类本科批文化课录取控制分数线：255分。其中，戏曲类专业本科批文化课录取控制分数线：170分",
  "艺术类本科批专业课录取控制分数线：美术与设计类150分；音乐类140分；舞蹈类180分；播音与主持类180分；书法类180分；表（导）演类170分；戏曲类180分",
]) assert(controlText.includes(phrase), `Official control page is missing: ${phrase}`);
for (const phrase of [
  "2026年黑龙江省普通高考成绩一分段统计表公布",
  "来源：黑龙江省招生考试院",
  "黑龙江省2026年普通高考历史类文化课一分段统计表",
  "黑龙江省2026年普通高考物理类文化课一分段统计表",
]) assert(rankPageText.includes(phrase), `Official rank page is missing: ${phrase}`);

const rankVerification = [
  parseRankXls(EXPECTED.rankHistory, "历史类", 670, 520, 44608),
  parseRankXls(EXPECTED.rankPhysics, "物理类", 700, 551, 109811),
];

const records = [
  makeRecord({ subjectType: "历史类", section: "本科", category: "普通类", minScore: 385, route: "ordinary-bachelor" }),
  makeRecord({ subjectType: "历史类", section: "高职（专科）", category: "普通类", minScore: 150, route: "ordinary-vocational" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "普通类", minScore: 340, route: "ordinary-bachelor" }),
  makeRecord({ subjectType: "物理类", section: "高职（专科）", category: "普通类", minScore: 150, route: "ordinary-vocational" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "特殊类型招生", minScore: 466, route: "special" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "特殊类型招生", minScore: 464, route: "special" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "体育类", minScore: 269, professionalMinScore: 70, route: "sports" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "体育类", minScore: 238, professionalMinScore: 70, route: "sports" }),
  makeRecord({ subjectType: "历史类", section: "高职（专科）", category: "体育类", minScore: 150, professionalQualification: "还须满足黑龙江省当年体育类术科或招生专业要求", route: "sports" }),
  makeRecord({ subjectType: "物理类", section: "高职（专科）", category: "体育类", minScore: 150, professionalQualification: "还须满足黑龙江省当年体育类术科或招生专业要求", route: "sports" }),
  ...ART_ROWS.map(([category, minScore, professionalMinScore]) => makeRecord({ subjectType: "艺术类", section: "本科", category, minScore, professionalMinScore, route: "art" })),
  makeRecord({ subjectType: "艺术类", section: "高职（专科）", category: "艺术类", minScore: 150, professionalQualification: "还须满足黑龙江省当年对应艺术类别专业课要求", route: "art" }),
];

assert(records.length === 18, `Expected 18 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 14, "Expected 14 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 9, "Expected nine numeric professional thresholds");
assert(records.filter((record) => record.professionalQualification).length === 3, "Expected three nonnumeric professional qualification rows");

const payload = {
  dataset: "official-heilongjiang-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "黑龙江", year: 2026, sourceKind: "official-government-control-lines" },
  notes: [
    "黑龙江2026普通类历史本科385分、专科150分，物理本科340分、专科150分进入普通资格路由。",
    "特殊类型2条、体育4条和艺术8条共14条保持 special-path-only；9条本科艺体记录把文化分和专业课/术科分分字段保存。",
    "体育和艺术专科控制线公告只给文化课数值，3条专科记录只保留专业资格要求，不补造专业分。",
    "两份官方XLS重新解析1071行，与运行层逐行零差异；历史664分为官方表省略的零人数档，不补假行。本轮只补历史/物理对应官方XLS URL。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "黑龙江",
    title: "2026年黑龙江省普通高校招生录取控制分数线发布公告",
    publisher: "黑龙江省招生考试委员会办公室（黑龙江省人民政府发布）",
    publishedAt: "2026-06-24",
    url: CONTROL_URL,
    relatedUrls: [RANK_PAGE_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL],
    quality: "official-heilongjiang-government-control-lines-html",
    usage: "抽取黑龙江2026普通类、特殊类型、体育和艺术控制线18条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    evidence,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 1071,
      pageUrl: RANK_PAGE_URL,
      historyUrl: RANK_HISTORY_URL,
      physicsUrl: RANK_PHYSICS_URL,
      fullRowCrossCheck: rankVerification,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 150, vocationalRankEnd: 44608, bachelorScore: 385, bachelorRankEnd: 21417, specialScore: 466, specialRankEnd: 10509 },
        physics: { vocationalScore: 150, vocationalRankEnd: 109811, bachelorScore: 340, bachelorRankEnd: 82444, specialScore: 464, specialRankEnd: 40652 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=14; culture-and-professional=9; professional-qualification-without-invented-score=3; rank rows=1071 official XLS full-row-checked and values unchanged; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 14,
    cultureProfessionalRecords: 9,
    professionalQualificationRecords: 3,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 4, art: 8 },
    ordinaryBoundaries: { historyBachelor: 385, historyVocational: 150, physicsBachelor: 340, physicsVocational: 150 },
    rankRecords: 1071,
    rankRowsFullCrossChecked: 1071,
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
  rankVerification,
}, null, 2));
