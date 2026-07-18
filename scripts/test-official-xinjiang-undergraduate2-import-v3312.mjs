#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-xinjiang-undergraduate2-filing-2025-v3312-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;
const source = payload.sourceNotes[0];
const filingRows = records.filter((record) => !record.noFiling);
const noFilingRows = records.filter((record) => record.noFiling);

assert.equal(payload.dataset, "official-xinjiang-undergraduate2-filing-2025-v3312-import");
assert.equal(source.id, "official-xinjiang-undergraduate2-filing-2025-v3312");
assert.equal(source.publisher, "新疆教育考试院");
assert.equal(source.rawFiles.length, 249);
assert.equal(source.imageCount, 7);
assert.equal(source.parsedRecords, 1076);
assert.equal(source.filingScoreRecords, 1060);
assert.equal(source.noFilingPlanRecords, 16);
assert.equal(payload.audit.imageCount, 7);
assert.equal(payload.audit.rowCandidates, 1076);
assert.equal(payload.audit.parsedRecords, 1076);
assert.equal(payload.audit.duplicateIds, 0);
assert.equal(payload.audit.skippedRows.length, 0);
assert.deepEqual(payload.audit.skippedTotals, { missingSchool: 0, invalidSchool: 0, missingScore: 0, invalidScore: 0 });
assert.deepEqual(payload.audit.qualityTotals, { overlappingOcrAnchors: 42, rejectedHighestScore: 0, missingPlanAndFiling: 0 });
assert.equal(payload.audit.qualityRows.length, 0);
assert.equal(payload.audit.manualCorrectionRows, 189);
assert.equal(payload.audit.minScore, 280);
assert.equal(payload.audit.maxScore, 529);

assert.equal(records.length, 1076);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.equal(records.filter((record) => record.subjectType === "历史类").length, 472);
assert.equal(records.filter((record) => record.subjectType === "物理类").length, 604);
assert.equal(new Set(records.map((record) => record.schoolName)).size, 616);
assert.equal(payload.audit.recordsWithPlanCount, 1076);
assert.equal(payload.audit.recordsWithFilingCount, 1076);
assert.equal(payload.audit.recordsWithTieBreak, 1060);
assert.equal(payload.audit.rankUnavailableRecords, 1076);
assert.equal(payload.audit.scoreDerivedRankRecords, 0);

assert.ok(records.every((record) => record.province === "新疆" && record.year === 2025 && record.batch === "本科二批"));
assert.ok(records.every((record) => record.sourceId === source.id && record.rankUnavailable && record.nativeAdmissionRankUnavailable));
assert.ok(records.every((record) => !record.rankDerivedFromScore && record.rankEvidenceScope === "rank-unavailable"));
assert.ok(records.every((record) => record.minRankStart === null && record.minRankEnd === null));
assert.ok(records.every((record) => Number.isInteger(record.planCount) && record.planCount >= 0 && record.planCount <= 2000));
assert.ok(records.every((record) => Number.isInteger(record.filingCount) && record.filingCount >= 0 && record.filingCount <= 2000));

assert.equal(filingRows.length, 1060);
assert.ok(filingRows.every((record) => record.dataType === "institution-admission" && record.scoreOnly === true));
assert.ok(filingRows.every((record) => record.minScore >= 100 && record.minScore <= record.maxScore && record.maxScore <= 750));
assert.ok(filingRows.every((record) => record.avgScore >= record.minScore && record.avgScore <= record.maxScore));
assert.ok(filingRows.every((record) => record.tieBreakScores.totalScore === record.minScore));
assert.ok(filingRows.every((record) => record.tieBreakScores.chinese >= 0 && record.tieBreakScores.chinese <= 150));
assert.ok(filingRows.every((record) => record.tieBreakScores.math >= 0 && record.tieBreakScores.math <= 150));
assert.ok(filingRows.every((record) => record.tieBreakScores.comprehensive >= 0 && record.tieBreakScores.comprehensive <= 300));

assert.equal(noFilingRows.length, 16);
assert.ok(noFilingRows.every((record) => record.dataType === "admission-plan" && record.scoreOnly === false));
assert.ok(noFilingRows.every((record) => record.planCount > 0 && record.filingCount === 0));
assert.ok(noFilingRows.every((record) => record.minScore === null && record.maxScore === null && record.avgScore === null && record.tieBreakScores === null));

const historyXinjiangTech = records.find((record) => record.imageId === "29671" && record.schoolCode === "1590");
assert.ok(historyXinjiangTech);
assert.equal(historyXinjiangTech.schoolName, "新疆科技学院");
assert.equal(historyXinjiangTech.planCount, 62);
assert.equal(historyXinjiangTech.filingCount, 62);
assert.equal(historyXinjiangTech.maxScore, 393);
assert.equal(historyXinjiangTech.minScore, 372);
assert.deepEqual(historyXinjiangTech.tieBreakScores, { totalScore: 372, chinese: 108, comprehensive: 159, math: 44 });

const physicsTarimInstitute = records.find((record) => record.imageId === "29679" && record.schoolCode === "1708");
assert.ok(physicsTarimInstitute);
assert.equal(physicsTarimInstitute.schoolName, "塔里木理工学院");
assert.equal(physicsTarimInstitute.minScore, 368);
assert.equal(physicsTarimInstitute.maxScore, 426);

const noFilingSample = records.find((record) => record.imageId === "29672" && record.schoolCode === "1940");
assert.ok(noFilingSample);
assert.equal(noFilingSample.schoolName, "广东培正学院");
assert.equal(noFilingSample.planCount, 10);
assert.equal(noFilingSample.filingCount, 0);
assert.equal(noFilingSample.minScore, null);
assert.match(noFilingSample.cautions.join(" "), /不生成假分数/);

const rawManifestPath = path.join(projectRoot, "data/admissions/raw/official-xinjiang-undergraduate2-filing-2025-v3312/raw-manifest.json");
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, "utf8"));
  assert.equal(rawManifest.images.length, 7);
  assert.equal(rawManifest.totals.rowCandidates, 1076);
  assert.equal(rawManifest.totals.parsedRecords, 1076);
  for (const evidence of rawManifest.evidenceFiles) {
    const bytes = fs.readFileSync(path.join(projectRoot, evidence.path));
    assert.equal(bytes.length, evidence.bytes, `${evidence.path} byte count drifted`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), evidence.sha256, `${evidence.path} hash drifted`);
  }
}

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  filingScoreRecords: filingRows.length,
  noFilingPlanRecords: noFilingRows.length,
  manualCorrectionRows: payload.audit.manualCorrectionRows,
  samples: [historyXinjiangTech.schoolName, physicsTarimInstitute.schoolName, noFilingSample.schoolName],
}, null, 2));
