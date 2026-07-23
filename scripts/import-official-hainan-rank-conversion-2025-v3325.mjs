#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-hainan-rank-conversion-2025-v3325";
const DEFAULT_OUT = "data/admissions/official-hainan-rank-conversion-2025-v3325-import.json";
const SOURCE_ID = "official-hainan-rank-2025-v3325";
const PROVINCE = "海南";
const YEAR = 2025;
const SUBJECT_TYPE = "综合";
const OFFICIAL_URL = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202506/t20250624_3885371.html";
const MIRROR_URL = "https://thirdpage.thepaper.cn/h5/jrtt/31040129";
const SCORE_BASIS = "gaokao-comprehensive-filing-score-including-policy-bonus";
const QUALITY = "official-hainan-exam-authority-21-page-image-table-government-repost-dual-resolution-ocr-arithmetic-verified";
const PAGE_ROWS = [26, ...Array(19).fill(27), 15];
const TOP_SCORE_MIN = 800;
const TOP_SCORE_MAX = 900;
const TOP_RANK_END = 105;
const PUBLISHED_FLOOR = 246;
const EXPECTED_NUMERIC_ROWS = 554;
const EXPECTED_RANK_ROWS = 555;

const EXPECTED_BUNDLES = {
  officialPage: "1d3042f39f2a4193fa36f89d8a823424e108eba29e7d5eaa4e1233fea26a2b71",
  mirrorPage: "e6bdcf64e1053dbc0e5c54fe739e5327e8e43d594ba7b0fa1b224c11c77b25b8",
  officialImages: "13a3e20e8ab39a50a7156d31afe2a4f99cda3653083fcd1ff0228d151a77f4d7",
  officialGrid: "8c6ac5e205efe4b84c06673f0ddecfb6127e1204ed5685a74c76e4359d78fa41",
  mirrorImages: "4e3e62043a65397a1be8e20dff47f691dd0536c2480a6dd16e3d94f0df5d93a9",
  mirrorGrid: "bb781210b3eb286cd78da13d51f2e34bca4d2c5d1cc4168b0ed105f8b0f292e8",
};

const CUMULATIVE_CORRECTIONS = new Map([
  [785, { value: 171, method: "mirror-ocr", official: null, mirror: 171 }],
  [731, { value: 809, method: "mirror-ocr", official: 608, mirror: 809 }],
  [727, { value: 900, method: "neighbor-count-closure", official: 6, mirror: 6 }],
  [325, { value: 66006, method: "neighbor-count-closure", official: 90099, mirror: 90099 }],
  [307, { value: 66608, method: "neighbor-count-closure", official: 80999, mirror: 80999 }],
  [305, { value: 66661, method: "neighbor-count-closure", official: 19999, mirror: 9999 }],
  [304, { value: 66688, method: "mirror-ocr", official: 88999, mirror: 66688 }],
]);

const CHECKPOINTS = new Map([
  [799, [5, 106, 110]],
  [785, [3, 169, 171]],
  [731, [18, 792, 809]],
  [727, [27, 874, 900]],
  [700, [43, 1721, 1763]],
  [600, [172, 12011, 12182]],
  [500, [268, 37237, 37504]],
  [480, [242, 42848, 43089]],
  [385, [99, 61380, 61478]],
  [325, [38, 65969, 66006]],
  [307, [32, 66577, 66608]],
  [305, [31, 66631, 66661]],
  [304, [27, 66662, 66688]],
  [260, [10, 67302, 67311]],
  [246, [5, 67404, 67408]],
]);

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

function fileEvidence(directory, names) {
  return Object.fromEntries(names.map((name) => [name, sha256(fs.readFileSync(path.join(directory, name)))]));
}

function bundleDigest(directory, names) {
  const lines = names.map((name) => `${name}\0${sha256(fs.readFileSync(path.join(directory, name)))}`);
  return sha256(Buffer.from(lines.join("\n")));
}

function parseGrid(file, expectedRows, expectedWidth, expectedHeight) {
  const grid = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(grid.rowCount === expectedRows, `${path.basename(file)} row count drifted`);
  assert(grid.imageWidth === expectedWidth && grid.imageHeight === expectedHeight, `${path.basename(file)} dimensions drifted`);
  assert(grid.cells?.length === expectedRows * 3, `${path.basename(file)} cell count drifted`);
  const rows = Array.from({ length: expectedRows }, () => ({}));
  for (const cell of grid.cells) {
    assert(Number.isInteger(cell.row) && cell.row >= 0 && cell.row < expectedRows, `${path.basename(file)} invalid row`);
    assert(["score", "people", "cumulative"].includes(cell.col), `${path.basename(file)} invalid column`);
    assert(rows[cell.row][cell.col] === undefined, `${path.basename(file)} duplicate ${cell.row}/${cell.col}`);
    rows[cell.row][cell.col] = cell.text === "" ? null : Number(cell.text);
  }
  assert(rows.every((row) => Object.keys(row).length === 3), `${path.basename(file)} incomplete rows`);
  return rows;
}

function imageNames(officialHtml, mirrorHtml) {
  const official = [...officialHtml.matchAll(/src="\.\/(W020250625[^" ]+\.jpg)"/g)].map((match) => match[1]);
  const mirror = [...mirrorHtml.matchAll(/https?:[^" ]+\/([^\/" ]+\.jpg)/g)].map((match) => match[1]);
  assert(official.length === 21 && new Set(official).size === 21, "Official article image inventory drifted");
  assert(mirror.length === 21 && new Set(mirror).size === 21, "Mirror article image inventory drifted");
  return { official, mirror };
}

function loadAlignedRows(rawDir, officialNames, mirrorNames) {
  const officialDir = path.join(rawDir, "official");
  const mirrorDir = path.join(rawDir, "thepaper");
  const rows = [];
  for (let pageIndex = 0; pageIndex < PAGE_ROWS.length; pageIndex += 1) {
    const rowCount = PAGE_ROWS[pageIndex];
    const officialGrid = officialNames[pageIndex].replace(/\.jpg$/, ".grid.json");
    const mirrorGrid = mirrorNames[pageIndex].replace(/\.jpg$/, ".mirror-grid.json");
    const official = parseGrid(path.join(officialDir, officialGrid), rowCount, 4761, 6733);
    const mirror = parseGrid(path.join(mirrorDir, mirrorGrid), rowCount, 1080, 1527);
    for (let pageRow = 0; pageRow < rowCount; pageRow += 1) {
      const score = 799 - rows.length;
      const correction = CUMULATIVE_CORRECTIONS.get(score);
      rows.push({
        page: pageIndex + 1,
        pageRow: pageRow + 1,
        score,
        official: official[pageRow],
        mirror: mirror[pageRow],
        rankEnd: correction?.value ?? official[pageRow].cumulative,
        correction: correction || null,
      });
    }
  }
  assert(rows.length === EXPECTED_NUMERIC_ROWS, `Expected ${EXPECTED_NUMERIC_ROWS} numeric rows, got ${rows.length}`);
  assert(rows[0].score === 799 && rows.at(-1).score === PUBLISHED_FLOOR, "Published score range drifted");
  return rows;
}

function validateRows(rows) {
  const rawDifferences = rows.filter((row) => (
    row.official.score !== row.mirror.score
    || row.official.people !== row.mirror.people
    || row.official.cumulative !== row.mirror.cumulative
  ));
  const cumulativeDifferences = rows.filter((row) => row.official.cumulative !== row.mirror.cumulative);
  const scoreDifferences = rows.filter((row) => row.official.score !== row.mirror.score);
  const peopleDifferences = rows.filter((row) => row.official.people !== row.mirror.people);
  assert(rawDifferences.length === 38, `Expected 38 raw OCR difference rows, got ${rawDifferences.length}`);
  assert(cumulativeDifferences.length === 5, `Expected 5 raw cumulative differences, got ${cumulativeDifferences.length}`);
  assert(scoreDifferences.length === 5, `Expected 5 raw score differences, got ${scoreDifferences.length}`);
  assert(peopleDifferences.length === 29, `Expected 29 raw people differences, got ${peopleDifferences.length}`);
  assert(rows.filter((row) => row.official.score === row.score).length === 543, "Official OCR expected-score match count drifted");
  assert(rows.filter((row) => row.mirror.score === row.score).length === 544, "Mirror OCR expected-score match count drifted");

  const correctionAudit = [];
  const peopleAudit = {
    bothMatch: 0,
    officialOnly: 0,
    mirrorOnly: 0,
    bothBlank: 0,
    oneBlankNoMatch: 0,
    bothWrong: 0,
  };
  let previousRankEnd = TOP_RANK_END;
  for (const [index, row] of rows.entries()) {
    assert(row.score === 799 - index, `Score continuity drifted at row ${index}`);
    assert(Number.isInteger(row.rankEnd) && row.rankEnd > previousRankEnd, `Cumulative rank drifted at score ${row.score}`);
    const sameRankScore = row.rankEnd - previousRankEnd;
    assert(sameRankScore > 0 && sameRankScore <= 500, `Derived count drifted at score ${row.score}: ${sameRankScore}`);
    row.sameRankScore = sameRankScore;
    row.rankStart = previousRankEnd + 1;

    const officialMatch = row.official.people === sameRankScore;
    const mirrorMatch = row.mirror.people === sameRankScore;
    if (officialMatch && mirrorMatch) peopleAudit.bothMatch += 1;
    else if (officialMatch) peopleAudit.officialOnly += 1;
    else if (mirrorMatch) peopleAudit.mirrorOnly += 1;
    else if (row.official.people === null && row.mirror.people === null) peopleAudit.bothBlank += 1;
    else if (row.official.people === null || row.mirror.people === null) peopleAudit.oneBlankNoMatch += 1;
    else peopleAudit.bothWrong += 1;

    if (row.correction) {
      assert(row.official.cumulative === row.correction.official, `Official correction evidence drifted at ${row.score}`);
      assert(row.mirror.cumulative === row.correction.mirror, `Mirror correction evidence drifted at ${row.score}`);
      correctionAudit.push({
        score: row.score,
        page: row.page,
        pageRow: row.pageRow,
        officialOcr: row.official.cumulative,
        mirrorOcr: row.mirror.cumulative,
        resolvedRankEnd: row.rankEnd,
        method: row.correction.method,
        derivedSameRankScore: sameRankScore,
      });
    }
    previousRankEnd = row.rankEnd;
  }
  assert(previousRankEnd === 67408, `Published floor cumulative rank drifted: ${previousRankEnd}`);
  assert(JSON.stringify(peopleAudit) === JSON.stringify({
    bothMatch: 480,
    officialOnly: 20,
    mirrorOnly: 8,
    bothBlank: 43,
    oneBlankNoMatch: 1,
    bothWrong: 2,
  }), `People-cell audit drifted: ${JSON.stringify(peopleAudit)}`);
  assert(correctionAudit.length === CUMULATIVE_CORRECTIONS.size, "Cumulative correction audit drifted");
  for (const [score, expected] of CHECKPOINTS) {
    const row = rows.find((item) => item.score === score);
    assert(row && JSON.stringify([row.sameRankScore, row.rankStart, row.rankEnd]) === JSON.stringify(expected), `Checkpoint ${score} drifted`);
  }
  return {
    rawDifferenceRows: rawDifferences.length,
    rawCumulativeDifferences: cumulativeDifferences.length,
    rawScoreDifferences: scoreDifferences.length,
    rawPeopleDifferences: peopleDifferences.length,
    directCumulativeMatches: rows.length - cumulativeDifferences.length,
    correctionAudit,
    peopleAudit,
  };
}

function makeId(score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${SUBJECT_TYPE}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-hainan-rank-comprehensive-${digest}`;
}

function buildRankConversions(rows) {
  const top = {
    id: makeId(TOP_SCORE_MIN),
    province: PROVINCE,
    year: YEAR,
    subjectType: SUBJECT_TYPE,
    dataType: "rank-conversion",
    score: TOP_SCORE_MIN,
    scoreRange: { min: TOP_SCORE_MIN, max: TOP_SCORE_MAX },
    rankStart: 1,
    rankEnd: TOP_RANK_END,
    sameRankScore: TOP_RANK_END,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: OFFICIAL_URL,
    structuredTableUrl: MIRROR_URL,
    evidenceStage: "ordinary-comprehensive-filing-score-including-policy-bonus-published-floor",
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    publishedScoreFloor: PUBLISHED_FLOOR,
    topWithheldRange: true,
  };
  return [
    top,
    ...rows.map((row) => ({
      id: makeId(row.score),
      province: PROVINCE,
      year: YEAR,
      subjectType: SUBJECT_TYPE,
      dataType: "rank-conversion",
      score: row.score,
      rankStart: row.rankStart,
      rankEnd: row.rankEnd,
      sameRankScore: row.sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: QUALITY,
      sourceUrl: OFFICIAL_URL,
      structuredTableUrl: MIRROR_URL,
      evidenceStage: "ordinary-comprehensive-filing-score-including-policy-bonus-published-floor",
      scoreBasis: SCORE_BASIS,
      rankPolicyBonusIncluded: true,
      publishedScoreFloor: PUBLISHED_FLOOR,
    })),
  ];
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const officialDir = path.join(rawDir, "official");
  const mirrorDir = path.join(rawDir, "thepaper");
  const officialHtml = fs.readFileSync(path.join(officialDir, "page.html"), "utf8");
  const mirrorHtml = fs.readFileSync(path.join(mirrorDir, "page.html"), "utf8");
  const officialText = cleanText(officialHtml);
  const mirrorText = cleanText(mirrorHtml);
  assert(officialText.includes("2025年海南省普通高考普通类考生成绩分布表（投档成绩为考生高考成绩综合分、照顾加分之和）"), "Official title or score basis is missing");
  assert(officialText.includes("发布日期：2025-06-25") && officialText.includes("来源： 省考试局"), "Official publication metadata is missing");
  assert(mirrorText.includes("2025年海南省普通高考普通类考生成绩分布表（投档成绩为考生高考成绩综合分、照顾加分之和）"), "Mirror title or score basis is missing");
  assert(mirrorText.includes("来源：海南省考试局"), "Mirror authority attribution is missing");

  const names = imageNames(officialHtml, mirrorHtml);
  const officialGridNames = names.official.map((name) => name.replace(/\.jpg$/, ".grid.json"));
  const mirrorGridNames = names.mirror.map((name) => name.replace(/\.jpg$/, ".mirror-grid.json"));
  const bundles = {
    officialPage: sha256(Buffer.from(officialHtml)),
    mirrorPage: sha256(Buffer.from(mirrorHtml)),
    officialImages: bundleDigest(officialDir, names.official),
    officialGrid: bundleDigest(officialDir, officialGridNames),
    mirrorImages: bundleDigest(mirrorDir, names.mirror),
    mirrorGrid: bundleDigest(mirrorDir, mirrorGridNames),
  };
  assert(JSON.stringify(bundles) === JSON.stringify(EXPECTED_BUNDLES), `Evidence bundle hashes drifted: ${JSON.stringify(bundles)}`);

  const rows = loadAlignedRows(rawDir, names.official, names.mirror);
  const comparison = validateRows(rows);
  const rankConversions = buildRankConversions(rows);
  assert(rankConversions.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate Hainan rank IDs detected");
  assert(rankConversions.every((row, index) => index === 0 || row.rankStart === rankConversions[index - 1].rankEnd + 1), "Rank intervals are discontinuous");

  const imageEvidence = {
    official: fileEvidence(officialDir, names.official),
    mirror: fileEvidence(mirrorDir, names.mirror),
  };
  const generatedAt = new Date().toISOString();
  const cautions = [
    "海南2025普通类采用综合投档成绩口径，本表全体考生列包含高考成绩综合分与照顾加分；只与同口径最低分记录对齐。",
    "800分及以上仅保存1-105名合并档，不生成档内伪精确位次。",
    "官方公开至246分；低于246分不向下外推。",
    "本轮使用全体考生人数/累计列，不把物理、化学、生物、政治、历史、地理选考人数列当作独立招生科类位次。",
    "历史类、物理类标签、艺术体育综合分、科类不明、非整数分和特殊路径记录不参与海南综合普通类自动换算。",
    "最低分换算位次不是院校投档表原生公布的最低位次，正式填报前仍须核验当年考试院表、招生计划和院校章程。",
  ];
  const sourceNote = {
    id: SOURCE_ID,
    title: "海南省2025年普通高考普通类考生成绩分布表",
    publisher: "海南省考试局",
    province: PROVINCE,
    year: YEAR,
    url: OFFICIAL_URL,
    structuredTableUrl: MIRROR_URL,
    quality: QUALITY,
    usage: "用于把海南2025综合普通类整数投档成绩换算为官方含照顾加分口径、公开至246分的全体考生省级累计位次区间；最低分换算位次不冒充院校投档表原生公布的最低位次。",
    parsedRecords: rankConversions.length,
    officialImagePages: names.official.length,
    mirrorImagePages: names.mirror.length,
    numericScoreRows: rows.length,
    subjectBreakdown: { 综合: rankConversions.length },
    publishedScoreFloor: PUBLISHED_FLOOR,
    publishedScoreCeiling: TOP_SCORE_MAX,
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    provenance: {
      officialUrl: OFFICIAL_URL,
      mirrorUrl: MIRROR_URL,
      officialImagePages: names.official.length,
      mirrorImagePages: names.mirror.length,
      numericScoreRows: rows.length,
      rankRows: rankConversions.length,
      directCumulativeMatches: comparison.directCumulativeMatches,
      rawDifferenceRows: comparison.rawDifferenceRows,
      rawCumulativeDifferences: comparison.rawCumulativeDifferences,
      rawScoreDifferences: comparison.rawScoreDifferences,
      rawPeopleDifferences: comparison.rawPeopleDifferences,
      cumulativeCorrections: comparison.correctionAudit,
      peopleCellAudit: comparison.peopleAudit,
      evidenceBundleSha256: bundles,
      imageEvidenceSha256: imageEvidence,
      ocrMethod: "Apple Vision fixed-grid OCR over official 4761x6733 images and independent 1080x1527 government repost images",
    },
    evidenceBoundary: "The authority defines filing score as the sum of the candidate's comprehensive Gaokao score and preferential-care points. Derived ranges are same-year provincial all-candidate score segments, not institution-native minimum admission ranks and not history/physics subject-group ranks.",
    cautions,
  };
  const payload = {
    dataset: "official-hainan-rank-conversion-2025-v3325-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      officialImagePages: names.official.length,
      mirrorImagePages: names.mirror.length,
      numericScoreRows: rows.length,
      directCumulativeMatches: comparison.directCumulativeMatches,
      rawDifferenceRows: comparison.rawDifferenceRows,
      rawCumulativeDifferences: comparison.rawCumulativeDifferences,
      cumulativeCorrections: comparison.correctionAudit.length,
      arithmeticCorrections: comparison.correctionAudit.filter((row) => row.method === "neighbor-count-closure").length,
      mirrorCorrections: comparison.correctionAudit.filter((row) => row.method === "mirror-ocr").length,
      allDerivedCountsClose: true,
      allCumulativeRanksContinuous: true,
      topMergedCandidates: TOP_RANK_END,
      publishedFloorRankEnd: rows.at(-1).rankEnd,
      scoreBasis: SCORE_BASIS,
      rankPolicyBonusIncluded: true,
      evidenceBundleSha256: bundles,
    },
    notes: cautions,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outFile),
    rankConversions: rankConversions.length,
    numericScoreRows: rows.length,
    officialImagePages: names.official.length,
    mirrorImagePages: names.mirror.length,
    directCumulativeMatches: comparison.directCumulativeMatches,
    cumulativeCorrections: comparison.correctionAudit.length,
    publishedFloorRankEnd: rows.at(-1).rankEnd,
  }, null, 2));
}

main();
