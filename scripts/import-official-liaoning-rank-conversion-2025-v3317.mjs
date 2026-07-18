#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-liaoning-rank-conversion-2025-v3317";
const DEFAULT_OUT = "data/admissions/official-liaoning-rank-conversion-2025-v3317-import.json";
const SOURCE_ID = "official-liaoning-rank-2025-v3317";
const PROVINCE = "辽宁";
const YEAR = 2025;
const GOVERNMENT_INDEX_URL = "https://jyt.ln.gov.cn/jyt/jyzx/jyyw/2025062418040445891/index.shtml";
const CHSI_INDEX_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250625/2293390731.html";
const OFFICIAL_PHYSICS_URL = "https://www.lnzsks.com/lnzkbfiles/2025/2025gk1f1d0624wl001.pdf";
const OFFICIAL_HISTORY_URL = "https://www.lnzsks.com/lnzkbfiles/2025/2025gk1f1d0624ls002.pdf";
const CHSI_PHYSICS_URL = "https://t1.chei.com.cn/news/getfile/2293390732-2293390731-53c944bf90992bafc4711ee5699247f5.pdf";
const CHSI_HISTORY_URL = "https://t4.chei.com.cn/news/getfile/2293390733-2293390731-9f562b4a66f01064b0f350e7ce7f6099.pdf";
const EOL_PHYSICS_URL = "https://gaokao.eol.cn/liao_ning/dongtai/202506/t20250624_2676792.shtml";
const EOL_HISTORY_URL = "https://gaokao.eol.cn/liao_ning/dongtai/202506/t20250624_2676782.shtml";
const QUALITY = "official-content-mirror-chsi-liaoning-exam-office-pdf-text-eol-cross-verified";

const EVIDENCE = {
  "government-index.html": "d31718802d4fa011d89f7fd2e71293b22dc0e1d59fc535f08c87e3c87722f64e",
  "chsi-index.html": "2b7fb8ee3420220fccaa72c410ff5ec0f8f5e98dde1e26066cd7f693721e37ad",
  "chsi-physics.pdf": "acf112a955da480b6d818036d5b5731ea4a937c43f94958eed1a3c68544be91b",
  "chsi-history.pdf": "b9e0ed80edda7206107d772bf62214aa8a4a169c6dec982c05a97426ec36b4e4",
  "chsi-physics-raw.txt": "98fdad15d0202a73002e0ed4b067b44880000c662d8f4a498eb7d0aca2870522",
  "chsi-history-raw.txt": "fd2f9d9c8f4fbe8b219891128f472e583bfc3b529bd5ab48a5988d02b36f53c9",
  "chsi-physics-layout.txt": "9adfe0e8663be56863d43313ba1d465f47ea48736270286c624f504e1e18854f",
  "chsi-history-layout.txt": "1a2d81f15293649d5905f9b7650e869f9e182c1696d8c6f525981516821e0e39",
  "eol-physics.html": "41d1ab7d388142957b8256a60693a84fb296362c5089bab063f9b1e4272b3994",
  "eol-history.html": "d7d68c05926390b7248dee585095e321d5654904ce6aa4b48c738427a08e51a1",
};

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    topScore: 669,
    bottomScore: 150,
    expectedPublishedRows: 517,
    expectedFullRows: 520,
    expectedZeroScores: [667, 164, 162],
    topRankEnd: 10,
    bottomRankEnd: 56324,
    officialUrl: OFFICIAL_HISTORY_URL,
    chsiUrl: CHSI_HISTORY_URL,
    eolUrl: EOL_HISTORY_URL,
    checkpoints: { 600: 2025, 500: 14867, 437: 26916, 300: 50663, 150: 56324 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    topScore: 707,
    bottomScore: 150,
    expectedPublishedRows: 556,
    expectedFullRows: 558,
    expectedZeroScores: [703, 153],
    topRankEnd: 11,
    bottomRankEnd: 143368,
    officialUrl: OFFICIAL_PHYSICS_URL,
    chsiUrl: CHSI_PHYSICS_URL,
    eolUrl: EOL_PHYSICS_URL,
    checkpoints: { 600: 13601, 500: 56548, 367: 118109, 300: 135097, 150: 143368 },
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

function parsePdfText(text, config) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d{3})\s+([\d,]+)\s+([\d,]+)(?:\s+及以上)?$/);
    if (!match) continue;
    const score = Number(match[1]);
    if (score < config.bottomScore || score > config.topScore) continue;
    rows.push({
      score,
      sameRankScore: Number(match[2].replaceAll(",", "")),
      rankEnd: Number(match[3].replaceAll(",", "")),
    });
  }
  return rows;
}

function parseEolTable(html, config) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => cleanText(table).includes("累计人数") && cleanText(table).includes("分数"));
  assert(tables.length === 1, `${config.subjectType} EOL expected one score table, got ${tables.length}`);
  const rows = [];
  for (const match of tables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanText(cell[1]));
    const scoreMatch = String(cells[0] || "").match(/^(\d{3})(?:\s*(?:-|至|及以上).*?)?$/);
    if (!scoreMatch || cells.length < 3) continue;
    const score = Number(scoreMatch[1]);
    if (score < config.bottomScore || score > config.topScore) continue;
    const sameRankScore = Number(String(cells[1]).replaceAll(",", ""));
    const rankEnd = Number(String(cells[2]).replaceAll(",", ""));
    assert(Number.isInteger(sameRankScore) && Number.isInteger(rankEnd), `${config.subjectType} invalid EOL row ${JSON.stringify(cells)}`);
    rows.push({ score, sameRankScore, rankEnd });
  }
  return rows;
}

function validatePublishedRows(rows, config, label) {
  assert(rows.length === config.expectedPublishedRows, `${label} expected ${config.expectedPublishedRows} rows, got ${rows.length}`);
  assert(rows[0].score === config.topScore && rows.at(-1).score === config.bottomScore, `${label} score boundaries drifted`);
  assert(new Set(rows.map((row) => row.score)).size === rows.length, `${label} contains duplicate scores`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].score > row.score), `${label} scores are not descending`);
  assert(rows.every((row, index) => index === 0 || row.rankEnd >= rows[index - 1].rankEnd), `${label} cumulative ranks are not monotonic`);
  assert(rows.every((row, index) => row.rankEnd - (index ? rows[index - 1].rankEnd : 0) === row.sameRankScore), `${label} published counts do not close`);
  assert(rows[0].rankEnd === config.topRankEnd && rows.at(-1).rankEnd === config.bottomRankEnd, `${label} rank boundaries drifted`);
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) {
    assert(rows.find((row) => row.score === Number(score))?.rankEnd === rankEnd, `${label} checkpoint ${score} drifted`);
  }
}

function validateEolRows(rows, config) {
  assert(rows.length === config.expectedFullRows, `${config.subjectType} EOL expected ${config.expectedFullRows} rows, got ${rows.length}`);
  assert(rows[0].score === config.topScore && rows.at(-1).score === config.bottomScore, `${config.subjectType} EOL boundaries drifted`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1), `${config.subjectType} EOL scores are not contiguous`);
  assert(rows.every((row, index) => index === 0 || row.rankEnd >= rows[index - 1].rankEnd), `${config.subjectType} EOL ranks are not monotonic`);
  assert(rows.every((row, index) => row.rankEnd - (index ? rows[index - 1].rankEnd : 0) === row.sameRankScore), `${config.subjectType} EOL counts do not close`);
  const zeroScores = rows.filter((row) => row.sameRankScore === 0).map((row) => row.score);
  assert(JSON.stringify(zeroScores) === JSON.stringify(config.expectedZeroScores), `${config.subjectType} zero-score gaps drifted: ${zeroScores}`);
}

function compareSources(published, eol, config) {
  const eolByScore = new Map(eol.map((row) => [row.score, row]));
  let cellComparisons = 0;
  for (const row of published) {
    const mirror = eolByScore.get(row.score);
    assert(mirror, `${config.subjectType} EOL is missing published score ${row.score}`);
    for (const field of ["score", "sameRankScore", "rankEnd"]) {
      assert(row[field] === mirror[field], `${config.subjectType} sources differ at ${row.score} field ${field}`);
      cellComparisons += 1;
    }
  }
  return { rowComparisons: published.length, cellComparisons };
}

function makeId(subjectType, score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subjectType}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-liaoning-rank-${subjectType === "历史类" ? "history" : "physics"}-${digest}`;
}

function buildRankConversions(rows, config) {
  let previousRankEnd = 0;
  return rows.map((row, index) => {
    const record = {
      id: makeId(config.subjectType, row.score),
      province: PROVINCE,
      year: YEAR,
      subjectType: config.subjectType,
      dataType: "rank-conversion",
      score: row.score,
      rankStart: previousRankEnd + 1,
      rankEnd: row.rankEnd,
      sameRankScore: row.sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: QUALITY,
      sourceUrl: CHSI_INDEX_URL,
      governmentIndexUrl: GOVERNMENT_INDEX_URL,
      officialAttachmentUrl: config.officialUrl,
      chsiAttachmentUrl: config.chsiUrl,
      mirrorUrl: config.eolUrl,
    };
    previousRankEnd = row.rankEnd;
    if (index === 0) record.scoreRange = { min: row.score, max: 750 };
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

  const governmentIndex = raw["government-index.html"].toString("utf8");
  const chsiIndex = raw["chsi-index.html"].toString("utf8");
  for (const config of SUBJECTS) {
    assert(governmentIndex.includes(config.officialUrl), `Government index is missing ${config.officialUrl}`);
    assert(chsiIndex.includes(config.chsiUrl), `CHSI index is missing ${config.chsiUrl}`);
  }
  assert(cleanText(governmentIndex).includes("文章来源：辽宁招生考试之窗"), "Government index attribution is missing");
  assert(cleanText(chsiIndex).includes("来源：辽宁招生考试之窗"), "CHSI index attribution is missing");

  const built = SUBJECTS.map((config) => {
    const published = parsePdfText(raw[`chsi-${config.key}-raw.txt`].toString("utf8"), config);
    const eol = parseEolTable(raw[`eol-${config.key}.html`].toString("utf8"), config);
    validatePublishedRows(published, config, `${config.subjectType} CHSI PDF`);
    validateEolRows(eol, config);
    const comparison = compareSources(published, eol, config);
    return { config, published, eol, comparison, rankConversions: buildRankConversions(published, config) };
  });

  const rankConversions = built.flatMap((item) => item.rankConversions);
  const rowComparisons = built.reduce((sum, item) => sum + item.comparison.rowComparisons, 0);
  const cellComparisons = built.reduce((sum, item) => sum + item.comparison.cellComparisons, 0);
  const zeroScoreGaps = built.reduce((sum, item) => sum + item.config.expectedZeroScores.length, 0);
  assert(rankConversions.length === 1073 && rowComparisons === 1073 && cellComparisons === 3219 && zeroScoreGaps === 5, "Evidence comparison totals drifted");
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank conversion IDs detected");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "2025年辽宁省普通高校招生考试成绩统计表（历史、物理学科类）",
    publisher: "辽宁省高中等教育招生考试委员会办公室",
    province: PROVINCE,
    year: YEAR,
    url: CHSI_INDEX_URL,
    quality: QUALITY,
    usage: "用于把辽宁2025同科类普通高考录取最低分换算为全省累计位次区间；不冒充院校原表直接公布的录取最低位次。",
    parsedRecords: rankConversions.length,
    subjectBreakdown: Object.fromEntries(built.map((item) => [item.config.subjectType, item.rankConversions.length])),
    provenance: {
      governmentIndexUrl: GOVERNMENT_INDEX_URL,
      governmentIndexAttribution: "辽宁招生考试之窗",
      officialDirectRetrievalStatus: "tls-unavailable-current-session",
      officialPhysicsUrl: OFFICIAL_PHYSICS_URL,
      officialHistoryUrl: OFFICIAL_HISTORY_URL,
      chsiIndexUrl: CHSI_INDEX_URL,
      chsiPhysicsAttachmentUrl: CHSI_PHYSICS_URL,
      chsiHistoryAttachmentUrl: CHSI_HISTORY_URL,
      eolPhysicsUrl: EOL_PHYSICS_URL,
      eolHistoryUrl: EOL_HISTORY_URL,
      verification: "all 1073 published score/count/cumulative-rank rows and 3219 cells match the two EOL full tables; five zero-candidate score gaps are preserved as gaps and not emitted as rank rows",
      rowComparisons,
      cellComparisons,
      zeroScoreGaps,
      evidenceSha256: EVIDENCE,
    },
    evidenceBoundary: "The provincial tables combine ordinary, art and sports candidates within each history/physics subject category. They support same-year provincial score-to-rank ranges, not institution-native minimum admission ranks.",
  };

  const payload = {
    dataset: "official-liaoning-rank-conversion-2025-v3317-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      expectedRecords: 1073,
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      publishedRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.published.length])),
      fullMirrorRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.eol.length])),
      rowComparisons,
      cellComparisons,
      sourceDifferences: 0,
      zeroScoreGaps: Object.fromEntries(built.map((item) => [item.config.subjectType, item.config.expectedZeroScores])),
      allPublishedCountsClose: true,
      allCumulativeRanksMonotonic: true,
      governmentAndChsiIndexesVerified: true,
    },
    notes: [
      "历史类669分及以上为1-10名合并档，物理类707分及以上为1-11名合并档；不生成合并档内的伪精确位次。",
      "历史类667、227、221分和物理类703、153分为零人数缺口；保留缺口，不虚构同分考生记录。",
      "表中人数为普通类、艺术类和体育类人数之和；仅用于同科类文化课总分与政策加分之和到省级位次区间换算。",
      "艺术、体育综合投档分、科类不明、非整数分和特殊路径记录不参与普通类最低分位次回填。",
      "辽宁招生考试之窗原始PDF当前会话TLS不可达；省教育厅页面保留原始链接，阳光高考附件保存考试院PDF，完整逐分表与PDF逐项零差异。",
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
    rowComparisons,
    cellComparisons,
    zeroScoreGaps,
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
