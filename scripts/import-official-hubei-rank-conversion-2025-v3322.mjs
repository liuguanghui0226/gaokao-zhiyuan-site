#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-hubei-rank-conversion-2025-v3322";
const DEFAULT_OUT = "data/admissions/official-hubei-rank-conversion-2025-v3322-import.json";
const SOURCE_ID = "official-hubei-rank-2025-v3322";
const PROVINCE = "湖北";
const YEAR = 2025;
const QUALITY = "official-hubei-education-department-pdf-exam-authority-images-cross-verified";
const HBEA_URL = "https://www.hbea.edu.cn/html/2025-06/15292.html";
const EDUCATION_URL = "https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202506/t20250625_5706259.shtml";
const HISTORY_PDF_URL = "https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202506/P020250625730351260572.pdf";
const PHYSICS_PDF_URL = "https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202506/P020250625730351882018.pdf";

const EVIDENCE = {
  "hbea-index.html": "25b48fd6f4345849e3be1d6df255641e996af825f6c9a2d313e8816994e2acf6",
  "hubei-education-page.html": "0afc24d6e573c3a75c9ccd52daea4fce65776d0405f11e4734f11cf610636afc",
  "hubei-education-history.pdf": "2ea1149d48c317103c6088f313d8cecdf095c4c08c570fce6674b3bbff8e92b8",
  "hubei-education-physics.pdf": "d76c5bf632b072e6630cdd8a3f7ae1dad8180d2c7bab94022cdf9cf144789833",
  "hubei-education-history-raw.txt": "10aea0f81b21e691b1edf608904cceb86e61c05cfc9c9130a8d2d422790bceee",
  "hubei-education-physics-raw.txt": "04c0452ec1e98e73592cbcfabd9d30989edc2dd37de81886d1ff39aab672690e",
  "hbea-021.jpg": "7a22c3842d1c2206d52d04a88a0402efd82c9e2ae342660dda3eaba3385f767a",
  "hbea-022.jpg": "42f72a787eb7a797d4419ff78c9436cdad93f346e2252e381f26be166bc27abc",
  "hbea-023.jpg": "5f9393efd8f6757371fb5455da56e3e5022aba1485344871b681d16b8f7fa260",
  "hbea-024.jpg": "4290441f45acee278d13e8486d42931076ae9be4427e78c19d0bf98d213786e6",
  "hbea-025.jpg": "ba09aa163783c6552f65ae71b54043f2c81f227a5e48aca8450908f8a4dde357",
  "hbea-026.jpg": "0fc76180e92f5e89fd023af463fc787125327e4ec388446c00937cffbe97283b",
  "hbea-031.jpg": "72eb8f32e372f9d28fc5e737f785ad9b17b7d81bbcd99b21a6cfb2c78594e171",
  "hbea-032.jpg": "dc3af939f73e43ec742e7de85acafa9a64886df70b2c34629856eb5c155b09be",
  "hbea-033.jpg": "f371fb21804eb03b73047e8687791914f6f3bf962e366274f680fb6509ac3e88",
  "hbea-034.jpg": "f8bbf7134da4468e164398fd455e7e447303ff3bb2ea879d4eb26cca229e3283",
  "hbea-035.jpg": "af9edd07d63196c346cb091a832a1df0d0957ac151688c70a96073b86302c7ae",
  "hbea-036.jpg": "664f5c0fd7d93ab33928a1f2c873de0866c08de5792e6d99426438e31a13d2fc",
};

const SUBJECTS = [
  {
    key: "history",
    prefix: "03",
    subjectType: "历史类",
    textFile: "hubei-education-history-raw.txt",
    pdfFile: "hubei-education-history.pdf",
    pdfUrl: HISTORY_PDF_URL,
    expectedRows: 649,
    topBucketScore: 674,
    topBucketEnd: 15,
    first: [673, 2, 17, 16],
    last: [0, 2758, 141436, 138679],
    checkpoints: {
      600: [126, 3166, 3041],
      536: [266, 17551, 17286],
      442: [405, 50955, 50551],
      200: [64, 136356, 136293],
      0: [2758, 141436, 138679],
    },
    pagePanelRows: [[39, 39, 39], [42, 42, 42], [42, 42, 42], [42, 42, 42], [42, 42, 42], [10, 10, 8]],
    expectedOcr: { score: 629, people: 514, cumulative: 641, all: 504, scoreCumulative: 622 },
  },
  {
    key: "physics",
    prefix: "02",
    subjectType: "物理类",
    textFile: "hubei-education-physics-raw.txt",
    pdfFile: "hubei-education-physics.pdf",
    pdfUrl: PHYSICS_PDF_URL,
    expectedRows: 662,
    topBucketScore: 692,
    topBucketEnd: 22,
    first: [691, 3, 25, 23],
    last: [0, 1698, 249802, 248105],
    checkpoints: {
      600: [426, 14274, 13849],
      516: [904, 72834, 71931],
      426: [777, 148657, 147881],
      200: [64, 246274, 246211],
      0: [1698, 249802, 248105],
    },
    pagePanelRows: [[39, 39, 39], [42, 42, 42], [42, 42, 42], [42, 42, 42], [42, 42, 42], [14, 14, 13]],
    expectedOcr: { score: 647, people: 532, cumulative: 648, all: 520, scoreCumulative: 638 },
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

function parsePdfText(bytes) {
  return bytes.toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(\d{1,3})\s+(\d+)\s+(\d+)$/))
    .filter(Boolean)
    .map((match) => ({
      score: Number(match[1]),
      sameRankScore: Number(match[2]),
      rankEnd: Number(match[3]),
      rankStart: Number(match[3]) - Number(match[2]) + 1,
    }));
}

function validateRows(rows, config) {
  assert(rows.length === config.expectedRows, `${config.key} expected ${config.expectedRows} rows, got ${rows.length}`);
  assert(JSON.stringify(Object.values(rows[0])) === JSON.stringify(config.first), `${config.key} first row drifted`);
  assert(JSON.stringify(Object.values(rows.at(-1))) === JSON.stringify(config.last), `${config.key} last row drifted`);
  assert(rows.every((row) => [row.score, row.sameRankScore, row.rankStart, row.rankEnd].every(Number.isInteger)), `${config.key} contains non-integers`);
  assert(rows.every((row, index) => index === 0 || row.score < rows[index - 1].score), `${config.key} scores are not strictly descending`);
  assert(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1), `${config.key} cumulative ranks are discontinuous`);
  assert(rows.every((row) => row.rankEnd - row.rankStart + 1 === row.sameRankScore), `${config.key} same-score counts do not close`);
  assert(rows[0].rankStart === config.topBucketEnd + 1, `${config.key} withheld top bucket does not meet the first published row`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    const row = rows.find((item) => item.score === Number(score));
    assert(row && JSON.stringify([row.sameRankScore, row.rankEnd, row.rankStart]) === JSON.stringify(expected), `${config.key} checkpoint ${score} drifted`);
  }
}

function readOcrRows(rawDir, config) {
  const panels = ["left", "middle", "right"];
  const rows = [];
  for (let page = 1; page <= 6; page += 1) {
    for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
      const panel = panels[panelIndex];
      const file = path.join(rawDir, `hbea-${config.prefix}${page}-${panel}-grid.json`);
      assert(fs.existsSync(file), `Missing OCR evidence ${file}`);
      const payload = JSON.parse(fs.readFileSync(file, "utf8"));
      const expectedRows = config.pagePanelRows[page - 1][panelIndex];
      assert(payload.imageWidth === 1080 && payload.imageHeight === 1527, `${path.basename(file)} dimensions drifted`);
      assert(payload.rowCount === expectedRows, `${path.basename(file)} row count drifted`);
      for (let row = 0; row < expectedRows; row += 1) {
        const cells = Object.fromEntries(payload.cells.filter((cell) => cell.row === row).map((cell) => [cell.col, cell]));
        assert(["score", "people", "cumulative"].every((field) => cells[field]), `${path.basename(file)} row ${row} is incomplete`);
        rows.push(cells);
      }
    }
  }
  assert(rows.length === config.expectedRows, `${config.key} OCR rows drifted`);
  return rows;
}

function compareOcr(rows, ocrRows, config) {
  const matches = { score: 0, people: 0, cumulative: 0, all: 0, scoreCumulative: 0 };
  for (let index = 0; index < rows.length; index += 1) {
    const expected = rows[index];
    const ocr = ocrRows[index];
    const values = {
      score: ocr.score.text === "" ? NaN : Number(ocr.score.text),
      people: ocr.people.text === "" ? NaN : Number(ocr.people.text),
      cumulative: ocr.cumulative.text === "" ? NaN : Number(ocr.cumulative.text),
    };
    const exact = {
      score: values.score === expected.score,
      people: values.people === expected.sameRankScore,
      cumulative: values.cumulative === expected.rankEnd,
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
  return `${YEAR}-hubei-rank-${config.key}-${digest}`;
}

function buildRankConversions(rows, config) {
  const shared = {
    province: PROVINCE,
    year: YEAR,
    subjectType: config.subjectType,
    dataType: "rank-conversion",
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: HBEA_URL,
    educationDepartmentUrl: EDUCATION_URL,
    officialPdfUrl: config.pdfUrl,
    evidenceStage: "ordinary-full-cohort-including-policy-bonus",
    publishedScoreFloor: 0,
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

  const hbeaHtml = fs.readFileSync(path.join(rawDir, "hbea-index.html"), "utf8");
  assert(hbeaHtml.includes("湖北省2025年普通高考总分一分一段统计表") && hbeaHtml.includes("来源：湖北省招办"), "HBEA title or publisher attribution is missing");
  for (const fileNumber of ["021", "022", "023", "024", "025", "026", "031", "032", "033", "034", "035", "036"]) {
    assert(hbeaHtml.includes(`/files/2025-06/${fileNumber}.jpg`), `HBEA image ${fileNumber} link is missing`);
    const bytes = fs.readFileSync(path.join(rawDir, `hbea-${fileNumber}.jpg`));
    assert(JSON.stringify(jpegDimensions(bytes)) === JSON.stringify({ width: 1080, height: 1527 }), `HBEA image ${fileNumber} dimensions drifted`);
  }

  const educationHtml = fs.readFileSync(path.join(rawDir, "hubei-education-page.html"), "utf8");
  assert(educationHtml.includes("P020250625730351260572.pdf") && educationHtml.includes("普通高考总分一分一段统计表（首选历史）"), "Education Department history attachment is missing");
  assert(educationHtml.includes("P020250625730351882018.pdf") && educationHtml.includes("普通高考总分一分一段统计表（首选物理）"), "Education Department physics attachment is missing");

  let pdfRows = 0;
  const ocrMatches = { score: 0, people: 0, cumulative: 0, all: 0, scoreCumulative: 0 };
  const built = SUBJECTS.map((config) => {
    const rows = parsePdfText(fs.readFileSync(path.join(rawDir, config.textFile)));
    validateRows(rows, config);
    const matches = compareOcr(rows, readOcrRows(rawDir, config), config);
    pdfRows += rows.length;
    for (const field of Object.keys(ocrMatches)) ocrMatches[field] += matches[field];
    return { config, rows, rankConversions: buildRankConversions(rows, config) };
  });

  assert(pdfRows === 1311, `Expected 1311 official PDF rows, got ${pdfRows}`);
  assert(JSON.stringify(ocrMatches) === JSON.stringify({ score: 1276, people: 1046, cumulative: 1289, all: 1024, scoreCumulative: 1260 }), "Combined official-image OCR totals drifted");
  const rankConversions = built.flatMap((item) => item.rankConversions);
  assert(rankConversions.length === 1313, `Expected 1313 emitted rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate Hubei rank conversion IDs detected");
  assert(rankConversions.filter((row) => row.topWithheldRange).length === 2, "Hubei top bucket count drifted");

  for (const file of fs.readdirSync(rawDir).filter((name) => name.endsWith("-grid.json"))) {
    evidenceHashes[file] = sha256(fs.readFileSync(path.join(rawDir, file)));
  }

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "湖北省2025年普通高考总分一分一段统计表（普通类首选历史、首选物理）",
    publisher: "湖北省招办（湖北省教育考试院、湖北省教育厅发布）",
    province: PROVINCE,
    year: YEAR,
    url: HBEA_URL,
    educationDepartmentUrl: EDUCATION_URL,
    historyPdfUrl: HISTORY_PDF_URL,
    physicsPdfUrl: PHYSICS_PDF_URL,
    quality: QUALITY,
    usage: "用于把湖北2025同科类普通高考整数最低分或考生分数换算为含政策性加分的全省累计位次区间；最低分换算位次不冒充院校投档表原生公布的最低位次。",
    parsedRecords: rankConversions.length,
    publishedRows: pdfRows,
    subjectBreakdown: { 历史类: 650, 物理类: 663 },
    publishedScoreFloors: { 历史类: 0, 物理类: 0 },
    provenance: {
      hbeaUrl: HBEA_URL,
      educationDepartmentUrl: EDUCATION_URL,
      officialPdfUrls: { 历史类: HISTORY_PDF_URL, 物理类: PHYSICS_PDF_URL },
      officialPdfRows: pdfRows,
      officialPdfCellsValidated: pdfRows * 3,
      allCountsClose: true,
      allCumulativeRanksContinuous: true,
      hbeaOfficialImages: 12,
      hbeaImageDimensions: { width: 1080, height: 1527 },
      imageOcrRowsCompared: pdfRows,
      imageOcrScoreMatches: ocrMatches.score,
      imageOcrPeopleMatches: ocrMatches.people,
      imageOcrCumulativeMatches: ocrMatches.cumulative,
      imageOcrAllCellMatches: ocrMatches.all,
      imageOcrScoreCumulativeMatches: ocrMatches.scoreCumulative,
      evidenceSha256: evidenceHashes,
    },
    cautions: [
      "表中累计人数含政策性加分，只能用于湖北2025同首选科目的普通类分数位次换算。",
      "最高分段按官方首个公开分数档之前的累计人数合并为区间，不生成区间内伪精确名次。",
      "艺术类、体育类、技能高考、综合评价及其他特殊路径不与普通类一分一段表混用。",
      "最低分换算位次不是院校投档表原生公布的最低位次，正式填报前仍须核验当年考试院表、招生计划和院校章程。",
    ],
  };

  const payload = {
    dataset: "official-hubei-rank-conversion-2025-v3322-import",
    generatedAt,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      officialPdfRows: pdfRows,
      officialPdfCellsValidated: pdfRows * 3,
      topBuckets: 2,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      allCountsClose: true,
      allCumulativeRanksContinuous: true,
      officialImages: 12,
      imageOcrRowsCompared: pdfRows,
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
    officialPdfRows: pdfRows,
    officialPdfCellsValidated: pdfRows * 3,
    imageOcrMatches: ocrMatches,
  }, null, 2));
}

main();
