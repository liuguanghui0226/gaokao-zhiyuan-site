#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_PDF = "data/admissions/raw/official-hebei-rank-conversion-2025-v3315/official.pdf";
const DEFAULT_OUT = "data/admissions/raw/official-hebei-rank-conversion-2025-v3315/official-ocr.tsv";
const PAGE_ROWS = [31, ...Array(16).fill(32), 11];
const TOP_SCORE = 693;

const RENDER_DPI = 300;
const COLUMNS = {
  physicsRankEnd: { left: 1092, right: 1482 },
  historyRankEnd: { left: 1892, right: 2282 },
};

function parseArgs(argv) {
  const args = { pdf: DEFAULT_PDF, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--pdf") args.pdf = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function command(name) {
  const homebrew = `/opt/homebrew/bin/${name}`;
  return fs.existsSync(homebrew) ? homebrew : name;
}

function renderPage(pdf, page, tempDir) {
  const outputBase = path.join(tempDir, `page-${String(page).padStart(2, "0")}`);
  execFileSync(command("pdftoppm"), [
    "-f", String(page),
    "-singlefile",
    "-r", String(RENDER_DPI),
    pdf,
    outputBase,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  return fs.readFileSync(`${outputBase}.ppm`);
}

function parsePpm(buffer) {
  let offset = 0;
  const token = () => {
    while (offset < buffer.length && (buffer[offset] <= 32 || buffer[offset] === 35)) {
      if (buffer[offset] === 35) while (offset < buffer.length && buffer[offset++] !== 10);
      else offset += 1;
    }
    let value = "";
    while (offset < buffer.length && buffer[offset] > 32) value += String.fromCharCode(buffer[offset++]);
    return value;
  };
  assert(token() === "P6", "Expected a binary RGB PPM page");
  const width = Number(token());
  const height = Number(token());
  assert(token() === "255", "Expected 8-bit PPM samples");
  while (offset < buffer.length && buffer[offset] <= 32) offset += 1;
  const pixels = buffer.subarray(offset);
  assert(pixels.length === width * height * 3, `PPM payload size drifted: ${pixels.length} != ${width * height * 3}`);
  return { width, height, pixels };
}

function cropPpm(page, left, top, right, bottom) {
  const width = right - left;
  const height = bottom - top;
  const pixels = Buffer.alloc(width * height * 3);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((top + row) * page.width + left) * 3;
    page.pixels.copy(pixels, row * width * 3, sourceStart, sourceStart + width * 3);
  }
  return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]);
}

function detectRowBoundaries(page, expectedRows) {
  const darkLines = [];
  for (let y = 350; y < page.height - 120; y += 1) {
    let dark = 0;
    for (let x = 180; x < 2300; x += 2) {
      const offset = (y * page.width + x) * 3;
      if (page.pixels[offset] < 100 && page.pixels[offset + 1] < 100 && page.pixels[offset + 2] < 100) dark += 1;
    }
    if (dark > 700) darkLines.push(y);
  }
  const groups = [];
  for (const y of darkLines) {
    const current = groups.at(-1);
    if (current && y === current.at(-1) + 1) current.push(y);
    else groups.push([y]);
  }
  const boundaries = groups.slice(-(expectedRows + 1)).map((group) => Math.round((group[0] + group.at(-1)) / 2));
  assert(boundaries.length === expectedRows + 1, `Expected ${expectedRows + 1} row boundaries, got ${boundaries.length}`);
  assert(boundaries.every((value, index) => index === 0 || value - boundaries[index - 1] > 70), "Detected row boundaries are too close");
  return boundaries;
}

function ocrNumber(image, context) {
  const modes = ["7", "6", "10"];
  for (const mode of modes) {
    const text = execFileSync(command("tesseract"), [
      "stdin",
      "stdout",
      "-l", "eng",
      "--psm", mode,
      "-c", "tessedit_char_whitelist=0123456789",
    ], { input: image, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (/^\d+$/.test(text)) return Number(text);
  }
  throw new Error(`Could not OCR numeric cell: ${context}`);
}

function validateRows(rows) {
  assert(rows.length === 554, `Expected 554 score rows, got ${rows.length}`);
  assert(rows[0].score === 693 && rows.at(-1).score === 140, "Score boundary drifted");
  assert(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1), "Scores are not contiguous");
  for (const subject of ["physicsRankEnd", "historyRankEnd"]) {
    const subjectRows = rows.filter((row) => Number.isInteger(row[subject]));
    const badIndex = subjectRows.findIndex((row, index) => index > 0 && row[subject] < subjectRows[index - 1][subject]);
    assert(badIndex === -1, `${subject} is not monotonic at score ${subjectRows[badIndex]?.score}: ${subjectRows[badIndex - 1]?.[subject]} -> ${subjectRows[badIndex]?.[subject]}`);
  }
  assert(rows.find((row) => row.score === 693)?.physicsRankEnd === 32, "Physics top bucket drifted");
  assert(rows.find((row) => row.score === 672)?.historyRankEnd === 35, "History top bucket drifted");
  assert(rows.find((row) => row.score === 600)?.physicsRankEnd === 27073, "Physics 600 checkpoint drifted");
  assert(rows.find((row) => row.score === 600)?.historyRankEnd === 6004, "History 600 checkpoint drifted");
  assert(rows.at(-1).physicsRankEnd === 363040 && rows.at(-1).historyRankEnd === 243714, "Bottom cumulative rank drifted");
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const pdf = path.resolve(PROJECT_ROOT, args.pdf);
  const out = path.resolve(PROJECT_ROOT, args.out);
  assert(fs.existsSync(pdf), `Missing official PDF: ${pdf}`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hebei-rank-ocr-v3315-"));
  const rows = [];
  let expectedScore = TOP_SCORE;
  try {
    for (let page = 1; page <= PAGE_ROWS.length; page += 1) {
      const expectedRows = PAGE_ROWS[page - 1];
      const rendered = parsePpm(renderPage(pdf, page, tempDir));
      assert(rendered.width === 2480 && rendered.height === 3509, `Page ${page} render dimensions drifted: ${rendered.width}x${rendered.height}`);
      const historyOffset = page === 1 ? 21 : 0;
      const boundaries = detectRowBoundaries(rendered, expectedRows);
      for (let index = 0; index < expectedRows; index += 1) {
        const rowTop = boundaries[index] + 4;
        const rowBottom = boundaries[index + 1] - 4;
        const physicsCell = cropPpm(rendered, COLUMNS.physicsRankEnd.left, rowTop, COLUMNS.physicsRankEnd.right, rowBottom);
        const historyCell = index < historyOffset
          ? null
          : cropPpm(rendered, COLUMNS.historyRankEnd.left, rowTop, COLUMNS.historyRankEnd.right, rowBottom);
        rows.push({
          score: expectedScore,
          physicsRankEnd: ocrNumber(physicsCell, `page ${page} row ${index + 1} physics`),
          historyRankEnd: historyCell ? ocrNumber(historyCell, `page ${page} row ${index + 1} history`) : null,
        });
        expectedScore -= 1;
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  validateRows(rows);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const lines = ["score\tphysicsRankEnd\thistoryRankEnd"];
  for (const row of rows) lines.push(`${row.score}\t${row.physicsRankEnd}\t${row.historyRankEnd ?? ""}`);
  fs.writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, rows: rows.length, physicsRows: 554, historyRows: 533, out: path.relative(PROJECT_ROOT, out) }, null, 2));
}

main();
