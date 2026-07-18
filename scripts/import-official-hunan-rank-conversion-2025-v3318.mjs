#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-hunan-rank-conversion-2025-v3318";
const DEFAULT_OUT = "data/admissions/official-hunan-rank-conversion-2025-v3318-import.json";
const SOURCE_ID = "official-hunan-rank-2025-v3318";
const PROVINCE = "湖南";
const YEAR = 2025;
const GOVERNMENT_RELEASE_URL = "https://jyt.hunan.gov.cn/jyt/sjyt/xxgk/2017zwgk/gxxx/202506/t20250625_33741629.html";
const CHSI_HISTORY_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250625/2293392782.html";
const CHSI_PHYSICS_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250625/2293392784.html";
const CHSI_HISTORY_IMAGE_URL = "https://t1.chei.com.cn/news/img/2293392783.png";
const CHSI_PHYSICS_IMAGE_URL = "https://t1.chei.com.cn/news/img/2293392785.png";
const EOL_HISTORY_URL = "https://gaokao.eol.cn/hu_nan/dongtai/202506/t20250625_2676955.shtml";
const EOL_PHYSICS_URL = "https://gaokao.eol.cn/hu_nan/dongtai/202506/t20250625_2676956.shtml";
const DXSBB_HISTORY_URL = "https://www.dxsbb.com/news/148837.html";
const DXSBB_PHYSICS_URL = "https://www.dxsbb.com/news/148836.html";
const QUALITY = "official-source-attributed-hunan-education-department-eol-table-chsi-image-dxsbb-full-mirror-cross-verified";

const EVIDENCE = {
  "government-release.html": "cb36b5eed2ce049ac310d203ae7270dd95f8e24d5729dedbd8cea0b2ff9c114a",
  "chsi-history.html": "f7b7417628dcbbccf28218e440e5b2f1afe69944f1777fe511a6092f024aa744",
  "chsi-physics.html": "bd285bcf76a97fe37c421c285b12572e574add421566a51c7be4d52937b412f2",
  "chsi-history.png": "8f222b93ac9a6b63c8045caeefe24a5eee291020701e79221b26d05ed6aecea7",
  "chsi-physics.png": "ad7de963ba347b317bed18b5781b1cdc39d545463d66a899145f300564c02427",
  "eol-history.html": "c6b7b31ea7ce997caf11eb6d2a6e495290cd8fd3becb94fa78f195cdc0bdd167",
  "eol-physics.html": "ae4ef3d00194a9f6bcc7913be4f3457a1b7e934fda6252c9b4ec561702a7999a",
  "dxsbb-history.html": "53a17305011c0fe822305d91fa7373a13d8abd8f9550ebe2a71e4abf208eeafd",
  "dxsbb-physics.html": "f9b6d7402daed7b5f60ac86dd98af3c4f41a40a57208ffe4d2108bbf25cd9e86",
};

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    topScore: 658,
    bottomScore: 100,
    expectedAuthorityRows: 560,
    expectedNumericRows: 558,
    expectedEmittedRows: 550,
    expectedMirrorRows: 550,
    expectedZeroScores: [129, 124, 116, 115, 112, 110, 105, 104, 103],
    topRankEnd: 55,
    bottomRankEnd: 141153,
    below100RankEnd: 142547,
    eolUrl: EOL_HISTORY_URL,
    chsiUrl: CHSI_HISTORY_URL,
    chsiImageUrl: CHSI_HISTORY_IMAGE_URL,
    mirrorUrl: DXSBB_HISTORY_URL,
    checkpoints: { 600: 2369, 550: 10822, 500: 27038, 446: 53081, 400: 78486, 300: 124838, 200: 140042, 100: 141153 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    topScore: 690,
    bottomScore: 100,
    expectedAuthorityRows: 592,
    expectedNumericRows: 590,
    expectedEmittedRows: 589,
    expectedMirrorRows: 589,
    expectedZeroScores: [107, 101],
    topRankEnd: 53,
    bottomRankEnd: 318823,
    below100RankEnd: 320192,
    eolUrl: EOL_PHYSICS_URL,
    chsiUrl: CHSI_PHYSICS_URL,
    chsiImageUrl: CHSI_PHYSICS_IMAGE_URL,
    mirrorUrl: DXSBB_PHYSICS_URL,
    checkpoints: { 600: 15860, 550: 44942, 500: 90705, 422: 190592, 400: 217140, 300: 293562, 200: 317438, 100: 318823 },
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

function parseScoreCell(value) {
  const text = String(value || "").replace(/（[^）]*）/g, "").trim();
  if (/^(?:0\s*[-—]\s*99|100以下)$/.test(text)) return { kind: "below", min: 0, max: 99, key: "0-99" };
  const range = text.match(/^(\d+)\s*[-—]\s*(\d+)$/);
  if (range) return { kind: "range", min: Number(range[1]), max: Number(range[2]), key: `${Number(range[1])}-${Number(range[2])}` };
  if (/^\d+$/.test(text)) return { kind: "score", score: Number(text), key: String(Number(text)) };
  return null;
}

function parseScoreTable(html, config, label) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => cleanText(table).includes("累计人数") && /(?:分数|档分)/.test(cleanText(table)));
  assert(tables.length === 1, `${config.subjectType} ${label} expected one score table, got ${tables.length}`);
  const rows = [];
  for (const match of tables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanText(cell[1]));
    if (cells.length !== 3) continue;
    const scoreCell = parseScoreCell(cells[0]);
    if (!scoreCell) continue;
    const sameRankScore = Number(String(cells[1]).replaceAll(",", ""));
    const rankEnd = Number(String(cells[2]).replaceAll(",", ""));
    assert(Number.isInteger(sameRankScore) && sameRankScore >= 0, `${config.subjectType} ${label} invalid count ${JSON.stringify(cells)}`);
    assert(Number.isInteger(rankEnd) && rankEnd > 0, `${config.subjectType} ${label} invalid cumulative count ${JSON.stringify(cells)}`);
    rows.push({ ...scoreCell, sameRankScore, rankEnd });
  }
  return rows;
}

function validateAuthorityRows(rows, config) {
  const label = `${config.subjectType} authority table`;
  assert(rows.length === config.expectedAuthorityRows, `${label} expected ${config.expectedAuthorityRows} rows, got ${rows.length}`);
  assert(rows[0].kind === "range" && rows[0].min === config.topScore && rows[0].max === 750, `${label} top range drifted`);
  assert(rows[0].rankEnd === config.topRankEnd && rows[0].sameRankScore === config.topRankEnd, `${label} top cumulative count drifted`);
  assert(rows.at(-1).kind === "below" && rows.at(-1).rankEnd === config.below100RankEnd, `${label} below-100 bucket drifted`);
  const numericRows = rows.filter((row) => row.kind === "score");
  assert(numericRows.length === config.expectedNumericRows, `${label} expected ${config.expectedNumericRows} numeric rows, got ${numericRows.length}`);
  assert(numericRows[0].score === config.topScore - 1 && numericRows.at(-1).score === config.bottomScore, `${label} numeric boundaries drifted`);
  assert(numericRows.every((row, index) => index === 0 || numericRows[index - 1].score - row.score === 1), `${label} scores are not contiguous`);
  assert(rows.every((row, index) => index === 0 || row.rankEnd >= rows[index - 1].rankEnd), `${label} cumulative ranks are not monotonic`);
  assert(rows.every((row, index) => row.rankEnd - (index ? rows[index - 1].rankEnd : 0) === row.sameRankScore), `${label} counts do not close`);
  const zeroScores = numericRows.filter((row) => row.sameRankScore === 0).map((row) => row.score);
  assert(JSON.stringify(zeroScores) === JSON.stringify(config.expectedZeroScores), `${label} zero-score gaps drifted: ${zeroScores}`);
  assert(numericRows.at(-1).rankEnd === config.bottomRankEnd, `${label} bottom score rank drifted`);
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) {
    assert(numericRows.find((row) => row.score === Number(score))?.rankEnd === rankEnd, `${label} checkpoint ${score} drifted`);
  }
  return numericRows;
}

function compareMirror(authorityRows, mirrorRows, config) {
  assert(mirrorRows.length === config.expectedMirrorRows, `${config.subjectType} mirror expected ${config.expectedMirrorRows} rows, got ${mirrorRows.length}`);
  const authorityByKey = new Map(authorityRows.map((row) => [row.key, row]));
  let cellComparisons = 0;
  for (const mirror of mirrorRows) {
    const authority = authorityByKey.get(mirror.key);
    assert(authority, `${config.subjectType} authority table is missing mirror row ${mirror.key}`);
    for (const field of ["key", "sameRankScore", "rankEnd"]) {
      assert(mirror[field] === authority[field], `${config.subjectType} sources differ at ${mirror.key} field ${field}`);
      cellComparisons += 1;
    }
  }
  const expectedKeys = authorityRows
    .filter((row) => (row.kind === "score" && row.sameRankScore > 0) || row.kind === "below")
    .map((row) => row.key);
  assert(JSON.stringify(mirrorRows.map((row) => row.key)) === JSON.stringify(expectedKeys), `${config.subjectType} mirror row coverage drifted`);
  return { rowComparisons: mirrorRows.length, cellComparisons };
}

function makeId(subjectType, score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subjectType}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-hunan-rank-${subjectType === "历史类" ? "history" : "physics"}-${digest}`;
}

function buildRankConversions(authorityRows, config) {
  const emitted = authorityRows.filter((row) => row.kind === "range" || (row.kind === "score" && row.sameRankScore > 0));
  assert(emitted.length === config.expectedEmittedRows, `${config.subjectType} expected ${config.expectedEmittedRows} emitted rows, got ${emitted.length}`);
  let previousRankEnd = 0;
  return emitted.map((row) => {
    const score = row.kind === "range" ? row.min : row.score;
    const record = {
      id: makeId(config.subjectType, score),
      province: PROVINCE,
      year: YEAR,
      subjectType: config.subjectType,
      dataType: "rank-conversion",
      score,
      rankStart: previousRankEnd + 1,
      rankEnd: row.rankEnd,
      sameRankScore: row.sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: QUALITY,
      sourceUrl: config.eolUrl,
      governmentReleaseUrl: GOVERNMENT_RELEASE_URL,
      chsiPageUrl: config.chsiUrl,
      chsiImageUrl: config.chsiImageUrl,
      mirrorUrl: config.mirrorUrl,
    };
    previousRankEnd = row.rankEnd;
    if (row.kind === "range") record.scoreRange = { min: row.min, max: row.max };
    return record;
  });
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

  const governmentText = cleanText(raw["government-release.html"].toString("utf8"));
  assert(governmentText.includes("高考文化成绩（含政策性加分）600分以上的考生18229人"), "Government score-distribution statement is missing");
  assert(governmentText.includes("历史类为2369人，物理类为15860人"), "Government 600-point checkpoints are missing");

  const imageDimensions = {};
  const built = SUBJECTS.map((config) => {
    const chsiHtml = raw[`chsi-${config.key}.html`].toString("utf8");
    assert(cleanText(chsiHtml).includes("来源：湖南考试招生"), `${config.subjectType} CHSI attribution is missing`);
    assert(chsiHtml.includes(config.chsiImageUrl), `${config.subjectType} CHSI image link is missing`);
    imageDimensions[config.subjectType] = pngDimensions(raw[`chsi-${config.key}.png`]);
    assert(imageDimensions[config.subjectType].width === 680 && imageDimensions[config.subjectType].height > 12000, `${config.subjectType} CHSI image dimensions drifted`);

    const eolHtml = raw[`eol-${config.key}.html`].toString("utf8");
    assert(cleanText(eolHtml).includes("湖南省教育厅"), `${config.subjectType} EOL authority attribution is missing`);
    const authorityRows = parseScoreTable(eolHtml, config, "EOL");
    const numericRows = validateAuthorityRows(authorityRows, config);
    const mirrorRows = parseScoreTable(raw[`dxsbb-${config.key}.html`].toString("utf8"), config, "DXSBB");
    const comparison = compareMirror(authorityRows, mirrorRows, config);
    const rankConversions = buildRankConversions(authorityRows, config);
    return { config, authorityRows, numericRows, mirrorRows, comparison, rankConversions };
  });

  const rankConversions = built.flatMap((item) => item.rankConversions);
  const rowComparisons = built.reduce((sum, item) => sum + item.comparison.rowComparisons, 0);
  const cellComparisons = built.reduce((sum, item) => sum + item.comparison.cellComparisons, 0);
  const authorityRows = built.reduce((sum, item) => sum + item.authorityRows.length, 0);
  const zeroScoreGaps = built.reduce((sum, item) => sum + item.config.expectedZeroScores.length, 0);
  assert(rankConversions.length === 1139 && rowComparisons === 1139 && cellComparisons === 3417, "Evidence comparison totals drifted");
  assert(authorityRows === 1152 && zeroScoreGaps === 11, "Authority table totals drifted");
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank conversion IDs detected");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "湖南省2025年普通高考档分1分段统计表（历史、物理科目组合）",
    publisher: "湖南省教育厅（来源标注）",
    province: PROVINCE,
    year: YEAR,
    url: EOL_HISTORY_URL,
    quality: QUALITY,
    usage: "用于把湖南2025同科类普通高考录取最低分换算为全省累计位次区间；不冒充院校原表直接公布的录取最低位次。",
    parsedRecords: rankConversions.length,
    subjectBreakdown: Object.fromEntries(built.map((item) => [item.config.subjectType, item.rankConversions.length])),
    provenance: {
      governmentReleaseUrl: GOVERNMENT_RELEASE_URL,
      governmentCheckpoints: { history600: 2369, physics600: 15860 },
      eolAuthorityAttribution: "湖南省教育厅",
      eolHistoryUrl: EOL_HISTORY_URL,
      eolPhysicsUrl: EOL_PHYSICS_URL,
      chsiAttribution: "湖南考试招生",
      chsiHistoryUrl: CHSI_HISTORY_URL,
      chsiPhysicsUrl: CHSI_PHYSICS_URL,
      chsiHistoryImageUrl: CHSI_HISTORY_IMAGE_URL,
      chsiPhysicsImageUrl: CHSI_PHYSICS_IMAGE_URL,
      dxsbbHistoryUrl: DXSBB_HISTORY_URL,
      dxsbbPhysicsUrl: DXSBB_PHYSICS_URL,
      verification: "all 1139 independently mirrored rows and 3417 score/count/cumulative-rank cells match the two authority-attributed full tables; all 1152 authority rows close cumulatively, and 11 zero-candidate scores remain gaps",
      authorityRows,
      rowComparisons,
      cellComparisons,
      zeroScoreGaps,
      imageDimensions,
      evidenceSha256: EVIDENCE,
    },
    evidenceBoundary: "The tables are provincial subject-combination score distributions including preferential policy points. They support same-year cultural-score rank ranges, not institution-native minimum admission ranks or art/sports composite-score ranks.",
  };

  const payload = {
    dataset: "official-hunan-rank-conversion-2025-v3318-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      expectedRecords: 1139,
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      authorityRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.authorityRows.length])),
      numericRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.numericRows.length])),
      emittedRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.rankConversions.length])),
      mirrorRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.mirrorRows.length])),
      rowComparisons,
      cellComparisons,
      sourceDifferences: 0,
      zeroScoreGaps: Object.fromEntries(built.map((item) => [item.config.subjectType, item.config.expectedZeroScores])),
      allAuthorityCountsClose: true,
      allCumulativeRanksMonotonic: true,
      governmentEolAndChsiAttributionsVerified: true,
      chsiImageDimensions: imageDimensions,
    },
    notes: [
      "历史类658-750分为1-55名合并档，物理类690-750分为1-53名合并档；不生成合并档内的伪精确位次。",
      "历史类129、124、116、115、112、110、105、104、103分和物理类107、101分为零人数缺口；保留缺口，不虚构同分考生记录。",
      "0-99分合并档不参与本站普通录取最低分位次换算；最低可换算分数为100分。",
      "表中档分含优惠加分；只用于同年同科类文化课档分到省级位次区间换算。",
      "艺术、体育综合投档分、科类不明、非整数分和特殊路径记录不参与普通类最低分位次回填。",
      "湖南省教育厅来源标注完整表与独立完整镜像逐行零差异，阳光高考同时保存湖南考试招生来源原图。",
    ],
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    dataset: payload.dataset,
    rows: rankConversions.length,
    historyRows: built[0].rankConversions.length,
    physicsRows: built[1].rankConversions.length,
    authorityRows,
    rowComparisons,
    cellComparisons,
    zeroScoreGaps,
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
