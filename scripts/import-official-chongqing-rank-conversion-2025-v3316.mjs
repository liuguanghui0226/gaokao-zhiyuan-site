#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-chongqing-rank-conversion-2025-v3316";
const DEFAULT_OUT = "data/admissions/official-chongqing-rank-conversion-2025-v3316-import.json";
const SOURCE_ID = "official-chongqing-rank-2025-v3316";
const PROVINCE = "重庆";
const YEAR = 2025;
const EOL_INDEX_URL = "https://gaokao.eol.cn/chong_qing/dongtai/202506/t20250624_2676752.shtml";
const EOL_HISTORY_URL = "https://gaokao.eol.cn/chong_qing/dongtai/202506/t20250624_2676749.shtml";
const EOL_PHYSICS_URL = "https://gaokao.eol.cn/chong_qing/dongtai/202506/t20250624_2676788.shtml";
const OFFICIAL_HISTORY_URL = "https://www.cqksy.cn/uploadFile/infopub/2025/pg/yfd/wk.htm";
const OFFICIAL_PHYSICS_URL = "https://www.cqksy.cn/uploadFile/infopub/2025/pg/yfd/lk.htm";
const SECOND_INDEX_URL = "https://www.gkzxw.com/gxzs/202506/70965.html";
const MIRROR_HISTORY_URL = "https://www.dxsbb.com/news/148773.html";
const MIRROR_PHYSICS_URL = "https://www.dxsbb.com/news/148772.html";
const QUALITY = "official-content-mirror-eol-chongqing-exam-authority-linked-full-table-dxsbb-cross-verified";

const EVIDENCE = {
  "eol-history.html": "da546a8a61c6820c70b9e177ff24cca9bf4c0d5f13bf5e4be184b413220893d0",
  "eol-physics.html": "7338bf36ddb86e5bcf1cdb34eb6d2c9b5728b735cf3a486db16af7c8343f66a0",
  "eol-index.html": "5e3bf43f622e68db6f0740f705ffb606436708490d34913c891cc240a90310d0",
  "gkzxw-index.html": "ea8943a6ee65537d3284bce8d01f18a5a2e7474187b8c15e353053c7082bc8bf",
  "dxsbb-history.html": "5c3afc936a45c310d18d9c3e0273085265bb53b37f52b714415b5326170a4b59",
  "dxsbb-physics.html": "a73d7af925c6389c4a3b34fe28b9526fe7e3e31dde54c1f233df1292ce2ea413",
};

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    topScore: 652,
    bottomScore: 180,
    expectedRows: 473,
    topRankEnd: 66,
    bottomRankEnd: 73373,
    officialUrl: OFFICIAL_HISTORY_URL,
    eolUrl: EOL_HISTORY_URL,
    mirrorUrl: MIRROR_HISTORY_URL,
    checkpoints: { 600: 1576, 500: 17717, 438: 35253, 300: 68711, 180: 73373 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    topScore: 681,
    bottomScore: 180,
    expectedRows: 502,
    topRankEnd: 159,
    bottomRankEnd: 139478,
    officialUrl: OFFICIAL_PHYSICS_URL,
    eolUrl: EOL_PHYSICS_URL,
    mirrorUrl: MIRROR_PHYSICS_URL,
    checkpoints: { 600: 11716, 500: 62078, 425: 103219, 300: 134938, 180: 139478 },
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

function parseRankTable(html, config, label) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => cleanText(table).includes("累计人数") && cleanText(table).includes("分数"));
  assert(tables.length === 1, `${label} expected one score table, got ${tables.length}`);
  const rows = [];
  for (const match of tables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanText(cell[1]));
    const scoreMatch = String(cells[0] || "").match(/^(\d{3})(?:\D.*)?$/);
    if (!scoreMatch) continue;
    const score = Number(scoreMatch[1]);
    if (score < config.bottomScore || score > config.topScore) continue;
    const sameRankScore = cells.length === 2 ? Number(cells[1]) : Number(cells[1]);
    const rankEnd = cells.length === 2 ? Number(cells[1]) : Number(cells[2]);
    assert(Number.isInteger(sameRankScore) && Number.isInteger(rankEnd), `${label} invalid row ${JSON.stringify(cells)}`);
    rows.push({ score, sameRankScore, rankEnd });
  }
  return rows;
}

function validateRows(rows, config, label) {
  assert(rows.length === config.expectedRows, `${label} expected ${config.expectedRows} rows, got ${rows.length}`);
  assert(rows[0].score === config.topScore && rows.at(-1).score === config.bottomScore, `${label} score boundaries drifted`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1), `${label} scores are not contiguous`);
  assert(rows.every((row, index) => index === 0 || row.rankEnd >= rows[index - 1].rankEnd), `${label} cumulative ranks are not monotonic`);
  assert(rows.every((row, index) => row.rankEnd - (index ? rows[index - 1].rankEnd : 0) === row.sameRankScore), `${label} same-score counts do not close`);
  assert(rows[0].rankEnd === config.topRankEnd && rows.at(-1).rankEnd === config.bottomRankEnd, `${label} rank boundaries drifted`);
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) {
    assert(rows.find((row) => row.score === Number(score))?.rankEnd === rankEnd, `${label} checkpoint ${score} drifted`);
  }
}

function compareTables(primary, mirror, config) {
  assert(primary.length === mirror.length, `${config.subjectType} source row counts differ`);
  let comparisons = 0;
  let cellComparisons = 0;
  for (let index = 0; index < primary.length; index += 1) {
    for (const field of ["score", "sameRankScore", "rankEnd"]) {
      assert(primary[index][field] === mirror[index][field], `${config.subjectType} sources differ at row ${index + 1} field ${field}`);
      cellComparisons += 1;
    }
    comparisons += 1;
  }
  return { comparisons, cellComparisons };
}

function makeId(subjectType, score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subjectType}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-chongqing-rank-${subjectType === "历史类" ? "history" : "physics"}-${digest}`;
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
      sourceUrl: EOL_INDEX_URL,
      officialAttachmentUrl: config.officialUrl,
      mirrorUrl: config.mirrorUrl,
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

  const eolIndex = raw["eol-index.html"].toString("utf8");
  const secondIndex = raw["gkzxw-index.html"].toString("utf8");
  for (const url of [OFFICIAL_HISTORY_URL, OFFICIAL_PHYSICS_URL]) {
    assert(eolIndex.includes(url) && secondIndex.includes(url), `Authority table URL is not preserved by both indexes: ${url}`);
  }
  assert(cleanText(eolIndex).includes("重庆市教育考试院"), "EOL index authority attribution is missing");

  const built = SUBJECTS.map((config) => {
    const primary = parseRankTable(raw[`eol-${config.key}.html`].toString("utf8"), config, `EOL ${config.subjectType}`);
    const mirror = parseRankTable(raw[`dxsbb-${config.key}.html`].toString("utf8"), config, `DXSBB ${config.subjectType}`);
    validateRows(primary, config, `EOL ${config.subjectType}`);
    validateRows(mirror, config, `DXSBB ${config.subjectType}`);
    const comparison = compareTables(primary, mirror, config);
    return { config, rows: primary, comparison, rankConversions: buildRankConversions(primary, config) };
  });
  const rankConversions = built.flatMap((item) => item.rankConversions);
  const fullTableComparisons = built.reduce((sum, item) => sum + item.comparison.comparisons, 0);
  const fullCellComparisons = built.reduce((sum, item) => sum + item.comparison.cellComparisons, 0);
  assert(rankConversions.length === 975 && fullTableComparisons === 975 && fullCellComparisons === 2925, "Full-table comparison totals drifted");
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank conversion IDs detected");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "重庆市2025年普通高考历史类、物理类含加分一分一段表",
    publisher: "重庆市教育考试院",
    province: PROVINCE,
    year: YEAR,
    url: EOL_INDEX_URL,
    quality: QUALITY,
    usage: "用于把重庆2025同科类普通高考录取最低分换算为全市累计位次区间；不冒充院校原表直接公布的录取最低位次。",
    parsedRecords: rankConversions.length,
    subjectBreakdown: Object.fromEntries(built.map((item) => [item.config.subjectType, item.rankConversions.length])),
    provenance: {
      authorityAttributed: true,
      officialDirectRetrievalStatus: "tls-unavailable-current-session",
      eolAuthorityIndexUrl: EOL_INDEX_URL,
      officialHistoryUrl: OFFICIAL_HISTORY_URL,
      officialPhysicsUrl: OFFICIAL_PHYSICS_URL,
      secondAuthorityLinkIndexUrl: SECOND_INDEX_URL,
      independentHistoryMirrorUrl: MIRROR_HISTORY_URL,
      independentPhysicsMirrorUrl: MIRROR_PHYSICS_URL,
      verification: "all 975 rows and 2925 score/count/cumulative-rank cells match between the EOL authority-attributed full tables and independent DXSBB full tables",
      fullTableComparisons,
      fullCellComparisons,
      evidenceSha256: Object.fromEntries(Object.entries(EVIDENCE)),
    },
    evidenceBoundary: "The mirrored authority-linked tables publish provincial score-to-cumulative-rank data. They do not publish any institution's native minimum admission rank; linked admission ranks remain score-derived provincial segment ranges.",
  };
  const payload = {
    dataset: "official-chongqing-rank-conversion-2025-v3316-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      expectedRecords: 975,
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      primaryRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.rows.length])),
      mirrorRows: Object.fromEntries(built.map((item) => [item.config.subjectType, item.rankConversions.length])),
      fullTableComparisons,
      fullCellComparisons,
      fullTableDifferences: 0,
      allScoreRowsContiguous: true,
      allCumulativeRanksMonotonic: true,
      allPublishedCountsClose: true,
      authorityLinksPreservedByTwoIndexes: true,
    },
    notes: [
      "历史类652分及以上为1-66名合并档，物理类681分及以上为1-159名合并档；不生成合并档内的伪精确位次。",
      "一分一段表只负责同年同省同科类的分数到省级位次区间换算，院校原表未公布位次时必须明确标注为最低分换算。",
      "仅历史类、物理类且使用普通高考总分口径的整数分记录可建立换算；艺术、体育、综合分、科类不明和特殊路径继续排除。",
      "重庆考试院官方表链接当前会话TLS不可达；两份转载索引均保留相同考试院原始链接，EOL完整表再与独立完整表逐项核对。",
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
    fullTableComparisons,
    fullCellComparisons,
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
