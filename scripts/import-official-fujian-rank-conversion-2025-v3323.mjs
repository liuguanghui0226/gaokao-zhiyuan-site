#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-fujian-rank-conversion-2025-v3323";
const DEFAULT_OUT = "data/admissions/official-fujian-rank-conversion-2025-v3323-import.json";
const SOURCE_ID = "official-fujian-rank-2025-v3323";
const PROVINCE = "福建";
const YEAR = 2025;
const QUALITY = "official-fujian-exam-authority-images-eol-structured-table-cross-verified";
const PHYSICS_URL = "https://www.eeafj.cn/gkptgkgsgg/20250625/14056.html";
const HISTORY_URL = "https://www.eeafj.cn/gkptgkgsgg/20250625/14055.html";
const EOL_PHYSICS_URL = "https://gaokao.eol.cn/fu_jian/dongtai/202507/t20250702_2678456.shtml";
const EOL_HISTORY_URL = "https://gaokao.eol.cn/fu_jian/dongtai/202507/t20250702_2678457.shtml";

const EVIDENCE = {
  "physics-page.html": "917b13308976be25201ede66ae9fcaee3f794a7e4d1696a150b5aac4866a2472",
  "history-page.html": "675ceeae8ca2a7cd842286395bef80f9ce28afc6457d26a22fed950923902b07",
  "eol-physics.html": "23ceb407118d83a2d88e8dbc8ac560a18abfc28873b1b13c1b3460a87b2d4b9b",
  "eol-history.html": "4e777ce95fdefde0a1f3af21f9ff424af2f8c9e02fc2576b3bad0ceee5e05e3c",
  "wl-01.jpg": "13a249db13009e5acf6346b00602d155d3f0e56707912b7cfed0112411364db9",
  "wl-02.jpg": "789c4d3c116d7a36e23a129f65ffdf20d49987b6a9555a793982ffa5a6df7b7a",
  "wl-03.jpg": "9039f32baf087e302956d3bb29e1b70960480e6951c61fcd8f3c51e72dae342c",
  "wl-04.jpg": "3efc8d9fe7680d5ddf3e6c2c2a4ec1599ba3e3221f56b52eed0737b7c32350ca",
  "ls-01.jpg": "21790209882942810f7be7c9a4e1069507fe748d42981bd99f3b55509ae72424",
  "ls-02.jpg": "d6f36957ef791dc41e5a3ff736bdd8563eaf426a1075144d0a54c50ecffc94bf",
  "ls-03.jpg": "e55b01d7705bb3e09d421ab2f3e19efd54e56ba5e1633bc37f04c1c61518c0fa",
  "ls-04.jpg": "be78d6bceeadc4b99422cdc4aa582fecf9a48874d93c763f6ac1f041b44a6b37",
};

const SUBJECTS = [
  {
    key: "history",
    prefix: "ls",
    subjectType: "历史类",
    officialPageFile: "history-page.html",
    officialUrl: HISTORY_URL,
    officialTitle: "2025年高考考生成绩分布（历史科目组）",
    eolFile: "eol-history.html",
    eolUrl: EOL_HISTORY_URL,
    eolTitle: "福建2025年高考一分一段表公布（历史类）",
    topLabel: "672-750",
    topBucketScore: 672,
    topBucketEnd: 14,
    expectedStructuredRows: 458,
    expectedOfficialRows: 456,
    expectedZeroRows: [[664, 0, 27]],
    expectedAnnotations: [[531, "特招线"], [450, "本科线"], [235, "专科线"]],
    first: [671, 1, 15, 15],
    last: [215, 20, 60233, 60252],
    checkpoints: {
      600: [74, 1756],
      550: [122, 6718],
      500: [171, 14732],
      441: [222, 27621],
      400: [276, 37433],
      300: [104, 55967],
      215: [20, 60252],
    },
    pagePanelRows: [[39, 41, 41], [41, 41, 41], [41, 41, 41], [41, 41, 7]],
    expectedOcr: { score: 234, people: 227, cumulative: 221, all: 195, scoreCumulative: 212 },
  },
  {
    key: "physics",
    prefix: "wl",
    subjectType: "物理类",
    officialPageFile: "physics-page.html",
    officialUrl: PHYSICS_URL,
    officialTitle: "2025年高考考生成绩分布（物理科目组）",
    eolFile: "eol-physics.html",
    eolUrl: EOL_PHYSICS_URL,
    eolTitle: "福建2025年高考一分一段表公布（物理类）",
    topLabel: "689-750",
    topBucketScore: 689,
    topBucketEnd: 46,
    expectedStructuredRows: 475,
    expectedOfficialRows: 474,
    expectedZeroRows: [],
    expectedAnnotations: [[520, "特招线"], [441, "本科线"], [235, "专科线"]],
    first: [688, 12, 47, 58],
    last: [215, 14, 192083, 192096],
    checkpoints: {
      600: [299, 12735],
      550: [527, 35037],
      500: [755, 69546],
      450: [841, 111729],
      400: [638, 148073],
      300: [210, 185166],
      215: [14, 192096],
    },
    pagePanelRows: [[39, 41, 41], [41, 41, 41], [41, 41, 41], [41, 41, 25]],
    expectedOcr: { score: 225, people: 238, cumulative: 217, all: 205, scoreCumulative: 207 },
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

function jpegDimensions(bytes) {
  assert(bytes[0] === 0xff && bytes[1] === 0xd8, "Invalid JPEG evidence");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    assert(length >= 2, "Invalid JPEG marker length");
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions not found");
}

function cleanCell(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
}

function parseStructuredTable(html, config) {
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((value) => value.includes("累计人数") && value.includes(config.topLabel));
  assert(table, `${config.key} structured score table is missing`);
  const rawRows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanCell(cell[1])))
    .filter((row) => row.length === 3);
  assert(JSON.stringify(rawRows[0]) === JSON.stringify(["分数", "人数", "累计人数"]), `${config.key} table header drifted`);
  const published = rawRows.slice(1);
  assert(published.length === config.expectedStructuredRows, `${config.key} expected ${config.expectedStructuredRows} structured rows, got ${published.length}`);
  assert(JSON.stringify(published[0]) === JSON.stringify([config.topLabel, String(config.topBucketEnd), String(config.topBucketEnd)]), `${config.key} top bucket drifted`);
  const annotations = [];
  const rows = published.slice(1).map((row) => {
    const scoreMatch = row[0].match(/^(\d+)(?:（(特招线|本科线|专科线)）)?$/);
    assert(scoreMatch && row.slice(1).every((value) => /^\d+$/.test(value)), `${config.key} contains an invalid row: ${JSON.stringify(row)}`);
    const score = Number(scoreMatch[1]);
    if (scoreMatch[2]) annotations.push([score, scoreMatch[2]]);
    const sameRankScore = Number(row[1]);
    const rankEnd = Number(row[2]);
    return { score, sameRankScore, rankStart: rankEnd - sameRankScore + 1, rankEnd };
  });
  assert(JSON.stringify(annotations) === JSON.stringify(config.expectedAnnotations), `${config.key} control-line annotations drifted`);
  return { published, rows };
}

function validateRows(rows, config) {
  const positive = rows.filter((row) => row.sameRankScore > 0);
  assert(positive.length === config.expectedOfficialRows, `${config.key} expected ${config.expectedOfficialRows} official-image rows, got ${positive.length}`);
  assert(JSON.stringify(Object.values(positive[0])) === JSON.stringify(config.first), `${config.key} first row drifted`);
  assert(JSON.stringify(Object.values(positive.at(-1))) === JSON.stringify(config.last), `${config.key} last row drifted`);
  assert(rows.every((row) => [row.score, row.sameRankScore, row.rankStart, row.rankEnd].every(Number.isInteger)), `${config.key} contains non-integers`);
  assert(rows.every((row, index) => index === 0 || row.score === rows[index - 1].score - 1), `${config.key} structured scores are not complete and descending`);
  let previousEnd = config.topBucketEnd;
  for (const row of rows) {
    assert(row.rankEnd === previousEnd + row.sameRankScore, `${config.key} cumulative rank discontinuity at ${row.score}`);
    assert(row.rankStart === previousEnd + 1, `${config.key} rank start discontinuity at ${row.score}`);
    previousEnd = row.rankEnd;
  }
  const zeroRows = rows.filter((row) => row.sameRankScore === 0).map((row) => [row.score, row.sameRankScore, row.rankEnd]);
  assert(JSON.stringify(zeroRows) === JSON.stringify(config.expectedZeroRows), `${config.key} zero-candidate rows drifted`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    const row = rows.find((item) => item.score === Number(score));
    assert(row && JSON.stringify([row.sameRankScore, row.rankEnd]) === JSON.stringify(expected), `${config.key} checkpoint ${score} drifted`);
  }
  return positive;
}

function readOcrRows(rawDir, config) {
  const panels = ["left", "middle", "right"];
  const rows = [];
  for (let page = 1; page <= 4; page += 1) {
    for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
      const panel = panels[panelIndex];
      const file = path.join(rawDir, `${config.prefix}-0${page}-${panel}-grid.json`);
      assert(fs.existsSync(file), `Missing OCR evidence ${file}`);
      const payload = JSON.parse(fs.readFileSync(file, "utf8"));
      const expectedRows = config.pagePanelRows[page - 1][panelIndex];
      assert(payload.imageWidth === 2480 && payload.imageHeight === 3507, `${path.basename(file)} dimensions drifted`);
      assert(payload.rowCount === expectedRows, `${path.basename(file)} row count drifted`);
      for (let row = 0; row < expectedRows; row += 1) {
        const cells = Object.fromEntries(payload.cells.filter((cell) => cell.row === row).map((cell) => [cell.col, cell]));
        assert(["score", "people", "cumulative"].every((field) => cells[field]), `${path.basename(file)} row ${row} is incomplete`);
        rows.push(cells);
      }
    }
  }
  assert(rows.length === config.expectedOfficialRows, `${config.key} OCR row total drifted`);
  return rows;
}

function numericOcrValue(cell) {
  return /^\d+$/.test(cell.text) ? Number(cell.text) : NaN;
}

function compareOcr(rows, ocrRows, config) {
  const matches = { score: 0, people: 0, cumulative: 0, all: 0, scoreCumulative: 0 };
  for (let index = 0; index < rows.length; index += 1) {
    const expected = rows[index];
    const ocr = ocrRows[index];
    const exact = {
      score: numericOcrValue(ocr.score) === expected.score,
      people: numericOcrValue(ocr.people) === expected.sameRankScore,
      cumulative: numericOcrValue(ocr.cumulative) === expected.rankEnd,
    };
    for (const field of ["score", "people", "cumulative"]) if (exact[field]) matches[field] += 1;
    if (exact.score && exact.people && exact.cumulative) matches.all += 1;
    if (exact.score && exact.cumulative) matches.scoreCumulative += 1;
  }
  assert(JSON.stringify(matches) === JSON.stringify(config.expectedOcr), `${config.key} official-image OCR comparison drifted: ${JSON.stringify(matches)}`);
  return matches;
}

function makeId(config, score, topBucket = false) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${config.subjectType}|${score}|${topBucket}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-fujian-rank-${config.key}-${digest}`;
}

function buildRankConversions(rows, config) {
  const shared = {
    province: PROVINCE,
    year: YEAR,
    subjectType: config.subjectType,
    dataType: "rank-conversion",
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: config.officialUrl,
    structuredTableUrl: config.eolUrl,
    evidenceStage: "ordinary-published-score-floor-including-policy-bonus",
    publishedScoreFloor: 215,
  };
  return [{
    ...shared,
    id: makeId(config, config.topBucketScore, true),
    score: config.topBucketScore,
    scoreRange: { min: config.topBucketScore, max: 750 },
    rankStart: 1,
    rankEnd: config.topBucketEnd,
    sameRankScore: config.topBucketEnd,
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
  const evidenceHashes = {};

  for (const [name, expectedHash] of Object.entries(EVIDENCE)) {
    const file = path.join(rawDir, name);
    assert(fs.existsSync(file), `Missing evidence file ${file}`);
    const bytes = fs.readFileSync(file);
    evidenceHashes[name] = sha256(bytes);
    assert(evidenceHashes[name] === expectedHash, `${name} hash drifted`);
  }

  for (const config of SUBJECTS) {
    const officialHtml = fs.readFileSync(path.join(rawDir, config.officialPageFile), "utf8");
    assert(officialHtml.includes(config.officialTitle), `${config.key} official title is missing`);
    assert(officialHtml.includes("福建省教育考试院") && officialHtml.includes("2025-06-25"), `${config.key} official publisher or publication date is missing`);
    for (let page = 1; page <= 4; page += 1) {
      const imageName = `${config.prefix}-0${page}.jpg`;
      assert(officialHtml.includes(imageName), `${config.key} official image ${imageName} link is missing`);
      assert(JSON.stringify(jpegDimensions(fs.readFileSync(path.join(rawDir, imageName)))) === JSON.stringify({ width: 2480, height: 3507 }), `${imageName} dimensions drifted`);
    }
  }

  let structuredRows = 0;
  let officialRows = 0;
  let zeroCandidateRows = 0;
  const ocrMatches = { score: 0, people: 0, cumulative: 0, all: 0, scoreCumulative: 0 };
  const built = SUBJECTS.map((config) => {
    const eolHtml = fs.readFileSync(path.join(rawDir, config.eolFile), "utf8");
    assert(eolHtml.includes(config.eolTitle) && eolHtml.includes("福建省教育考试院"), `${config.key} EOL title or source attribution is missing`);
    const parsed = parseStructuredTable(eolHtml, config);
    const positiveRows = validateRows(parsed.rows, config);
    const matches = compareOcr(positiveRows, readOcrRows(rawDir, config), config);
    structuredRows += parsed.published.length;
    officialRows += positiveRows.length;
    zeroCandidateRows += parsed.rows.length - positiveRows.length;
    for (const field of Object.keys(ocrMatches)) ocrMatches[field] += matches[field];
    return { config, rows: positiveRows, rankConversions: buildRankConversions(positiveRows, config) };
  });

  assert(structuredRows === 933, `Expected 933 structured rows, got ${structuredRows}`);
  assert(officialRows === 930, `Expected 930 official-image rows, got ${officialRows}`);
  assert(zeroCandidateRows === 1, `Expected one zero-candidate row, got ${zeroCandidateRows}`);
  assert(JSON.stringify(ocrMatches) === JSON.stringify({ score: 459, people: 465, cumulative: 438, all: 400, scoreCumulative: 419 }), "Combined official-image OCR totals drifted");
  const rankConversions = built.flatMap((item) => item.rankConversions);
  assert(rankConversions.length === 932, `Expected 932 emitted rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate Fujian rank conversion IDs detected");
  assert(rankConversions.filter((row) => row.topWithheldRange).length === 2, "Fujian top bucket count drifted");
  assert(!rankConversions.some((row) => row.subjectType === "历史类" && row.score === 664), "Zero-candidate history score 664 must not emit an impossible rank interval");

  for (const file of fs.readdirSync(rawDir).filter((name) => name.endsWith("-grid.json"))) {
    evidenceHashes[file] = sha256(fs.readFileSync(path.join(rawDir, file)));
  }

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "福建省2025年高考考生成绩分布（历史科目组、物理科目组）",
    publisher: "福建省教育考试院",
    province: PROVINCE,
    year: YEAR,
    url: PHYSICS_URL,
    historyUrl: HISTORY_URL,
    physicsUrl: PHYSICS_URL,
    historyStructuredTableUrl: EOL_HISTORY_URL,
    physicsStructuredTableUrl: EOL_PHYSICS_URL,
    quality: QUALITY,
    usage: "用于把福建2025同科类普通高考整数最低分或考生分数换算为官方已公布至215分的省级累计位次区间；最低分换算位次不冒充院校投档表原生公布的最低位次。",
    parsedRecords: rankConversions.length,
    structuredTableRows: structuredRows,
    officialImageRows: officialRows,
    subjectBreakdown: { 历史类: 457, 物理类: 475 },
    publishedScoreFloors: { 历史类: 215, 物理类: 215 },
    provenance: {
      officialUrls: { 历史类: HISTORY_URL, 物理类: PHYSICS_URL },
      structuredTableUrls: { 历史类: EOL_HISTORY_URL, 物理类: EOL_PHYSICS_URL },
      structuredRows,
      officialImageRows: officialRows,
      officialImageCellsCompared: officialRows * 3,
      zeroCandidateRowsOmittedFromRankMapping: 1,
      allCountsClose: true,
      allCumulativeRanksContinuous: true,
      officialImages: 8,
      officialImageDimensions: { width: 2480, height: 3507 },
      imageOcrRowsCompared: officialRows,
      imageOcrScoreMatches: ocrMatches.score,
      imageOcrPeopleMatches: ocrMatches.people,
      imageOcrCumulativeMatches: ocrMatches.cumulative,
      imageOcrAllCellMatches: ocrMatches.all,
      imageOcrScoreCumulativeMatches: ocrMatches.scoreCumulative,
      evidenceSha256: evidenceHashes,
    },
    cautions: [
      "表中累计人数按含政策性加分的投档成绩统计，只能用于福建2025同首选科目的普通类分数位次换算。",
      "历史类664分为0人占位，考试院原图未刊出且不生成空位次区间。",
      "官方原图公开至215分；低于215分的记录保持无位次状态，不向下外推。",
      "最高分段按官方首个公开分数档之前的累计人数合并为区间，不生成区间内伪精确名次。",
      "艺术类、体育类、综合评价及其他特殊路径不与普通类一分一段表混用。",
      "最低分换算位次不是院校投档表原生公布的最低位次，正式填报前仍须核验当年考试院表、招生计划和院校章程。",
    ],
  };

  const payload = {
    dataset: "official-fujian-rank-conversion-2025-v3323-import",
    generatedAt,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      structuredRows,
      officialImageRows: officialRows,
      officialImageCellsCompared: officialRows * 3,
      zeroCandidateRows: zeroCandidateRows,
      topBuckets: 2,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      allCountsClose: true,
      allCumulativeRanksContinuous: true,
      officialImages: 8,
      imageOcrRowsCompared: officialRows,
      imageOcrMatches: ocrMatches,
      evidenceSha256: evidenceHashes,
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outFile),
    rankConversions: rankConversions.length,
    structuredRows,
    officialImageRows: officialRows,
    officialImageCellsCompared: officialRows * 3,
    imageOcrMatches: ocrMatches,
  }, null, 2));
}

main();
