#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-jiangsu-rank-conversion-2025-v3319-import.json"), "utf8"));
const sourceId = "official-jiangsu-rank-2025-v3319";
const quality = "official-jiangsu-education-examination-authority-image-chsi-byte-identical-dxsbb-pixel-equivalent-cross-verified";

assert.equal(payload.dataset, "official-jiangsu-rank-conversion-2025-v3319-import");
assert.equal(payload.sourceId, sourceId);
assert.equal(payload.rankConversions.length, 398);
assert.equal(payload.audit.expectedRecords, 398);
assert.equal(payload.audit.parsedRecords, 398);
assert.equal(payload.audit.duplicateIds, 0);
assert.deepEqual(payload.audit.emittedRows, { "历史类": 177, "物理类": 221 });
assert.deepEqual(payload.audit.publishedFloors, { "历史类": 482, "物理类": 463 });
assert.equal(payload.audit.rowComparisons, 398);
assert.equal(payload.audit.cellComparisons, 1194);
assert.equal(payload.audit.sourceDifferences, 0);
assert.equal(payload.audit.ocrCorrections, 15);
assert.equal(payload.audit.lowConfidenceCells, 18);
assert.equal(payload.audit.allCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksStrictlyIncrease, true);
assert.equal(payload.audit.chsiImagesByteIdentical, true);
assert.equal(payload.audit.secondStageExcluded, true);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 398);

const expected = {
  "历史类": { rows: 177, topScore: 658, topEnd: 109, bottomScore: 482, bottomEnd: 56398, checkpoints: { 650: 250, 640: 626, 630: 1250, 620: 2253, 610: 3741, 600: 5796, 580: 11515, 560: 19224, 540: 28408, 520: 38007, 500: 47639, 482: 56398 } },
  "物理类": { rows: 221, topScore: 683, topEnd: 126, bottomScore: 463, bottomEnd: 205975, checkpoints: { 680: 196, 670: 728, 660: 2027, 650: 4363, 640: 7928, 630: 12829, 620: 19004, 610: 26330, 600: 34888, 580: 55261, 560: 79711, 540: 106680, 520: 134945, 500: 162612, 480: 187938, 463: 205975 } },
};

for (const [subjectType, config] of Object.entries(expected)) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType).sort((left, right) => right.score - left.score);
  assert.equal(rows.length, config.rows);
  assert.equal(rows[0].score, config.topScore);
  assert.equal(rows[0].rankStart, 1);
  assert.equal(rows[0].rankEnd, config.topEnd);
  assert.deepEqual(rows[0].scoreRange, { min: config.topScore, max: 750 });
  assert.equal(rows.at(-1).score, config.bottomScore);
  assert.equal(rows.at(-1).rankEnd, config.bottomEnd);
  assert.equal(rows.reduce((sum, row) => sum + row.sameRankScore, 0), config.bottomEnd);
  assert.ok(rows.every((row, index) => index === 0 || (rows[index - 1].score - row.score === 1 && row.rankStart === rows[index - 1].rankEnd + 1)));
  assert.ok(rows.every((row) => row.sourceId === sourceId && row.sourceQuality === quality && row.evidenceStage === "first-stage-full-cohort-eligible-candidates"));
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) assert.equal(rows.find((row) => row.score === Number(score)).rankEnd, rankEnd);
}

const source = payload.sourceNotes[0];
assert.equal(source.id, sourceId);
assert.equal(source.publisher, "江苏省教育考试院");
assert.equal(source.parsedRecords, 398);
assert.deepEqual(source.subjectBreakdown, { "历史类": 177, "物理类": 221 });
assert.deepEqual(source.firstStagePublishedFloor, { "历史类": 482, "物理类": 463 });
assert.equal(source.provenance.chsiImageByteIdentityVerified, true);
assert.equal(source.provenance.dxsbbPixelEquivalentOcrVerified, true);
assert.equal(source.provenance.secondStageExcluded, true);
assert.equal(source.provenance.rowComparisons, 398);
assert.equal(source.provenance.cellComparisons, 1194);
assert.equal(source.provenance.ocrCorrections, 15);
assert.match(source.provenance.secondStageExclusionReason, /不是全体同科类考生累计位次/);
assert.equal(source.provenance.evidenceSha256["jseea-history.jpg"], "e6a629b4c977d7c0358f638516854eee0b39c5c398ec64b25c6a2405d1632ecd");
assert.equal(source.provenance.evidenceSha256["jseea-physics.jpg"], "fcff5805ada8cffd60879bfbc859c5c31d7a9a1cac0db47ad49d995594144058");
assert.equal(source.provenance.evidenceSha256["chsi-history.jpg"], source.provenance.evidenceSha256["jseea-history.jpg"]);
assert.equal(source.provenance.evidenceSha256["chsi-physics.jpg"], source.provenance.evidenceSha256["jseea-physics.jpg"]);
assert.match(source.evidenceBoundary, /history scores 658-and-above through 482.*physics scores 683-and-above through 463/);

console.log(JSON.stringify({ ok: true, dataset: payload.dataset, rows: 398, cellsCompared: 1194, ocrCorrections: 15, sourceId }, null, 2));
