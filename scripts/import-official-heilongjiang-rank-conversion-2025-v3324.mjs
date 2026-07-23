#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-heilongjiang-rank-conversion-2025-v3324";
const DEFAULT_OUT = "data/admissions/official-heilongjiang-rank-conversion-2025-v3324-import.json";
const SOURCE_ID = "official-heilongjiang-rank-2025-v3324";
const PROVINCE = "黑龙江";
const YEAR = 2025;
const GOVERNMENT_URL = "https://www.hlj.gov.cn/hlj/c107857/202506/c00_31851940.shtml";
const HISTORY_XLS_URL = "https://www.lzk.hl.cn/gkpd/gkxx/202506/W020250624501230928960.xls";
const PHYSICS_XLS_URL = "https://www.lzk.hl.cn/gkpd/gkxx/202506/W020250624501230928278.xls";
const EOL_HISTORY_URL = "https://gaokao.eol.cn/hei_long_jiang/dongtai/202506/t20250624_2676679.shtml";
const EOL_PHYSICS_URL = "https://gaokao.eol.cn/hei_long_jiang/dongtai/202506/t20250624_2676681.shtml";
const QUALITY = "official-heilongjiang-exam-authority-xls-government-release-eol-full-table-cross-verified";

const EVIDENCE = {
  "official-government-page.html": "6ad61a4562b69f94615581e79e8bc5b8a3f6e453c87d5b31b885db5abd11bab0",
  "official-history.xls": "8498d743ecd8ebd38c801af703a77928bebef807cc600586b58c6a4b0062ba13",
  "official-physics.xls": "e273386a4dd85e6d4254d69fc020ee9ad7106a1b5b429cb00df3865a2650d1a9",
  "official-history.csv": "debebf3fa33ebfe1bf78991719d5aefce3bef6321f9476ad9bfdce963edc1792",
  "official-physics.csv": "5222cd17919c59eec265cc3a18c917a95501e6b05d6d678ae9cdfab376442131",
  "eol-history.html": "c0521f009fc584b341a6269b538d00a778750529d0b8377c233ea3af035c1b29",
  "eol-physics.html": "2a45096c928504656820e34ad295e45bdda0326ca44e8b2b063d28baf56aed01",
};

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    xlsUrl: HISTORY_XLS_URL,
    csvFile: "official-history.csv",
    eolFile: "eol-history.html",
    eolUrl: EOL_HISTORY_URL,
    eolTitle: "黑龙江2025年高考一分一段表公布（历史类）",
    topMin: 659,
    topRankEnd: 19,
    rawTopCount: 3,
    floor: 130,
    floorRankEnd: 54707,
    expectedOfficialRows: 529,
    expectedPositiveRows: 528,
    expectedEolRows: 529,
    expectedEolZeroScores: [],
    expectedOmittedZeroScores: [654, 144],
    expectedEolBelowRows: 1,
    expectedAnnotations: [[480, "特招线"], [405, "本科线"], [160, "专科线"]],
    checkpoints: {
      600: [47, 800, 846],
      500: [141, 7968, 8108],
      405: [240, 22738, 22977],
      160: [9, 54569, 54577],
      130: [1, 54707, 54707],
    },
  },
  {
    key: "physics",
    subjectType: "物理类",
    xlsUrl: PHYSICS_XLS_URL,
    csvFile: "official-physics.csv",
    eolFile: "eol-physics.html",
    eolUrl: EOL_PHYSICS_URL,
    eolTitle: "黑龙江2025年高考一分一段表公布（物理类）",
    topMin: 694,
    topRankEnd: 34,
    rawTopCount: 3,
    floor: 130,
    floorRankEnd: 117407,
    expectedOfficialRows: 564,
    expectedPositiveRows: 563,
    expectedEolRows: 565,
    expectedEolZeroScores: [136, 134],
    expectedOmittedZeroScores: [136, 134],
    expectedEolBelowRows: 0,
    expectedAnnotations: [[472, "特招线"], [360, "本科线"], [160, "专科线"]],
    checkpoints: {
      600: [154, 5844, 5997],
      500: [353, 31851, 32203],
      360: [363, 84951, 85313],
      160: [6, 117301, 117306],
      130: [1, 117407, 117407],
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
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      if (quoted && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }
  assert(!quoted, `Unclosed CSV quote: ${line}`);
  cells.push(cell);
  return cells;
}

function parseScoreCell(value) {
  const annotated = cleanText(value).replace(/\s+/g, "");
  if (/^129及以下$/.test(annotated)) return { kind: "below", key: "<=129", max: 129 };
  const annotationMatch = annotated.match(/^(\d+)[（(](特招线|本科线|专科线)[）)]$/);
  if (annotationMatch) {
    return { kind: "score", key: String(Number(annotationMatch[1])), score: Number(annotationMatch[1]), annotation: annotationMatch[2] };
  }
  const rangeMatch = annotated.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    return { kind: "range", key: `${Number(rangeMatch[1])}-${Number(rangeMatch[2])}`, min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }
  const aboveMatch = annotated.match(/^(\d+)及以上$/);
  if (aboveMatch) {
    return { kind: "range", key: `${Number(aboveMatch[1])}-750`, min: Number(aboveMatch[1]), max: 750 };
  }
  if (/^\d+$/.test(annotated)) {
    return { kind: "score", key: String(Number(annotated)), score: Number(annotated) };
  }
  return null;
}

function parseOfficialCsv(csv, config) {
  const publishedRows = csv
    .split(/\r?\n/)
    .map(parseCsvLine)
    .map((cells) => ({ cells, scoreCell: parseScoreCell(cells[0]) }))
    .filter((row) => row.scoreCell);
  assert(publishedRows.length === config.expectedOfficialRows, `${config.subjectType} expected ${config.expectedOfficialRows} official XLS rows, got ${publishedRows.length}`);
  const belowRows = publishedRows.filter((row) => row.scoreCell.kind === "below");
  assert(belowRows.length === 1 && cleanText(belowRows[0].cells[1]) === "略", `${config.subjectType} withheld bottom bucket drifted`);

  let previousRankEnd = 0;
  const positiveRows = publishedRows
    .filter((row) => row.scoreCell.kind !== "below")
    .map((row) => {
      const rawSameRankScore = Number(row.cells[1]);
      const rankEnd = Number(row.cells[2]);
      assert(Number.isInteger(rawSameRankScore) && Number.isInteger(rankEnd), `${config.subjectType} invalid official row ${JSON.stringify(row.cells)}`);
      const sameRankScore = rankEnd - previousRankEnd;
      const parsed = {
        ...row.scoreCell,
        rawSameRankScore,
        sameRankScore,
        rankStart: previousRankEnd + 1,
        rankEnd,
      };
      previousRankEnd = rankEnd;
      return parsed;
    });
  assert(positiveRows.length === config.expectedPositiveRows, `${config.subjectType} expected ${config.expectedPositiveRows} positive rows, got ${positiveRows.length}`);
  assert(positiveRows[0].kind === "range" && positiveRows[0].min === config.topMin && positiveRows[0].max === 750, `${config.subjectType} top bucket drifted`);
  assert(positiveRows[0].sameRankScore === config.topRankEnd && positiveRows[0].rankEnd === config.topRankEnd, `${config.subjectType} top cumulative count drifted`);
  assert(positiveRows.at(-1).score === config.floor && positiveRows.at(-1).rankEnd === config.floorRankEnd, `${config.subjectType} published floor drifted`);
  assert(positiveRows.every((row) => row.sameRankScore > 0 && row.rankStart <= row.rankEnd), `${config.subjectType} official positive rows do not close`);
  assert(positiveRows.every((row, index) => index === 0 || row.rankStart === positiveRows[index - 1].rankEnd + 1), `${config.subjectType} rank intervals are discontinuous`);

  const rawCountDifferences = positiveRows
    .filter((row) => row.rawSameRankScore !== row.sameRankScore)
    .map((row) => ({ key: row.key, rawSameRankScore: row.rawSameRankScore, derivedSameRankScore: row.sameRankScore, rankEnd: row.rankEnd }));
  assert(JSON.stringify(rawCountDifferences) === JSON.stringify([{
    key: `${config.topMin}-750`,
    rawSameRankScore: config.rawTopCount,
    derivedSameRankScore: config.topRankEnd,
    rankEnd: config.topRankEnd,
  }]), `${config.subjectType} raw count-cell anomaly drifted`);

  const numericScores = new Set(positiveRows.filter((row) => row.kind === "score").map((row) => row.score));
  const omittedScores = [];
  for (let score = config.topMin - 1; score >= config.floor; score -= 1) {
    if (!numericScores.has(score)) omittedScores.push(score);
  }
  assert(JSON.stringify(omittedScores) === JSON.stringify(config.expectedOmittedZeroScores), `${config.subjectType} omitted zero-score gaps drifted: ${omittedScores}`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    const row = positiveRows.find((item) => item.score === Number(score));
    assert(row && JSON.stringify([row.sameRankScore, row.rankStart, row.rankEnd]) === JSON.stringify(expected), `${config.subjectType} checkpoint ${score} drifted`);
  }
  return { publishedRows, positiveRows, rawCountDifferences, omittedScores };
}

function parseEolTable(html, config) {
  assert(cleanText(html).includes(config.eolTitle), `${config.subjectType} EOL title is missing`);
  assert(cleanText(html).includes("黑龙江省招生考试院"), `${config.subjectType} EOL authority attribution is missing`);
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((value) => cleanText(value).includes("分段人数") && cleanText(value).includes("累计人数"));
  assert(table, `${config.subjectType} EOL score table is missing`);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanText(cell[1])))
    .map((cells) => ({ cells, scoreCell: parseScoreCell(cells[0]) }))
    .filter((row) => row.scoreCell);
  assert(rows.length === config.expectedEolRows, `${config.subjectType} expected ${config.expectedEolRows} EOL rows, got ${rows.length}`);
  const annotations = rows.filter((row) => row.scoreCell.annotation).map((row) => [row.scoreCell.score, row.scoreCell.annotation]);
  assert(JSON.stringify(annotations) === JSON.stringify(config.expectedAnnotations), `${config.subjectType} control-line annotations drifted`);
  const positiveRows = rows
    .filter((row) => row.scoreCell.kind !== "below" && Number(row.cells[1]) > 0)
    .map((row) => ({ ...row.scoreCell, sameRankScore: Number(row.cells[1]), rankEnd: Number(row.cells[2]) }));
  const zeroScores = rows
    .filter((row) => row.scoreCell.kind === "score" && Number(row.cells[1]) === 0)
    .map((row) => row.scoreCell.score);
  const belowRows = rows.filter((row) => row.scoreCell.kind === "below");
  assert(positiveRows.length === config.expectedPositiveRows, `${config.subjectType} EOL positive-row coverage drifted`);
  assert(JSON.stringify(zeroScores) === JSON.stringify(config.expectedEolZeroScores), `${config.subjectType} EOL zero-score rows drifted`);
  assert(belowRows.length === config.expectedEolBelowRows, `${config.subjectType} EOL withheld-bottom row drifted`);
  return { rows, positiveRows, zeroScores, belowRows };
}

function compareSources(officialRows, eolRows, config) {
  const eolByKey = new Map(eolRows.map((row) => [row.key, row]));
  let cellComparisons = 0;
  for (const official of officialRows) {
    const eol = eolByKey.get(official.key);
    assert(eol, `${config.subjectType} EOL table is missing ${official.key}`);
    assert(eol.key === official.key, `${config.subjectType} score key differs at ${official.key}`);
    assert(eol.sameRankScore === official.sameRankScore, `${config.subjectType} count differs at ${official.key}`);
    assert(eol.rankEnd === official.rankEnd, `${config.subjectType} cumulative rank differs at ${official.key}`);
    cellComparisons += 3;
  }
  assert(eolRows.every((row) => officialRows.some((official) => official.key === row.key)), `${config.subjectType} EOL has unmatched positive rows`);
  return { rowComparisons: officialRows.length, cellComparisons, sourceDifferences: 0 };
}

function makeId(config, score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${config.subjectType}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-heilongjiang-rank-${config.key}-${digest}`;
}

function buildRankConversions(rows, config) {
  return rows.map((row) => {
    const score = row.kind === "range" ? row.min : row.score;
    const record = {
      id: makeId(config, score),
      province: PROVINCE,
      year: YEAR,
      subjectType: config.subjectType,
      dataType: "rank-conversion",
      score,
      rankStart: row.rankStart,
      rankEnd: row.rankEnd,
      sameRankScore: row.sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: QUALITY,
      sourceUrl: config.xlsUrl,
      governmentReleaseUrl: GOVERNMENT_URL,
      structuredTableUrl: config.eolUrl,
      evidenceStage: "ordinary-cultural-score-excluding-policy-bonus-published-floor",
      scoreBasis: "gaokao-cultural-score-excluding-policy-bonus",
      publishedScoreFloor: config.floor,
    };
    if (row.kind === "range") {
      record.scoreRange = { min: row.min, max: row.max };
      record.topWithheldRange = true;
    }
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
    assert(fs.existsSync(file), `Missing evidence file ${file}`);
    raw[name] = fs.readFileSync(file);
    assert(sha256(raw[name]) === expectedHash, `${name} hash drifted`);
  }

  const governmentText = cleanText(raw["official-government-page.html"].toString("utf8"));
  assert(governmentText.includes("2025年黑龙江省普通高考成绩一分段统计表公布"), "Government release title is missing");
  assert(governmentText.includes("黑龙江省招生考试院根据高考成绩（不含照顾政策分）"), "Official no-policy-bonus score basis is missing");
  assert(governmentText.includes("黑龙江省招生考试院 2025年6月24日"), "Official publisher or publication date is missing");
  assert(governmentText.includes(HISTORY_XLS_URL) && governmentText.includes(PHYSICS_XLS_URL), "Official XLS links are missing");

  const built = SUBJECTS.map((config) => {
    const official = parseOfficialCsv(raw[config.csvFile].toString("utf8"), config);
    const eol = parseEolTable(raw[config.eolFile].toString("utf8"), config);
    const comparison = compareSources(official.positiveRows, eol.positiveRows, config);
    return {
      config,
      official,
      eol,
      comparison,
      rankConversions: buildRankConversions(official.positiveRows, config),
    };
  });

  const rankConversions = built.flatMap((item) => item.rankConversions);
  const officialTableRows = built.reduce((sum, item) => sum + item.official.publishedRows.length, 0);
  const eolTableRows = built.reduce((sum, item) => sum + item.eol.rows.length, 0);
  const rowComparisons = built.reduce((sum, item) => sum + item.comparison.rowComparisons, 0);
  const cellComparisons = built.reduce((sum, item) => sum + item.comparison.cellComparisons, 0);
  const rawCountCellAnomalies = built.reduce((sum, item) => sum + item.official.rawCountDifferences.length, 0);
  const omittedZeroScores = Object.fromEntries(built.map((item) => [item.config.subjectType, item.official.omittedScores]));
  assert(rankConversions.length === 1091, `Expected 1091 emitted rank rows, got ${rankConversions.length}`);
  assert(officialTableRows === 1093 && eolTableRows === 1094, "Published table row totals drifted");
  assert(rowComparisons === 1091 && cellComparisons === 3273, "Cross-source comparison totals drifted");
  assert(rawCountCellAnomalies === 2, "Expected two raw top-count cell anomalies");
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate Heilongjiang rank IDs detected");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "黑龙江省2025年普通高考历史类、物理类文化课一分段统计表",
    publisher: "黑龙江省招生考试院",
    province: PROVINCE,
    year: YEAR,
    url: GOVERNMENT_URL,
    historyUrl: HISTORY_XLS_URL,
    physicsUrl: PHYSICS_XLS_URL,
    historyStructuredTableUrl: EOL_HISTORY_URL,
    physicsStructuredTableUrl: EOL_PHYSICS_URL,
    quality: QUALITY,
    usage: "用于把黑龙江2025同科类普通高考整数文化成绩换算为官方不含照顾政策分口径、公开至130分的省级累计位次区间；最低分换算位次不冒充院校投档表原生公布的最低位次。",
    parsedRecords: rankConversions.length,
    officialXlsTableRows: officialTableRows,
    eolTableRows,
    subjectBreakdown: { 历史类: 528, 物理类: 563 },
    publishedScoreFloors: { 历史类: 130, 物理类: 130 },
    scoreBasis: "gaokao-cultural-score-excluding-policy-bonus",
    provenance: {
      governmentReleaseUrl: GOVERNMENT_URL,
      officialXlsUrls: { 历史类: HISTORY_XLS_URL, 物理类: PHYSICS_XLS_URL },
      structuredTableUrls: { 历史类: EOL_HISTORY_URL, 物理类: EOL_PHYSICS_URL },
      officialXlsTableRows: officialTableRows,
      officialPositiveRows: rankConversions.length,
      eolTableRows,
      rowComparisons,
      cellComparisons,
      sourceDifferences: 0,
      rawCountCellAnomalies: built.flatMap((item) => item.official.rawCountDifferences.map((row) => ({ subjectType: item.config.subjectType, ...row }))),
      omittedZeroScores,
      eolExplicitZeroScores: Object.fromEntries(built.map((item) => [item.config.subjectType, item.eol.zeroScores])),
      bottomWithheldBuckets: 2,
      csvConversion: "LibreOffice 26.2.4 structured XLS-to-CSV conversion",
      evidenceSha256: EVIDENCE,
    },
    evidenceBoundary: "The authority states that the tables exclude preferential-policy points. Derived ranges are same-year provincial cultural-score segments, not institution-native minimum admission ranks. If a source admission score includes policy points, the converted range is a no-policy-bonus cultural-score reference and must not be presented as an exact native filing rank.",
    cautions: [
      "官方明确说明一分段统计不含照顾政策分；有政策加分的考生应使用未加分文化成绩查询本表。",
      "历史类659-750分只保存1-19名合并档，物理类694-750分只保存1-34名合并档，不生成档内伪精确名次。",
      "官方XLS两个最高合并档的分段人数原始单元格均为3；本轮依据累计人数19/34、下一行闭合关系和EOL完整表19/34纠正，不改动其他分数档。",
      "历史类654、144分和物理类136、134分为零人数缺口，不生成空位次区间。",
      "官方XLS只公开至130分，129分及以下标注为略；低于130分不向下外推。",
      "艺术、体育综合分、科类不明、非整数分和特殊路径记录不参与普通类文化成绩位次换算。",
      "最低分换算位次不是院校投档表原生公布的最低位次，正式填报前仍须核验当年考试院表、招生计划和院校章程。",
    ],
  };

  const payload = {
    dataset: "official-heilongjiang-rank-conversion-2025-v3324-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      officialXlsTableRows: officialTableRows,
      officialPositiveRows: rankConversions.length,
      eolTableRows,
      rowComparisons,
      cellComparisons,
      sourceDifferences: 0,
      rawCountCellAnomalies,
      zeroScoreGaps: omittedZeroScores,
      bottomWithheldBuckets: 2,
      allDerivedCountsClose: true,
      allCumulativeRanksContinuous: true,
      scoreBasis: "gaokao-cultural-score-excluding-policy-bonus",
      evidenceSha256: EVIDENCE,
    },
    notes: sourceNote.cautions,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outFile),
    rankConversions: rankConversions.length,
    historyRows: rankConversions.filter((row) => row.subjectType === "历史类").length,
    physicsRows: rankConversions.filter((row) => row.subjectType === "物理类").length,
    officialTableRows,
    eolTableRows,
    rowComparisons,
    cellComparisons,
    rawCountCellAnomalies,
    zeroScoreGaps: omittedZeroScores,
  }, null, 2));
}

main();
