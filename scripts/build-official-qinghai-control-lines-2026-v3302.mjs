#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T20:35:00.000Z";
const SOURCE_ID = "official-qinghai-control-lines-2026";
const RANK_SOURCE_ID = "official-qinghai-rank-2026";
const CONTROL_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847208.html";
const CONTROL_IMAGE_URL = "https://t4.chei.com.cn/news/img/2293847209.png";
const RANK_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847238.html";
const RANK_PDF_URL = "https://t2.chei.com.cn/news/getfile/2293847239-2293847238-8f4911ad66a2a5465806d4e60d7dd2d9.pdf";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/qinghai-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-qinghai-control-lines-2026-import.json");

const EXPECTED = {
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 44021, sha256: "1fe2e61d55d76ce3ea73c4ea0608aa6357fe95a062cdf3b557c07921b34a4e5f" },
  controlImage: { file: "control-lines.png", bytes: 148304, sha256: "340c17fe0151884b8d588629944edc286a85008355b862353bf639c680f7ce5b", width: 794, height: 967 },
  chsiRankIndex: { file: "chsi-rank-index.html", bytes: 47490, sha256: "e6449bb8e6bdd46d540080f7ee4bb9a1df707eb9d12e68d2e35263d0cc3bf012" },
  rankPdf: { file: "rank-ordinary.pdf", bytes: 340050, sha256: "4aae2d39d60ace58a794c2f47aa93b93a5b1077e074b4f66255d7f37f01585e8" },
  rankLayoutText: { file: "rank-ordinary.txt", bytes: 101894, sha256: "0abca4d134bd3cd94b3c671a998ccc07bbe1e0abe5d591b2b28d936deaccf35f" },
  rankRawText: { file: "rank-ordinary-raw.txt", bytes: 47727, sha256: "d8afc8e073b38d54267fb5e50e698cefb3e135f7bbf75c8ba762d069417a5fb2" },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function visibleHtmlText(buffer) {
  return buffer.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  if (Number.isFinite(expected.width)) {
    assert(bytes.subarray(1, 4).toString("ascii") === "PNG", `${expected.file} is not PNG`);
    assert(bytes.readUInt32BE(16) === expected.width && bytes.readUInt32BE(20) === expected.height, `${expected.file} dimensions drifted`);
  }
  return { ...expected };
}

function parseRankText() {
  return [...fs.readFileSync(path.join(RAW_DIR, "rank-ordinary-raw.txt"), "utf8")
    .matchAll(/^(历史组|物理组)\s+普通类投档成绩\s+(≥?\d+)\s+(\d+)\s+(\d+)$/gm)]
    .map((match) => ({
      subjectType: match[1] === "历史组" ? "历史类" : "物理类",
      score: Number(match[2].replace("≥", "")),
      topBucket: match[2].startsWith("≥"),
      sameRankScore: Number(match[3]),
      rankEnd: Number(match[4]),
      rankStart: Number(match[4]) - Number(match[3]) + 1,
    }));
}

function verifyRankInventory() {
  const shard = readGzipJson(path.join(RELEASE_DIR, "qinghai.json.gz"));
  const core = readGzipJson(path.join(RELEASE_DIR, "knowledge-core.json.gz"));
  const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(sourceNote?.parsedRecords === 957, "Qinghai rank source inventory drifted");
  assert(sourceNote.url === RANK_URL, "Qinghai rank source URL drifted");
  assert(sourceNote.quality === "official-qinghai-rank-conversion-pdf", "Qinghai rank quality drifted");
  assert(sourceNote.attachmentUrls?.some((url) => url.includes("2293847239-2293847238-8f4911ad66a2a5465806d4e60d7dd2d9.pdf")), "Qinghai ordinary rank PDF identity drifted");

  const parsed = parseRankText();
  assert(parsed.length === 957, `Expected 957 parsed Qinghai rows, got ${parsed.length}`);
  const diagnostics = [];
  for (const spec of [
    { subjectType: "历史类", rows: 468, scoreMin: 5, scoreMax: 625, topRank: 11, finalRank: 15374, gapEvents: 21, omittedScores: 153 },
    { subjectType: "物理类", rows: 489, scoreMin: 5, scoreMax: 676, topRank: 11, finalRank: 31560, gapEvents: 25, omittedScores: 183 },
  ]) {
    const expectedRows = parsed.filter((row) => row.subjectType === spec.subjectType);
    const runtimeRows = shard.rankConversions
      .filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === spec.subjectType)
      .sort((left, right) => right.score - left.score);
    assert(expectedRows.length === spec.rows && runtimeRows.length === spec.rows, `${spec.subjectType} rank row count drifted`);
    assert(expectedRows[0].topBucket && expectedRows[0].score === spec.scoreMax && expectedRows[0].rankEnd === spec.topRank, `${spec.subjectType} top bucket drifted`);
    assert(expectedRows.at(-1).score === spec.scoreMin && expectedRows.at(-1).rankEnd === spec.finalRank, `${spec.subjectType} final row drifted`);
    const allUnlinked = runtimeRows.every((row) => !row.sourceUrl);
    const allLinked = runtimeRows.every((row) => row.sourceUrl === RANK_PDF_URL);
    assert(allUnlinked || allLinked, `${spec.subjectType} rank URLs are partially applied or unexpected`);
    for (let index = 0; index < expectedRows.length; index += 1) {
      const expected = expectedRows[index];
      const actual = runtimeRows[index];
      assert(actual.score === expected.score, `${spec.subjectType}/${index} score drifted`);
      assert(actual.rankStart === expected.rankStart && actual.rankEnd === expected.rankEnd && actual.sameRankScore === expected.sameRankScore, `${spec.subjectType}/${expected.score} rank values drifted`);
    }
    diagnostics.push({
      subjectType: spec.subjectType,
      rowsFullCrossChecked: expectedRows.length,
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      topRank: spec.topRank,
      finalCumulative: spec.finalRank,
      officialZeroPersonGapEventsRetained: spec.gapEvents,
      officialZeroPersonScoresRetained: spec.omittedScores,
      valueDifferences: 0,
      topBucketRangeRepairNeededOnV3301Base: true,
      rankRowsNeedingSourceUrlOnV3301Base: spec.rows,
    });
  }
  return diagnostics;
}

function recordId(row) {
  return `2026-qinghai-control-${sha256([row.subjectType, row.section, row.category, row.minScore, row.professionalMinScore ?? "", row.route].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route === "ordinary-bachelor" || row.route === "ordinary-vocational";
  const hasProfessional = Number.isFinite(row.professionalMinScore);
  const hasQualification = Boolean(row.professionalQualification);
  const batch = row.route === "ordinary-bachelor"
    ? "普通类本科批次录取控制分数线"
    : row.route === "ordinary-vocational"
      ? "普通类高职（专科）批次录取控制分数线"
      : row.route === "special"
        ? "普通类特殊类型录取控制分数线"
        : `${row.category}${row.section}录取控制分数线`;
  return {
    id: recordId(row),
    province: "青海",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "青海省2026年普通高考录取控制分数线",
    schoolTags: ["青海官方图片控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "青海",
    dataType: "control-line",
    majorName: batch,
    majorGroup: row.category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMaximum: hasProfessional ? 150 : undefined,
    professionalQualification: row.professionalQualification,
    scoreDimension: hasProfessional || hasQualification ? "culture-score" : "total-score",
    professionalScoreDimension: hasProfessional ? row.professionalScoreDimension : undefined,
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-chsi-mirror-qinghai-exam-authority-control-line-image-verified",
    sourceUrl: CONTROL_URL,
    sourceImageUrl: CONTROL_IMAGE_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions: ordinary ? [
      `这是青海省2026年普通类${row.subjectType}${row.section}控制分数线，只用于判断对应普通批次基本资格边界。`,
      "控制线不是院校、院校专业组或专业投档线，也不是录取最低分、最低位次或录取概率。",
    ] : [
      `这是青海省2026年${batch}，属于民族语言、特殊类型、体育或艺术路径，不替代普通类控制线。`,
      hasProfessional ? `文化课和民族语文科目成绩必须分别达到 ${row.minScore} 分与 ${row.professionalMinScore} 分，两个分数维度不得相加或互相替代。` : hasQualification ? "本源只公开文化控制线，专业成绩须达到相应专业省级统考合格要求，不补造专业分。" : "该记录保持 special-path-only，不进入普通类资格线或普通录取概率计算。",
    ],
    sourceFile: "data/admissions/raw/qinghai-2026/control-lines.png",
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiControlPage.file), "utf8");
const controlText = visibleHtmlText(Buffer.from(controlHtml));
const rankHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiRankIndex.file), "utf8");
assert(controlText.includes("青海：2026年普通高考录取控制分数线") && controlText.includes("来源：青海省教育招生考试"), "Qinghai control title or publisher drifted");
assert(controlHtml.includes(CONTROL_IMAGE_URL), "Qinghai control image URL drifted");
assert(rankHtml.includes("2026年青海省普通高校招生考试排序成绩一分一段统计表（普通类）.pdf") && rankHtml.includes(RANK_PDF_URL), "Qinghai ordinary rank PDF identity drifted");
const rankVerification = verifyRankInventory();

const records = [
  makeRecord({ subjectType: "历史类", section: "本科", category: "普通类", minScore: 376, route: "ordinary-bachelor" }),
  makeRecord({ subjectType: "历史类", section: "高职（专科）", category: "普通类", minScore: 150, route: "ordinary-vocational" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "普通类", minScore: 344, route: "ordinary-bachelor" }),
  makeRecord({ subjectType: "物理类", section: "高职（专科）", category: "普通类", minScore: 150, route: "ordinary-vocational" }),
  makeRecord({ subjectType: "历史类", section: "特殊类型", category: "普通类特殊类型招生", minScore: 427, route: "special" }),
  makeRecord({ subjectType: "物理类", section: "特殊类型", category: "普通类特殊类型招生", minScore: 417, route: "special" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "高校民族语言授课专业-藏文类", minScore: 356, professionalMinScore: 40, professionalScoreDimension: "qinghai-tibetan-language-subject", route: "minority-language" }),
  makeRecord({ subjectType: "历史类", section: "高职（专科）", category: "高校民族语言授课专业-藏文类", minScore: 150, professionalMinScore: 40, professionalScoreDimension: "qinghai-tibetan-language-subject", route: "minority-language" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "高校民族语言授课专业-藏文类", minScore: 326, professionalMinScore: 40, professionalScoreDimension: "qinghai-tibetan-language-subject", route: "minority-language" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "高校民族语言授课专业-蒙文类", minScore: 340, professionalMinScore: 40, professionalScoreDimension: "qinghai-mongolian-language-subject", route: "minority-language" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "高校民族语言授课专业-蒙文类", minScore: 280, professionalMinScore: 40, professionalScoreDimension: "qinghai-mongolian-language-subject", route: "minority-language" }),
  ...[["历史类", "本科", 348], ["历史类", "高职（专科）", 260], ["物理类", "本科", 342], ["物理类", "高职（专科）", 290]]
    .map(([subjectType, section, minScore]) => makeRecord({ subjectType, section, category: "体育类", minScore, professionalQualification: "体育专业省级统考成绩达到青海省2026年相应合格要求", route: "sports" })),
  ...[["历史类", "本科", 282], ["历史类", "高职（专科）", 150], ["物理类", "本科", 258], ["物理类", "高职（专科）", 150]]
    .map(([subjectType, section, minScore]) => makeRecord({ subjectType, section, category: "艺术类", minScore, professionalQualification: "艺术专业省级统考成绩达到青海省2026年相应合格要求", route: "art" })),
];

assert(records.length === 19, `Expected 19 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 15, "Expected 15 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 5, "Expected five minority-language dual-threshold records");
assert(records.filter((record) => record.professionalQualification).length === 8, "Expected eight sports/art qualification records");

const payload = {
  dataset: "official-qinghai-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "青海", year: 2026, sourceKind: "official-content-mirror-control-line-image" },
  notes: [
    "青海2026普通历史本科/专科376/150分、物理本科/专科344/150分共4条进入普通资格路由。",
    "特殊类型2条、民族语言5条、体育4条和艺术4条共15条保持 special-path-only。",
    "藏文/蒙文5条把文化线与民族语文科目40分合格线分列；体育/艺术8条只保存文化线与专业资格要求，不补造专业分。",
    "既有957条普通类位次与本轮重新下载的22页PDF逐行零差异并补齐PDF URL；两科顶端≥分数修复为625/676至750区间，位次数值零改动。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "青海",
    title: "青海省2026年普通高考录取控制分数线",
    publisher: "青海省教育招生考试 / 阳光高考",
    publishedAt: "2026-06-25",
    url: CONTROL_URL,
    relatedUrls: [CONTROL_IMAGE_URL, RANK_URL, RANK_PDF_URL],
    quality: "official-chsi-mirror-qinghai-exam-authority-control-line-image-verified",
    usage: "抽取青海2026普通、特殊类型、民族语言、体育和艺术控制线19条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    originalPublisher: "青海省教育招生考试",
    directMirrorRetrievalStatus: "success",
    evidence,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 957,
      indexUrl: RANK_URL,
      pdfUrl: RANK_PDF_URL,
      fullPdfRowCrossCheck: rankVerification,
      valueChanges: 0,
      topBucketRangeRepairs: 2,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 150, vocationalRankEnd: null, bachelorScore: 376, bachelorRankEnd: 6185, specialScore: 427, specialRankEnd: 3139, topBucketMin: 625, topBucketMax: 750, topBucketRankEnd: 11 },
        physics: { vocationalScore: 150, vocationalRankEnd: null, bachelorScore: 344, bachelorRankEnd: 20662, specialScore: 417, specialRankEnd: 10682, topBucketMin: 676, topBucketMax: 750, topBucketRankEnd: 11 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=15; minority-language culture-and-subject dual-threshold rows=5; sports/art culture-only qualification rows=8; ordinary rank rows=957 full-PDF row cross-checked and values unchanged; both 150 rank rows unavailable because official tables omit zero-person scores; not institution, major or admission probability",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 15,
    professionalNumericRecords: 5,
    professionalQualificationRecords: 8,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, "minority-language": 5, sports: 4, art: 4 },
    ordinaryBoundaries: { historyBachelor: 376, historyVocational: 150, physicsBachelor: 344, physicsVocational: 150 },
    rankRecords: 957,
    rankRowsFullCrossChecked: 957,
    rankValueChanges: 0,
    topBucketRangeRepairs: 2,
    officialZeroPersonGapEventsRetained: 46,
    officialZeroPersonScoresRetained: 336,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence, rankVerification }, null, 2));
