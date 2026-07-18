#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-jiangsu-rank-conversion-2025-v3319";
const DEFAULT_OUT = `${DEFAULT_RAW}/jiangsu-first-stage-cell-ocr.json`;
const PAGE_HEIGHT = 2244;
const CROP_TOP = 200;
const CROP_HEIGHT = 1950;
const PANEL_OFFSET_X = 510;
const FIRST_ROW_TOP = 44;
const ROW_PITCH = 48;

const CELL_CROPS = {
  score: { x: 80, width: 140 },
  sameRankScore: { x: 235, width: 100 },
  rankEnd: { x: 350, width: 140 },
};

const SOURCES = [
  { key: "official", history: "jseea-history.jpg", physics: "jseea-physics.jpg" },
  { key: "mirror", history: "dxsbb-history.png", physics: "dxsbb-physics.png" },
];

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    topRangeMax: 750,
    panels: [
      { page: 0, panel: 0, firstScore: 658, rowCount: 40 },
      { page: 0, panel: 1, firstScore: 618, rowCount: 40 },
      { page: 0, panel: 2, firstScore: 578, rowCount: 40 },
      { page: 1, panel: 0, firstScore: 538, rowCount: 40 },
      { page: 1, panel: 1, firstScore: 498, rowCount: 17 },
    ],
    expectedRows: 177,
    bottomScore: 482,
    bottomRankEnd: 56398,
    checkpoints: { 658: 109, 650: 250, 640: 626, 630: 1250, 620: 2253, 610: 3741, 600: 5796, 580: 11515, 560: 19224, 540: 28408, 520: 38007, 500: 47639, 482: 56398 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    topRangeMax: 750,
    panels: [
      { page: 0, panel: 0, firstScore: 683, rowCount: 40 },
      { page: 0, panel: 1, firstScore: 643, rowCount: 40 },
      { page: 0, panel: 2, firstScore: 603, rowCount: 40 },
      { page: 1, panel: 0, firstScore: 563, rowCount: 40 },
      { page: 1, panel: 1, firstScore: 523, rowCount: 40 },
      { page: 1, panel: 2, firstScore: 483, rowCount: 21 },
    ],
    expectedRows: 221,
    bottomScore: 463,
    bottomRankEnd: 205975,
    checkpoints: { 683: 126, 680: 196, 670: 728, 660: 2027, 650: 4363, 640: 7928, 630: 12829, 620: 19004, 610: 26330, 600: 34888, 590: 44618, 580: 55261, 570: 67133, 560: 79711, 550: 92971, 540: 106680, 530: 120767, 520: 134945, 510: 148936, 500: 162612, 490: 175732, 480: 187938, 470: 198992, 463: 205975 },
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

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  assert(result.status === 0, `${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function parseTsv(tsv, rowCount, context) {
  const byRow = new Map();
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const cells = line.split("\t");
    if (cells.length < 12 || !/^\d+$/.test(cells[11])) continue;
    const top = Number(cells[7]);
    const rowIndex = Math.round((top - FIRST_ROW_TOP) / ROW_PITCH);
    const expectedTop = FIRST_ROW_TOP + rowIndex * ROW_PITCH;
    if (rowIndex < 0 || rowIndex >= rowCount || Math.abs(top - expectedTop) > 8) continue;
    const item = {
      value: Number(cells[11]),
      text: cells[11],
      confidence: Number(cells[10]),
      left: Number(cells[6]),
      top,
      width: Number(cells[8]),
      height: Number(cells[9]),
    };
    const candidates = byRow.get(rowIndex) || [];
    candidates.push(item);
    byRow.set(rowIndex, candidates);
  }
  const rows = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const expectedTop = FIRST_ROW_TOP + rowIndex * ROW_PITCH;
    const candidates = (byRow.get(rowIndex) || []).sort((left, right) => (
      Math.abs(left.top - expectedTop) - Math.abs(right.top - expectedTop)
      || right.confidence - left.confidence
    ));
    assert(candidates.length <= 1, `${context} row ${rowIndex} expected at most one numeric OCR item, got ${JSON.stringify(candidates)}`);
    rows.push(candidates[0] || null);
  }
  return rows;
}

function extractCellColumn(imageFile, sourceKey, subjectKey, panel, field, tempDir) {
  const crop = CELL_CROPS[field];
  const x = crop.x + panel.panel * PANEL_OFFSET_X;
  const y = CROP_TOP + panel.page * PAGE_HEIGHT;
  const cropFile = path.join(tempDir, `${sourceKey}-${subjectKey}-p${panel.page + 1}c${panel.panel + 1}-${field}.jpg`);
  run("sips", [
    "--cropOffset", String(y), String(x),
    "--cropToHeightWidth", String(CROP_HEIGHT), String(crop.width),
    imageFile,
    "--out", cropFile,
  ]);
  const tsv = run("tesseract", [
    cropFile,
    "stdout",
    "-l", "eng",
    "--psm", "6",
    "-c", "tessedit_char_whitelist=0123456789",
    "tsv",
  ]);
  return parseTsv(tsv, panel.rowCount, `${sourceKey} ${subjectKey} page ${panel.page + 1} panel ${panel.panel + 1} ${field}`);
}

function validateRows(rows, config, sourceKey) {
  assert(rows.length === config.expectedRows, `${sourceKey} ${config.subjectType} row count drifted`);
  assert(rows[0].score === config.panels[0].firstScore && rows.at(-1).score === config.bottomScore, `${sourceKey} ${config.subjectType} score boundaries drifted`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1), `${sourceKey} ${config.subjectType} scores are not contiguous`);
  let previousRankEnd = 0;
  for (const row of rows) {
    assert(row.scoreOcr?.value === row.score || row.ocrCorrections.some((item) => item.field === "score"), `${sourceKey} ${config.subjectType} score OCR drifted at ${row.score}`);
    assert(row.rankEnd > previousRankEnd, `${sourceKey} ${config.subjectType} cumulative rank is not increasing at ${row.score}`);
    assert(row.rankEnd - previousRankEnd === row.sameRankScore, `${sourceKey} ${config.subjectType} count does not close at ${row.score}`);
    previousRankEnd = row.rankEnd;
  }
  assert(rows.at(-1).rankEnd === config.bottomRankEnd, `${sourceKey} ${config.subjectType} bottom rank drifted`);
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) {
    assert(rows.find((row) => row.score === Number(score))?.rankEnd === rankEnd, `${sourceKey} ${config.subjectType} checkpoint ${score} drifted`);
  }
}

function extractSubject(imageFile, sourceKey, config, tempDir) {
  const rawRows = [];
  for (const panel of config.panels) {
    const columns = Object.fromEntries(Object.keys(CELL_CROPS).map((field) => [
      field,
      extractCellColumn(imageFile, sourceKey, config.key, panel, field, tempDir),
    ]));
    for (let index = 0; index < panel.rowCount; index += 1) {
      const score = panel.firstScore - index;
      rawRows.push({
        score,
        scoreRange: rawRows.length === 0 ? { min: score, max: config.topRangeMax } : undefined,
        scoreOcr: columns.score[index],
        sameRankScoreOcr: columns.sameRankScore[index],
        rankEndOcr: columns.rankEnd[index],
      });
    }
  }
  let previousRankEnd = 0;
  const rows = rawRows.map((row) => {
    const ocrCorrections = [];
    if (row.scoreOcr?.value !== row.score) {
      ocrCorrections.push({ field: "score", ocrValue: row.scoreOcr?.value ?? null, correctedValue: row.score, reason: "fixed score grid and contiguous descending score sequence" });
    }
    let rankEnd = row.rankEndOcr?.value;
    if (!Number.isInteger(rankEnd) || rankEnd <= previousRankEnd) {
      assert(Number.isInteger(row.sameRankScoreOcr?.value) && row.sameRankScoreOcr.value > 0, `${sourceKey} ${config.subjectType} cannot recover cumulative rank at ${row.score}`);
      rankEnd = previousRankEnd + row.sameRankScoreOcr.value;
      ocrCorrections.push({ field: "rankEnd", ocrValue: row.rankEndOcr?.value ?? null, correctedValue: rankEnd, reason: "previous cumulative rank plus independently OCR-read same-score count" });
    }
    const arithmeticCount = rankEnd - previousRankEnd;
    let sameRankScore = row.sameRankScoreOcr?.value;
    if (sameRankScore !== arithmeticCount) {
      ocrCorrections.push({ field: "sameRankScore", ocrValue: sameRankScore ?? null, correctedValue: arithmeticCount, reason: "current cumulative rank minus previous cumulative rank" });
      sameRankScore = arithmeticCount;
    }
    previousRankEnd = rankEnd;
    return { ...row, sameRankScore, rankEnd, ocrCorrections };
  });
  validateRows(rows, config, sourceKey);
  return rows;
}

function compareSources(official, mirror) {
  let rowComparisons = 0;
  let cellComparisons = 0;
  for (const config of SUBJECTS) {
    const officialRows = official.subjects[config.subjectType];
    const mirrorRows = mirror.subjects[config.subjectType];
    assert(mirrorRows.length === officialRows.length, `${config.subjectType} source row counts differ`);
    for (let index = 0; index < officialRows.length; index += 1) {
      for (const field of ["score", "sameRankScore", "rankEnd"]) {
        assert(mirrorRows[index][field] === officialRows[index][field], `${config.subjectType} sources differ at ${officialRows[index].score} ${field}`);
        cellComparisons += 1;
      }
      rowComparisons += 1;
    }
  }
  return { rowComparisons, cellComparisons, differences: 0 };
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume OCR; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaokao-jiangsu-v3319-"));
  const extracted = [];
  try {
    for (const source of SOURCES) {
      const subjects = {};
      const imageEvidence = {};
      for (const config of SUBJECTS) {
        const imageFile = path.join(rawDir, source[config.key]);
        assert(fs.existsSync(imageFile), `Missing ${source.key} ${config.subjectType} image: ${imageFile}`);
        const bytes = fs.readFileSync(imageFile);
        imageEvidence[config.subjectType] = {
          file: path.basename(imageFile),
          bytes: bytes.length,
          sha256: sha256(bytes),
          width: 1588,
          height: 4488,
        };
        subjects[config.subjectType] = extractSubject(imageFile, source.key, config, tempDir);
      }
      extracted.push({ source: source.key, imageEvidence, subjects });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const comparison = compareSources(extracted[0], extracted[1]);
  assert(comparison.rowComparisons === 398 && comparison.cellComparisons === 1194, "Jiangsu OCR comparison totals drifted");
  const allRows = extracted.flatMap((source) => Object.values(source.subjects).flat());
  const lowConfidenceCells = allRows.flatMap((row) => [row.scoreOcr, row.sameRankScoreOcr, row.rankEndOcr]).filter((cell) => cell && cell.confidence < 50).length;
  const ocrCorrections = allRows.flatMap((row) => row.ocrCorrections).length;
  const payload = {
    dataset: "official-jiangsu-rank-cell-ocr-v3319",
    generatedAt: new Date().toISOString(),
    extraction: {
      engine: "Tesseract eng psm=6, one fixed numeric column at a time",
      cropGeometry: { pageHeight: PAGE_HEIGHT, cropTop: CROP_TOP, cropHeight: CROP_HEIGHT, panelOffsetX: PANEL_OFFSET_X, firstRowTop: FIRST_ROW_TOP, rowPitch: ROW_PITCH, cells: CELL_CROPS },
      arithmeticValidation: "every cumulative rank equals previous cumulative rank plus same-score count",
    },
    sources: extracted,
    comparison,
    audit: {
      officialRows: 398,
      mirrorRows: 398,
      allScoresContiguousWithinPublishedFirstStage: true,
      allCountsClose: true,
      allCumulativeRanksStrictlyIncrease: true,
      lowConfidenceCells,
      ocrCorrections,
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    dataset: payload.dataset,
    historyRows: extracted[0].subjects["历史类"].length,
    physicsRows: extracted[0].subjects["物理类"].length,
    ...comparison,
    lowConfidenceCells,
    ocrCorrections,
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
