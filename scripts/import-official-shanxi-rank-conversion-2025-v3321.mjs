#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-shanxi-rank-conversion-2025-v3321";
const DEFAULT_OUT = "data/admissions/official-shanxi-rank-conversion-2025-v3321-import.json";
const SOURCE_ID = "official-shanxi-rank-2025-v3321";
const PROVINCE = "山西";
const YEAR = 2025;
const QUALITY = "official-source-attributed-shanxi-rank-images-html-government-cross-verified";
const CHSI_INDEX_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss?regionId=086140000";
const CHSI_HISTORY_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390947.html";
const CHSI_PHYSICS_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390949.html";
const EOL_HISTORY_URL = "https://gaokao.eol.cn/shan_xi/dongtai/202512/t20251224_2712031.shtml";
const EOL_PHYSICS_URL = "https://gaokao.eol.cn/shan_xi/dongtai/202506/t20250626_2677293.shtml";
const DXSBB_HISTORY_URL = "https://www.dxsbb.com/news/148843.html";
const DXSBB_PHYSICS_URL = "https://www.dxsbb.com/news/148842.html";
const GOVERNMENT_URL = "https://www.jcgov.gov.cn/dtxx/zxts/202506/t20250626_2159917.shtml";
const EXCLUDED_UNADMITTED_URL = "https://www.sxjyksfw.cn/news/ptgk/20250808/n2025080814254668.html";

const EVIDENCE = {
  "chsi-history-2025-grid-vision.tsv": "7a3f0fc661d648edd51642482dd19d146816fc32369865dac4d3a2f2efe449d5",
  "chsi-history-2025.html": "c6ea16681bf03b2acdfdad69e477c8e880aaa47775308b882778e5ca4a10caaa",
  "chsi-history-2025.png": "bc9b35004485bee87192da9df8de78be47c5123b41237de5485547d06768d3c6",
  "chsi-physics-2025-grid-vision-en.tsv": "9e161cf32b929548b9e285a50073f5b943b7fa696c4c90094f9f01fdc34a41a7",
  "chsi-physics-2025-grid-vision.tsv": "ec0a2017c77488e7b679c22f41a741acc435c6df25be8c79f8cdba81ff6c3142",
  "chsi-physics-2025.html": "b674b23bb0e86280676c061dba48b67b762d95f56461023074eba0b335f637a9",
  "chsi-physics-2025.png": "6a0aa10a6603a8e3dbbdd7c838fed4888d02a750bf2c2c53b355de049209ca5e",
  "chsi-shanxi-index.html": "d9c8d1fa55cb53a040d52336d5f4928bbe5eaae644529783b0c5b4a2841a5075",
  "dxsbb-history-2025.html": "f475213005f15a896db991db401a46c30cee737ec09b775ee5ece356b07b5476",
  "dxsbb-physics-2025.html": "1eb7604858484bcc18487a8517c507da4aca94b02b87920145968672842d023e",
  "eol-history-2025-republish.html": "f6d0ec9c32fa2a5c077e818ab06b3f43d6e80a6cedbcefa5fa89a4e94c5f73c9",
  "eol-history-2025.html": "eda3326ac86282dd10169dbe082b4516df6518156a05124f6a3e332fa089bcc0",
  "eol-physics-2025.html": "58a8b36ea3abb475048d53743ac7993aab066a49b2b7dd12ab1a115d9b1d9735",
  "eol-shanxi-index5.html": "73e50766e868dea049cbd96f8de1421888949dbe9ff58613f5cd80c9f77e5aef",
  "government-history-2025.jpg": "dca31383ac73e6e6e5461d6b9de9053e7a70740dc90e558a01f7f20f42f82707",
  "government-physics-2025.jpg": "78d3eb611854f49e9ac0eeaaa3e84f747b4a74968305e1a38acd8f3801b77a47",
  "jincheng-government-2025.html": "732e31dc373c78b99aa405e31900717c6b66a69477cd353fe1c283ab7010ff51",
  "unadmitted-excluded-2025.html": "36226f9df3e5f5f465b45f305ea079785a50f843cd51a7cfc5911b0e2add32b7",
};

const TABLES = [
  {
    key: "history",
    subjectType: "历史类",
    expectedRows: 229,
    leftRows: 115,
    first: [671, 3, 11, 9],
    last: [443, 248, 35877, 35630],
    checkpoints: { 600: [83, 1918, 1836], 500: [270, 20270, 20001], 443: [248, 35877, 35630] },
    scoreFloor: 443,
    chsiUrl: CHSI_HISTORY_URL,
    chsiImageUrl: "https://t4.chei.com.cn/news/img/2293390948.png",
    eolUrl: EOL_HISTORY_URL,
    dxsbbUrl: DXSBB_HISTORY_URL,
    eolEvidence: "eol-history-2025-republish.html",
    dxsbbEvidence: "dxsbb-history-2025.html",
    ocrEvidence: "chsi-history-2025-grid-vision.tsv",
    ocrExpected: { score: 228, sameRankScore: 116, rankEnd: 228 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    expectedRows: 286,
    leftRows: 143,
    first: [704, 2, 12, 11],
    last: [419, 550, 120285, 119736],
    checkpoints: { 600: [276, 10452, 10177], 500: [689, 60425, 59737], 419: [550, 120285, 119736] },
    scoreFloor: 419,
    chsiUrl: CHSI_PHYSICS_URL,
    chsiImageUrl: "https://t4.chei.com.cn/news/img/2293390950.png",
    eolUrl: EOL_PHYSICS_URL,
    dxsbbUrl: DXSBB_PHYSICS_URL,
    eolEvidence: "eol-physics-2025.html",
    dxsbbEvidence: "dxsbb-physics-2025.html",
    ocrEvidence: "chsi-physics-2025-grid-vision.tsv",
    ocrExpected: { score: 281, sameRankScore: 198, rankEnd: 285 },
    cumulativeOcrEvidence: "chsi-physics-2025-grid-vision-en.tsv",
    cumulativeOcrExpected: 286,
  },
];

function parseArgs(argv) {
  const args = { raw: DEFAULT_RAW, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--raw") args.raw = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pngDimensions(bytes) {
  assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", "Invalid PNG evidence");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function tableCells(table) {
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => (
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanText(cell[1]).replaceAll(",", ""))
  ));
}

function parseTriple(cells) {
  if (cells.length !== 3 || !/\d/.test(cells[0]) || !cells.slice(1).every((value) => /^\d+$/.test(value))) return null;
  return {
    score: Number(cells[0].match(/\d+/)?.[0]),
    sameRankScore: Number(cells[1]),
    rankEnd: Number(cells[2]),
  };
}

function parseWideEolTable(html, config) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => cleanText(table).includes("本分人数") && cleanText(table).includes("累计人数"));
  assert(tables.length === 1, `${config.key} EOL expected one score table, got ${tables.length}`);
  const left = [];
  const right = [];
  for (const cells of tableCells(tables[0])) {
    const leftRow = parseTriple(cells.slice(0, 3));
    const rightRow = cells.length >= 6 ? parseTriple(cells.slice(-3)) : null;
    if (leftRow) left.push(leftRow);
    if (rightRow) right.push(rightRow);
  }
  assert(left.length === config.leftRows, `${config.key} EOL left table row count drifted`);
  assert(left.length + right.length === config.expectedRows, `${config.key} EOL total row count drifted`);
  return [...left, ...right];
}

function parseDxsbbTable(html, config) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => cleanText(table).includes("本分人数") && cleanText(table).includes("累计人数"));
  assert(tables.length === 1, `${config.key} DXSBB expected one score table, got ${tables.length}`);
  return tableCells(tables[0]).map(parseTriple).filter(Boolean);
}

function completeRanks(rows) {
  return rows.map((row) => ({ ...row, rankStart: row.rankEnd - row.sameRankScore + 1 }));
}

function validateRows(rows, config, label) {
  assert(rows.length === config.expectedRows, `${config.key} ${label} expected ${config.expectedRows} rows, got ${rows.length}`);
  assert(JSON.stringify(Object.values(rows[0])) === JSON.stringify(config.first), `${config.key} ${label} first row drifted`);
  assert(JSON.stringify(Object.values(rows.at(-1))) === JSON.stringify(config.last), `${config.key} ${label} last row drifted`);
  assert(rows.every((row) => [row.score, row.sameRankScore, row.rankEnd, row.rankStart].every(Number.isInteger)), `${config.key} ${label} has non-integer values`);
  assert(rows.every((row, index) => index === 0 || row.score === rows[index - 1].score - 1), `${config.key} ${label} scores are not a complete descending sequence`);
  assert(rows.every((row) => row.rankStart === row.rankEnd - row.sameRankScore + 1), `${config.key} ${label} rank ranges do not close`);
  assert(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1), `${config.key} ${label} cumulative ranks are discontinuous`);
  assert(rows.at(-1).score === config.scoreFloor, `${config.key} published score floor drifted`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    const row = rows.find((item) => item.score === Number(score));
    assert(row && JSON.stringify([row.sameRankScore, row.rankEnd, row.rankStart]) === JSON.stringify(expected), `${config.key} ${label} checkpoint ${score} drifted`);
  }
}

function compareRows(authority, mirror, config) {
  validateRows(mirror, config, "independent HTML mirror");
  let cellComparisons = 0;
  for (let index = 0; index < authority.length; index += 1) {
    for (const field of ["score", "sameRankScore", "rankEnd"]) {
      assert(authority[index][field] === mirror[index][field], `${config.key} HTML sources differ at row ${index + 1} field ${field}`);
      cellComparisons += 1;
    }
  }
  return cellComparisons;
}

function parseOcrGrid(bytes) {
  const rows = new Map();
  for (const line of bytes.toString("utf8").trim().split(/\r?\n/)) {
    const [row, panel, ...cells] = line.split("\t");
    rows.set(`${row}|${panel}`, cells);
  }
  return rows;
}

function firstInteger(value) {
  return Number(String(value || "").match(/\d+/)?.[0] || NaN);
}

function compareOcr(rows, bytes, config) {
  const grid = parseOcrGrid(bytes);
  const matches = { score: 0, sameRankScore: 0, rankEnd: 0 };
  for (let index = 0; index < rows.length; index += 1) {
    const panel = index < config.leftRows ? 0 : 1;
    const panelRow = index < config.leftRows ? index + 1 : index - config.leftRows + 1;
    const cells = grid.get(`${panelRow}|${panel}`) || [];
    if (firstInteger(cells[0]) === rows[index].score) matches.score += 1;
    if (firstInteger(cells[1]) === rows[index].sameRankScore) matches.sameRankScore += 1;
    if (firstInteger(cells[2]) === rows[index].rankEnd) matches.rankEnd += 1;
  }
  assert(JSON.stringify(matches) === JSON.stringify(config.ocrExpected), `${config.key} official-image OCR comparison drifted: ${JSON.stringify(matches)}`);
  return matches;
}

function makeId(config, score, topBucket = false) {
  return `${YEAR}-shanxi-rank-${config.key}-${sha256(`${YEAR}|${PROVINCE}|${config.subjectType}|${score}|${topBucket}|${SOURCE_ID}`).slice(0, 16)}`;
}

function buildRankConversions(rows, config) {
  const precedingCandidates = rows[0].rankStart - 1;
  assert(precedingCandidates > 0, `${config.key} withheld top cohort drifted`);
  const shared = {
    province: PROVINCE,
    year: YEAR,
    subjectType: config.subjectType,
    dataType: "rank-conversion",
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: config.chsiUrl,
    mirrorUrl: config.eolUrl,
    governmentMirrorUrl: GOVERNMENT_URL,
    evidenceStage: "ordinary-cohort-at-bachelor-control-line-and-above",
    publishedScoreFloor: config.scoreFloor,
  };
  const topScore = rows[0].score + 1;
  return [{
    ...shared,
    id: makeId(config, topScore, true),
    score: topScore,
    scoreRange: { min: topScore, max: 750 },
    rankStart: 1,
    rankEnd: precedingCandidates,
    sameRankScore: precedingCandidates,
    topWithheldRange: true,
  }, ...rows.map((row) => ({
    ...shared,
    id: makeId(config, row.score),
    ...row,
  }))];
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const raw = {};
  for (const [name, expectedHash] of Object.entries(EVIDENCE)) {
    const file = path.join(rawDir, name);
    assert(fs.existsSync(file), `Missing evidence file: ${file}`);
    raw[name] = fs.readFileSync(file);
    assert(sha256(raw[name]) === expectedHash, `${name} hash drifted`);
  }

  const chsiIndex = raw["chsi-shanxi-index.html"].toString("utf8");
  assert(chsiIndex.includes("/20250626/2293390947.html") && chsiIndex.includes("/20250626/2293390949.html"), "CHSI Shanxi index links drifted");
  const chsiHistory = raw["chsi-history-2025.html"].toString("utf8");
  const chsiPhysics = raw["chsi-physics-2025.html"].toString("utf8");
  assert(cleanText(chsiHistory).includes("来源：山西招生考试网"), "CHSI history authority attribution is missing");
  assert(cleanText(chsiPhysics).includes("来源：山西招生考试网"), "CHSI physics authority attribution is missing");
  assert(chsiHistory.includes(TABLES[0].chsiImageUrl) && chsiPhysics.includes(TABLES[1].chsiImageUrl), "CHSI official-image references drifted");
  assert(JSON.stringify(pngDimensions(raw["chsi-history-2025.png"])) === JSON.stringify({ width: 765, height: 4457 }), "History authority image dimensions drifted");
  assert(JSON.stringify(pngDimensions(raw["chsi-physics-2025.png"])) === JSON.stringify({ width: 768, height: 5534 }), "Physics authority image dimensions drifted");

  const governmentHtml = raw["jincheng-government-2025.html"].toString("utf8");
  const governmentText = cleanText(governmentHtml);
  assert(governmentText.includes("信息来源： 山西省招生考试管理中心"), "Government mirror publisher attribution is missing");
  assert(governmentText.includes("历史组600分以上累计人数1918人") && governmentText.includes("物理组600分以上累计人数10452人"), "Government mirror checkpoints drifted");
  assert(governmentHtml.includes("W020250626377563801726_ORIGIN.jpg") && governmentHtml.includes("W020250626377564081983_ORIGIN.jpg"), "Government mirror image references drifted");
  const eolIndex = raw["eol-shanxi-index5.html"].toString("utf8");
  assert(eolIndex.includes("t20250626_2677335.shtml"), "EOL history inventory link drifted");
  assert(raw["eol-history-2025.html"].toString("utf8").includes(TABLES[0].chsiImageUrl), "EOL history authority-image mirror drifted");
  assert(cleanText(raw["eol-physics-2025.html"].toString("utf8")).includes("来源：山西省招生考试管理中心"), "EOL physics authority attribution is missing");
  assert(cleanText(raw["unadmitted-excluded-2025.html"].toString("utf8")).includes("山西省2025年普通高考未录取考生成绩分段统计表"), "Excluded unadmitted-candidate evidence drifted");

  let publishedRows = 0;
  let htmlCellComparisons = 0;
  let ocrScoreMatches = 0;
  let ocrSameCountMatches = 0;
  let ocrCumulativeMatches = 0;
  const built = TABLES.map((config) => {
    const authority = completeRanks(parseWideEolTable(raw[config.eolEvidence].toString("utf8"), config));
    const mirror = completeRanks(parseDxsbbTable(raw[config.dxsbbEvidence].toString("utf8"), config));
    validateRows(authority, config, "authority-attributed HTML table");
    htmlCellComparisons += compareRows(authority, mirror, config);
    const ocr = compareOcr(authority, raw[config.ocrEvidence], config);
    ocrScoreMatches += ocr.score;
    ocrSameCountMatches += ocr.sameRankScore;
    ocrCumulativeMatches += ocr.rankEnd;
    if (config.cumulativeOcrEvidence) {
      const cumulativeOcr = compareOcr(authority, raw[config.cumulativeOcrEvidence], { ...config, ocrExpected: { score: 279, sameRankScore: 165, rankEnd: config.cumulativeOcrExpected } });
      assert(cumulativeOcr.rankEnd === config.expectedRows, `${config.key} numeric OCR cumulative comparison is incomplete`);
      ocrCumulativeMatches += cumulativeOcr.rankEnd - ocr.rankEnd;
    }
    publishedRows += authority.length;
    return { config, authority, rankConversions: buildRankConversions(authority, config) };
  });
  assert(publishedRows === 515 && htmlCellComparisons === 1545, "Shanxi full-table comparison totals drifted");
  assert(ocrScoreMatches === 509 && ocrSameCountMatches === 314 && ocrCumulativeMatches === 514, "Shanxi authority-image OCR totals drifted");

  const rankConversions = built.flatMap((item) => item.rankConversions);
  assert(rankConversions.length === 517, `Expected 517 emitted rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate Shanxi rank conversion IDs detected");
  assert(rankConversions.filter((row) => row.topWithheldRange).length === 2, "Shanxi top bucket count drifted");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "山西2025年普通高考普通类一分一段统计表（历史/物理，本科线及以上）",
    publisher: "山西省招生考试管理中心",
    province: PROVINCE,
    year: YEAR,
    url: CHSI_HISTORY_URL,
    physicsUrl: CHSI_PHYSICS_URL,
    indexUrl: CHSI_INDEX_URL,
    governmentMirrorUrl: GOVERNMENT_URL,
    eolHistoryUrl: EOL_HISTORY_URL,
    eolPhysicsUrl: EOL_PHYSICS_URL,
    excludedUnadmittedUrl: EXCLUDED_UNADMITTED_URL,
    quality: QUALITY,
    usage: "用于把山西2025同科类整数最低分或考生分数换算为省级位次区间；官方公开表仅覆盖历史443分、物理419分及以上，低于对应本科线不外推、不伪造位次。",
    parsedRecords: rankConversions.length,
    publishedRows,
    subjectBreakdown: { 历史类: 230, 物理类: 287 },
    publishedScoreFloors: { 历史类: 443, 物理类: 419 },
    provenance: {
      chsiIndexUrl: CHSI_INDEX_URL,
      chsiHistoryUrl: CHSI_HISTORY_URL,
      chsiPhysicsUrl: CHSI_PHYSICS_URL,
      chsiAuthorityAttributionVerified: true,
      governmentMirrorUrl: GOVERNMENT_URL,
      governmentAuthorityAttributionVerified: true,
      eolHistoryUrl: EOL_HISTORY_URL,
      eolPhysicsUrl: EOL_PHYSICS_URL,
      dxsbbHistoryUrl: DXSBB_HISTORY_URL,
      dxsbbPhysicsUrl: DXSBB_PHYSICS_URL,
      htmlRowComparisons: publishedRows,
      htmlCellComparisons,
      htmlDifferences: 0,
      authorityImageOcrScoreMatches: ocrScoreMatches,
      authorityImageOcrCumulativeMatches: ocrCumulativeMatches,
      authorityImageKnownRecognitionExceptions: 7,
      governmentTextCheckpointComparisons: 2,
      excludedUnadmittedCandidateTable: true,
    },
    cautions: [
      "山西2025公开普通类一分一段表止于本科控制线：历史443分、物理419分；专科段不得由本科表外推。",
      "首批高位考生按公开表合并处理，本导入只保留累计人数可确定的位次区间，不生成档内伪精确名次。",
      "8月发布的未录取考生成绩分段表属于录取进程中的剩余考生口径，已作为排除证据保存，不与6月全体普通类表合并。",
      "最低分换算位次不是院校投档表原生公布的最低位次，正式填报前仍须核验当年考试院表、招生计划和院校章程。",
    ],
  };

  const payload = {
    dataset: "official-shanxi-rank-conversion-2025-v3321-import",
    generatedAt,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      publishedRows,
      topBuckets: 2,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      htmlRowComparisons: publishedRows,
      htmlCellComparisons,
      htmlDifferences: 0,
      authorityImageOcrScoreMatches: ocrScoreMatches,
      authorityImageOcrCumulativeMatches: ocrCumulativeMatches,
      authorityImageKnownRecognitionExceptions: 7,
      governmentTextCheckpointComparisons: 2,
      excludedUnadmittedCandidateSources: 1,
      evidenceSha256: Object.fromEntries(Object.entries(raw).map(([name, bytes]) => [name, sha256(bytes)])),
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outFile), rankConversions: rankConversions.length, publishedRows, htmlCellComparisons, ocrScoreMatches, ocrCumulativeMatches }, null, 2));
}

main();
