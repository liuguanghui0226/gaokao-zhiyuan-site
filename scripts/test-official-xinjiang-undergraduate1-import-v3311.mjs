#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-xinjiang-undergraduate1-filing-2025-v3311-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;
const source = payload.sourceNotes[0];

assert.equal(payload.dataset, "official-xinjiang-undergraduate1-filing-2025-v3311-import");
assert.equal(source.id, "official-xinjiang-undergraduate1-filing-2025-v3311");
assert.equal(source.publisher, "新疆教育考试院");
assert.equal(source.rawFiles.length, 21);
assert.equal(source.imageCount, 3);
assert.equal(source.parsedRecords, 505);
assert.equal(payload.audit.imageCount, 3);
assert.equal(payload.audit.rowCandidates, 505);
assert.equal(payload.audit.parsedRecords, 505);
assert.equal(payload.audit.duplicateIds, 0);
assert.equal(payload.audit.skippedRows.length, 0);
assert.deepEqual(payload.audit.skippedTotals, { missingSchool: 0, invalidSchool: 0, missingScore: 0, invalidScore: 0 });
assert.deepEqual(payload.audit.qualityTotals, { overlappingOcrAnchors: 21, rejectedHighestScore: 0, missingPlanAndFiling: 0 });
assert.equal(payload.audit.qualityRows.length, 0);
assert.equal(records.length, 505);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.equal(records.filter((record) => record.subjectType === "历史类").length, 200);
assert.equal(records.filter((record) => record.subjectType === "物理类").length, 305);
assert.equal(new Set(records.map((record) => record.schoolName)).size, 282);
assert.equal(payload.audit.recordsWithPlanCount, 505);
assert.equal(payload.audit.recordsWithFilingCount, 505);
assert.equal(payload.audit.recordsWithTieBreak, 505);
assert.equal(payload.audit.rankUnavailableRecords, 505);
assert.equal(payload.audit.scoreDerivedRankRecords, 0);
assert.equal(payload.audit.minScore, 421);
assert.equal(payload.audit.maxScore, 698);

assert.ok(records.every((record) => record.province === "新疆" && record.year === 2025 && record.batch === "本科一批"));
assert.ok(records.every((record) => record.dataType === "institution-admission" && record.sourceId === source.id));
assert.ok(records.every((record) => record.scoreOnly === true && record.rankUnavailable === true && record.nativeAdmissionRankUnavailable === true));
assert.ok(records.every((record) => record.rankDerivedFromScore === false && record.rankEvidenceScope === "rank-unavailable"));
assert.ok(records.every((record) => record.minRankStart === null && record.minRankEnd === null));
assert.ok(records.every((record) => Number.isInteger(record.planCount) && record.planCount >= 0 && record.planCount <= 2000));
assert.ok(records.every((record) => Number.isInteger(record.filingCount) && record.filingCount >= 0 && record.filingCount <= 2000));
assert.ok(records.every((record) => record.minScore >= 100 && record.minScore <= record.maxScore && record.maxScore <= 750));
assert.ok(records.every((record) => record.avgScore >= record.minScore && record.avgScore <= record.maxScore));
assert.ok(records.every((record) => record.tieBreakScores.totalScore === record.minScore));
assert.ok(records.every((record) => record.tieBreakScores.chinese >= 0 && record.tieBreakScores.chinese <= 150));
assert.ok(records.every((record) => record.tieBreakScores.math >= 0 && record.tieBreakScores.math <= 150));
assert.ok(records.every((record) => record.tieBreakScores.comprehensive >= 0 && record.tieBreakScores.comprehensive <= 300));

const historyBjut = records.find((record) => record.imageId === "29619" && record.schoolCode === "1007");
assert.ok(historyBjut);
assert.equal(historyBjut.schoolName, "北京理工大学");
assert.equal(historyBjut.planCount, 4);
assert.equal(historyBjut.filingCount, 4);
assert.equal(historyBjut.maxScore, 582);
assert.equal(historyBjut.minScore, 573);
assert.equal(historyBjut.avgScore, 577.25);
assert.deepEqual(historyBjut.tieBreakScores, { totalScore: 573, chinese: 122, comprehensive: 225, math: 104 });

const historyNottingham = records.find((record) => record.imageId === "29619" && record.schoolCode === "3653");
assert.ok(historyNottingham);
assert.equal(historyNottingham.schoolName, "宁波诺丁汉大学");
assert.equal(historyNottingham.planCount, 5);
assert.equal(historyNottingham.filingCount, 1);
assert.equal(historyNottingham.minScore, 508);

const physicsPkuMedicine = records.find((record) => record.imageId === "29623" && record.schoolCode === "3666");
assert.ok(physicsPkuMedicine);
assert.equal(physicsPkuMedicine.schoolName, "北京大学医学部");
assert.equal(physicsPkuMedicine.planCount, 1);
assert.equal(physicsPkuMedicine.filingCount, 2);
assert.equal(physicsPkuMedicine.maxScore, 676);
assert.equal(physicsPkuMedicine.minScore, 673);
assert.deepEqual(physicsPkuMedicine.tieBreakScores, { totalScore: 673, chinese: 124, comprehensive: 279, math: 121 });

const physicsZju = records.find((record) => record.imageId === "29623" && record.schoolCode === "8216");
assert.ok(physicsZju);
assert.equal(physicsZju.schoolName, "浙江大学");
assert.equal(physicsZju.planCount, 9);
assert.equal(physicsZju.filingCount, 9);
assert.equal(physicsZju.maxScore, 656);
assert.equal(physicsZju.minScore, 640);

const rawManifestPath = path.join(projectRoot, "data/admissions/raw/official-xinjiang-undergraduate1-filing-2025-v3311/raw-manifest.json");
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, "utf8"));
  assert.equal(rawManifest.images.length, 3);
  assert.equal(rawManifest.totals.rowCandidates, 505);
  assert.equal(rawManifest.totals.parsedRecords, 505);
  for (const evidence of rawManifest.evidenceFiles) {
    const bytes = fs.readFileSync(path.join(projectRoot, evidence.path));
    assert.equal(bytes.length, evidence.bytes, `${evidence.path} byte count drifted`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), evidence.sha256, `${evidence.path} hash drifted`);
  }
}

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  historyRecords: 200,
  physicsRecords: 305,
  rankUnavailableRecords: payload.audit.rankUnavailableRecords,
  rawFiles: source.rawFiles.length,
  samples: [historyBjut.schoolName, historyNottingham.schoolName, physicsPkuMedicine.schoolName, physicsZju.schoolName],
}, null, 2));
