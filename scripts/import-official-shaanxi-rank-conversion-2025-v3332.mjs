#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-shaanxi-rank-conversion-2025-v3332";
const DEFAULT_OUT = "data/admissions/official-shaanxi-rank-conversion-2025-v3332-import.json";
const DATASET = "official-shaanxi-rank-conversion-2025-v3332-import";
const SOURCE_ID = "official-shaanxi-rank-2025-v3332";
const PROVINCE = "陕西";
const YEAR = 2025;
const SCORE_BASIS = "ordinary-gaokao-published-score";
const QUALITY = "official-shaanxi-exam-authority-dual-domain-html-table-control-line-verified-lower-absent-bucket-guard";
const CONTROL_LINE_URL = "https://www.sneea.cn/info/1027/16500.htm";

const EVIDENCE = {
  "shaanxi-control-lines-2025-official.html": {
    bytes: 37343,
    sha256: "6c56e9672ff2f76b6e59144ccab2ea762a8af20d6642d5acb44f0ac0093312f5",
  },
  "shaanxi-rank-history-2025-mirror.html": {
    bytes: 272875,
    sha256: "3e50ef5b0115979aeb6d433fd91b62b0b37bf3138bda4ac6e9cf471451472719",
  },
  "shaanxi-rank-history-2025-official.html": {
    bytes: 266625,
    sha256: "b8ba4c8e0d3f5fb847421af782564573cf7125d8d767731c2fede7853da32f80",
  },
  "shaanxi-rank-physics-2025-mirror.html": {
    bytes: 293452,
    sha256: "eb4568d49a9373fa405b79b1a0bdfa2cf13537bb4ec6a4729a2cca99b7fce7c5",
  },
  "shaanxi-rank-physics-2025-official.html": {
    bytes: 287202,
    sha256: "b7856db31c036f4c5f004c247c27a0d62613f26c13eac4657b15c6786fa2f6b0",
  },
};

const TABLES = [
  {
    key: "history",
    subjectType: "历史类",
    officialFile: "shaanxi-rank-history-2025-official.html",
    mirrorFile: "shaanxi-rank-history-2025-mirror.html",
    officialUrl: "https://www.sneea.cn/info/1027/16503.htm",
    mirrorUrl: "https://www.sneac.com/info/1088/18593.htm",
    titleMarker: "普通历史、艺术历史、体育历史",
    expectedUsableRows: 548,
    expectedRows: 549,
    topScore: 678,
    topCandidates: 6,
    exactFloor: 101,
    exactFloorRankEnd: 73043,
    lowerMaxScore: 100,
    lowerCandidates: 2598,
    finalRankEnd: 75641,
    omittedZeroCandidateScores: 30,
    checkpoints: {
      600: [74, 2134],
      500: [249, 17255],
      414: [315, 42525],
      200: [7, 72820],
      101: [1, 73043],
    },
  },
  {
    key: "physics",
    subjectType: "物理类",
    officialFile: "shaanxi-rank-physics-2025-official.html",
    mirrorFile: "shaanxi-rank-physics-2025-mirror.html",
    officialUrl: "https://www.sneea.cn/info/1027/16502.htm",
    mirrorUrl: "https://www.sneac.com/info/1019/18391.htm",
    titleMarker: "普通物理、艺术物理、体育物理",
    expectedUsableRows: 593,
    expectedRows: 594,
    topScore: 710,
    topCandidates: 11,
    exactFloor: 101,
    exactFloorRankEnd: 169196,
    lowerMaxScore: 100,
    lowerCandidates: 3272,
    finalRankEnd: 172468,
    omittedZeroCandidateScores: 17,
    checkpoints: {
      600: [232, 11374],
      500: [641, 55138],
      394: [602, 128434],
      200: [7, 168847],
      101: [1, 169196],
    },
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
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tableCells(html, label) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  assert(tables.length === 1, `${label} expected one score table, got ${tables.length}`);
  return [...tables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanText(cell[1]).replaceAll(",", "")))
    .filter((cells) => cells.length === 3);
}

function parseTable(html, config, label) {
  const rows = [];
  for (const cells of tableCells(html, label)) {
    const scoreLabel = cells[0];
    const rankEnd = Number(cells[2]);
    if (/^\d+以上$/.test(scoreLabel) && Number.isInteger(rankEnd)) {
      rows.push({
        scoreLabel,
        score: Number(scoreLabel.match(/\d+/)[0]),
        sameRankScore: rankEnd,
        rankEnd,
        scoreRange: { min: Number(scoreLabel.match(/\d+/)[0]), max: 750 },
        topMerged: true,
        rankEstimateUsable: true,
      });
      continue;
    }
    if (/^\d+$/.test(scoreLabel) && cells.slice(1).every((value) => /^\d+$/.test(value))) {
      rows.push({
        scoreLabel,
        score: Number(scoreLabel),
        sameRankScore: Number(cells[1]),
        rankEnd,
        rankEstimateUsable: true,
      });
      continue;
    }
    if (/^\d+分以下及缺考$/.test(scoreLabel) && cells.slice(1).every((value) => /^\d+$/.test(value))) {
      rows.push({
        scoreLabel,
        score: config.lowerMaxScore,
        sameRankScore: Number(cells[1]),
        rankEnd,
        scoreRange: { min: 0, max: config.lowerMaxScore },
        lowerAggregate: true,
        containsAbsentCandidates: true,
        rankEstimateUsable: false,
      });
    }
  }
  return rows.map((row, index) => ({
    ...row,
    rankStart: index === 0 ? 1 : rows[index - 1].rankEnd + 1,
  }));
}

function validateRows(rows, config, label) {
  assert(rows.length === config.expectedRows, `${config.key} ${label} expected ${config.expectedRows} rows, got ${rows.length}`);
  const usable = rows.filter((row) => row.rankEstimateUsable !== false);
  const lower = rows.filter((row) => row.lowerAggregate);
  assert(usable.length === config.expectedUsableRows, `${config.key} ${label} usable row count drifted`);
  assert(lower.length === 1, `${config.key} ${label} lower aggregate count drifted`);
  assert(rows[0].score === config.topScore && rows[0].rankEnd === config.topCandidates && rows[0].topMerged, `${config.key} ${label} top bucket drifted`);
  assert(
    usable.at(-1).score === config.exactFloor && usable.at(-1).rankEnd === config.exactFloorRankEnd,
    `${config.key} ${label} exact published floor drifted`,
  );
  assert(
    lower[0].score === config.lowerMaxScore
      && lower[0].sameRankScore === config.lowerCandidates
      && lower[0].rankEnd === config.finalRankEnd
      && lower[0].containsAbsentCandidates
      && lower[0].rankEstimateUsable === false,
    `${config.key} ${label} lower absent bucket drifted`,
  );
  assert(rows.every((row) => [row.score, row.sameRankScore, row.rankStart, row.rankEnd].every(Number.isInteger)), `${config.key} ${label} contains non-integer values`);
  assert(rows.every((row) => row.rankEnd - row.rankStart + 1 === row.sameRankScore), `${config.key} ${label} rank ranges do not close`);
  assert(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1), `${config.key} ${label} cumulative ranks are discontinuous`);
  assert(rows.every((row, index) => index === 0 || row.score <= rows[index - 1].score), `${config.key} ${label} scores are not descending`);
  const omittedScores = usable.slice(1).reduce((count, row, index) => (
    count + Math.max(0, usable[index].score - row.score - 1)
  ), 0);
  assert(omittedScores === config.omittedZeroCandidateScores, `${config.key} ${label} omitted-score count drifted`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    const row = usable.find((item) => item.score === Number(score));
    assert(row && JSON.stringify([row.sameRankScore, row.rankEnd]) === JSON.stringify(expected), `${config.key} ${label} checkpoint ${score} drifted`);
  }
}

function compareRows(authority, mirror, config) {
  validateRows(authority, config, "official page");
  validateRows(mirror, config, "official mirror");
  let comparedCells = 0;
  for (let index = 0; index < authority.length; index += 1) {
    for (const field of ["scoreLabel", "sameRankScore", "rankEnd"]) {
      assert(authority[index][field] === mirror[index][field], `${config.key} dual-domain difference at row ${index + 1} field ${field}`);
      comparedCells += 1;
    }
  }
  return comparedCells;
}

function stableId(config, row) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${config.subjectType}|${row.scoreLabel}|${row.rankStart}|${row.rankEnd}|${SOURCE_ID}`).slice(0, 18);
  return `${YEAR}-shaanxi-rank-v3332-${config.key}-${digest}`;
}

function buildRankConversions(rows, config) {
  return rows.map((row) => ({
    id: stableId(config, row),
    province: PROVINCE,
    year: YEAR,
    subjectType: config.subjectType,
    dataType: "rank-conversion",
    score: row.score,
    ...(row.scoreRange ? { scoreRange: row.scoreRange } : {}),
    rankStart: row.rankStart,
    rankEnd: row.rankEnd,
    sameRankScore: row.sameRankScore,
    ...(row.topMerged ? { topMerged: true } : {}),
    ...(row.lowerAggregate ? {
      lowerAggregate: true,
      containsAbsentCandidates: true,
      rankEstimateUsable: false,
      aggregateLabel: row.scoreLabel,
    } : {}),
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: null,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: config.officialUrl,
    mirrorUrl: config.mirrorUrl,
  }));
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const raw = {};
  for (const [name, expected] of Object.entries(EVIDENCE)) {
    const file = path.join(rawDir, name);
    assert(fs.existsSync(file), `Missing evidence file: ${file}`);
    raw[name] = fs.readFileSync(file);
    assert(raw[name].byteLength === expected.bytes, `${name} byte count drifted`);
    assert(sha256(raw[name]) === expected.sha256, `${name} hash drifted`);
  }

  const controlLineText = cleanText(raw["shaanxi-control-lines-2025-official.html"].toString("utf8"));
  assert(
    /普通类（\s*历史\s*）\s*414\s*分，\s*普通类（\s*物理\s*）\s*394\s*分/.test(controlLineText),
    "Ordinary bachelor control lines drifted",
  );
  assert(
    /高职（专科）\s*批次[\s\S]{0,40}普通类（\s*历史\s*）\s*200\s*分，\s*普通类（\s*物理\s*）\s*200\s*分/.test(controlLineText),
    "Ordinary vocational control lines drifted",
  );
  assert(controlLineText.includes("发布时间：2025-06-25"), "Control-line publication date drifted");

  const rankConversions = [];
  const subjectAudit = [];
  let comparedCells = 0;
  for (const config of TABLES) {
    const officialHtml = raw[config.officialFile].toString("utf8");
    const mirrorHtml = raw[config.mirrorFile].toString("utf8");
    const officialText = cleanText(officialHtml);
    const mirrorText = cleanText(mirrorHtml);
    assert(officialText.includes(config.titleMarker) && mirrorText.includes(config.titleMarker), `${config.key} title marker drifted`);
    assert(officialText.includes("发布时间：2025-06-25") && mirrorText.includes("发布时间：2025-06-25"), `${config.key} publication date drifted`);
    const officialRows = parseTable(officialHtml, config, "official page");
    const mirrorRows = parseTable(mirrorHtml, config, "official mirror");
    comparedCells += compareRows(officialRows, mirrorRows, config);
    rankConversions.push(...buildRankConversions(officialRows, config));
    subjectAudit.push({
      subjectType: config.subjectType,
      records: config.expectedRows,
      usableRecords: config.expectedUsableRows,
      lowerAggregateRecords: 1,
      displayedScoreRange: { min: config.exactFloor, max: config.topScore },
      usableRankRange: { min: 1, max: config.exactFloorRankEnd },
      fullPublishedRankRange: { min: 1, max: config.finalRankEnd },
      topMergedCandidates: config.topCandidates,
      lowerAggregateCandidates: config.lowerCandidates,
      omittedZeroCandidateScores: config.omittedZeroCandidateScores,
    });
  }

  assert(rankConversions.length === 1143, `Expected 1143 rank rows, got ${rankConversions.length}`);
  assert(rankConversions.filter((row) => row.rankEstimateUsable !== false).length === 1141, "Usable rank row count drifted");
  assert(rankConversions.filter((row) => row.containsAbsentCandidates).length === 2, "Lower absent bucket count drifted");
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank IDs");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "陕西省2025年普通高考一分段统计表（普通历史、普通物理）",
    publisher: "陕西省教育考试院 / 陕西招生考试信息网",
    url: TABLES[0].officialUrl,
    pageUrls: TABLES.map((config) => config.officialUrl),
    mirrorUrls: TABLES.map((config) => config.mirrorUrl),
    relatedUrls: [CONTROL_LINE_URL, "https://gaokao.chsi.com.cn/gkxx/ss/202506/20250623/2293390396.html"],
    quality: QUALITY,
    usage: "陕西2025普通类历史/物理分数、人数和累计人数。双官方域HTML表逐单元一致；同年普通本科最低分仅在历史414分、物理394分及以上自动换算，明确高职专科批在200分及以上换算。两个含缺考人数的低分汇总桶只保留证据，不参与位次估算。",
    province: PROVINCE,
    year: YEAR,
    parsedRecords: rankConversions.length,
    usableRankRecords: 1141,
    excludedEstimateRecords: 2,
    subjects: subjectAudit,
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: null,
    policyBonusStatus: "authority-page-not-explicit",
    automaticAdmissionScoreAlignmentAllowed: true,
    provenance: Object.fromEntries(Object.entries(EVIDENCE).map(([name, item]) => [name, item])),
    comparedDualDomainCells: comparedCells,
    cumulativeArithmeticClosed: true,
    cautions: [
      "官方页面未单独说明政策加分是否计入分数段，系统不擅自标注为含加分或不含加分。",
      "历史678分及以上、物理710分及以上只保存官方合并区间，不生成档内伪精确位次。",
      "两个“101分以下及缺考”汇总桶含无法分离的缺考人数，已标记为不可用于位次估算。",
      "最低分换算位次不是院校录取表直接公布的原生最低位次。",
    ],
  };
  const payload = {
    dataset: DATASET,
    generatedAt,
    province: PROVINCE,
    year: YEAR,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      usableRankRecords: 1141,
      lowerAbsentAggregateRecords: 2,
      comparedDualDomainCells: comparedCells,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      cumulativeArithmeticErrors: 0,
      dualDomainDifferences: 0,
      subjects: subjectAudit,
      controlLines: {
        "历史类": { undergraduate: 414, vocational: 200 },
        "物理类": { undergraduate: 394, vocational: 200 },
      },
      scoreBasis: SCORE_BASIS,
      policyBonusStatus: "authority-page-not-explicit",
    },
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outFile: path.relative(PROJECT_ROOT, outFile),
    rankConversions: rankConversions.length,
    usableRankRecords: 1141,
    lowerAbsentAggregateRecords: 2,
    comparedDualDomainCells: comparedCells,
  }, null, 2));
}

main();
