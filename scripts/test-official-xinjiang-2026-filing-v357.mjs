#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_TOTALS,
  PDF_SPECS,
  parsePdfRows,
  recordFromPdfRow,
} from "./import-official-xinjiang-2026-filing-v357.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-xinjiang-2026-filing-v357-import.json");

assert.equal(PDF_SPECS.length, 6);
assert.deepEqual(EXPECTED_TOTALS, {
  records: 3174,
  filingScoreRecords: 2951,
  noFilingPlanRecords: 223,
  pdfs: 6,
});
assert.deepEqual(PDF_SPECS.map((spec) => spec.pdfId), ["30282", "30283", "30341", "30342", "30407", "30408"]);
assert.equal(PDF_SPECS[0].batch, "本科一批");
assert.equal(PDF_SPECS[2].batch, "本科二批");
assert.equal(PDF_SPECS[4].batch, "高职（专科）批");

const firstSpec = PDF_SPECS[0];
const normalRows = parsePdfRows([
  "1001      北京大学       17    17     658     630   132   235   117",
  "8184      新疆医科大学           1    0",
].join("\n"), firstSpec);
assert.equal(normalRows.length, 2);
assert.deepEqual(normalRows[0], {
  pdfId: "30282",
  schoolCode: "1001",
  schoolName: "北京大学",
  planCount: 17,
  filingCount: 17,
  maxScore: 658,
  minScore: 630,
  tieBreakScores: { totalScore: 630, chinese: 132, comprehensive: 235, math: 117 },
  noFiling: false,
});
assert.deepEqual(normalRows[1], {
  pdfId: "30282",
  schoolCode: "8184",
  schoolName: "新疆医科大学",
  planCount: 1,
  filingCount: 0,
  maxScore: null,
  minScore: null,
  tieBreakScores: null,
  noFiling: true,
});

const normalRecord = recordFromPdfRow(normalRows[0], firstSpec);
assert.equal(normalRecord.province, "新疆");
assert.equal(normalRecord.year, 2026);
assert.equal(normalRecord.subjectType, "历史类");
assert.equal(normalRecord.dataType, "institution-admission");
assert.equal(normalRecord.scoreOnly, true);
assert.equal(normalRecord.rankUnavailable, true);
assert.equal(normalRecord.nativeAdmissionRankUnavailable, true);
assert.equal(normalRecord.rankDerivedFromScore, false);
assert.equal(normalRecord.minRankStart, null);
assert.equal(normalRecord.minRankEnd, null);
assert.equal(normalRecord.avgScore, null);
assert.deepEqual(normalRecord.tieBreakScores, { totalScore: 630, chinese: 132, comprehensive: 235, math: 117 });

const noFilingRecord = recordFromPdfRow(normalRows[1], firstSpec);
assert.equal(noFilingRecord.dataType, "admission-plan");
assert.equal(noFilingRecord.noFiling, true);
assert.equal(noFilingRecord.scoreOnly, false);
assert.equal(noFilingRecord.planCount, 1);
assert.equal(noFilingRecord.filingCount, 0);
assert.equal(noFilingRecord.minScore, null);
assert.equal(noFilingRecord.maxScore, null);
assert.equal(noFilingRecord.tieBreakScores, null);

const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const source = payload.sourceNotes[0];
assert.equal(payload.dataset, "official-xinjiang-2026-filing-v357-import");
assert.equal(source.id, "official-xinjiang-2026-filing-v357");
assert.equal(source.publisher, "新疆教育考试院");
assert.equal(source.parsedRecords, 3174);
assert.equal(source.filingScoreRecords, 2951);
assert.equal(source.noFilingPlanRecords, 223);
assert.equal(source.rankUnavailableRecords, 3174);
assert.equal(source.scoreDerivedRankRecords, 0);
assert.equal(source.pdfNotes.length, 6);
assert.deepEqual(source.pdfNotes.map((item) => item.parsedRecords), [231, 395, 512, 660, 646, 730]);
assert.deepEqual(source.pdfNotes.map((item) => item.filingScoreRecords), [229, 392, 477, 651, 535, 667]);
assert.deepEqual(source.pdfNotes.map((item) => item.noFilingPlanRecords), [2, 3, 35, 9, 111, 63]);

const records = payload.records;
assert.equal(records.length, 3174);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.ok(records.every((record) => record.province === "新疆" && record.year === 2026));
assert.ok(records.every((record) => record.sourceId === source.id));
assert.ok(records.every((record) => record.rankUnavailable && record.nativeAdmissionRankUnavailable));
assert.ok(records.every((record) => record.rankDerivedFromScore === false));
assert.equal(records.filter((record) => record.scoreOnly).length, 2951);
assert.equal(records.filter((record) => record.noFiling).length, 223);
assert.ok(records.filter((record) => record.scoreOnly).every((record) => record.minScore <= record.maxScore));
assert.ok(records.filter((record) => record.noFiling).every((record) => (record.minScore ?? null) === null && (record.maxScore ?? null) === null && (record.tieBreakScores ?? null) === null));

console.log(JSON.stringify({
  status: "ok",
  records: records.length,
  filingScoreRecords: records.filter((record) => record.scoreOnly).length,
  noFilingPlanRecords: records.filter((record) => record.noFiling).length,
  pdfs: source.pdfNotes.length,
}, null, 2));
