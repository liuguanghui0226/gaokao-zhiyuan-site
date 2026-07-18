#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hunan-rank-conversion-2025-v3318-import.json"), "utf8"));
const sourceId = "official-hunan-rank-2025-v3318";
const quality = "official-source-attributed-hunan-education-department-eol-table-chsi-image-dxsbb-full-mirror-cross-verified";

assert.equal(payload.dataset, "official-hunan-rank-conversion-2025-v3318-import");
assert.equal(payload.sourceId, sourceId);
assert.equal(payload.rankConversions.length, 1139);
assert.equal(payload.audit.expectedRecords, 1139);
assert.equal(payload.audit.parsedRecords, 1139);
assert.equal(payload.audit.duplicateIds, 0);
assert.deepEqual(payload.audit.authorityRows, { "历史类": 560, "物理类": 592 });
assert.deepEqual(payload.audit.numericRows, { "历史类": 558, "物理类": 590 });
assert.deepEqual(payload.audit.emittedRows, { "历史类": 550, "物理类": 589 });
assert.deepEqual(payload.audit.mirrorRows, { "历史类": 550, "物理类": 589 });
assert.equal(payload.audit.rowComparisons, 1139);
assert.equal(payload.audit.cellComparisons, 3417);
assert.equal(payload.audit.sourceDifferences, 0);
assert.deepEqual(payload.audit.zeroScoreGaps, { "历史类": [129, 124, 116, 115, 112, 110, 105, 104, 103], "物理类": [107, 101] });
assert.equal(payload.audit.allAuthorityCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksMonotonic, true);
assert.equal(payload.audit.governmentEolAndChsiAttributionsVerified, true);
assert.deepEqual(payload.audit.chsiImageDimensions, { "历史类": { width: 680, height: 12252 }, "物理类": { width: 680, height: 12651 } });
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1139);

const expected = {
  "历史类": { rows: 550, topScore: 658, topEnd: 55, bottomEnd: 141153, gaps: [129, 124, 116, 115, 112, 110, 105, 104, 103], checkpoints: { 600: 2369, 500: 27038, 446: 53081, 400: 78486, 300: 124838, 200: 140042, 100: 141153 } },
  "物理类": { rows: 589, topScore: 690, topEnd: 53, bottomEnd: 318823, gaps: [107, 101], checkpoints: { 600: 15860, 500: 90705, 422: 190592, 400: 217140, 300: 293562, 200: 317438, 100: 318823 } },
};

for (const [subjectType, config] of Object.entries(expected)) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType).sort((left, right) => right.score - left.score);
  assert.equal(rows.length, config.rows);
  assert.equal(rows[0].score, config.topScore);
  assert.equal(rows[0].rankStart, 1);
  assert.equal(rows[0].rankEnd, config.topEnd);
  assert.deepEqual(rows[0].scoreRange, { min: config.topScore, max: 750 });
  assert.equal(rows.at(-1).score, 100);
  assert.equal(rows.at(-1).rankEnd, config.bottomEnd);
  assert.equal(rows.reduce((sum, row) => sum + row.sameRankScore, 0), config.bottomEnd);
  assert.ok(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1));
  assert.ok(rows.every((row) => row.sourceId === sourceId && row.sourceQuality === quality));
  assert.ok(config.gaps.every((score) => !rows.some((row) => row.score === score)));
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) {
    assert.equal(rows.find((row) => row.score === Number(score)).rankEnd, rankEnd);
  }
}

const source = payload.sourceNotes[0];
assert.equal(source.id, sourceId);
assert.equal(source.publisher, "湖南省教育厅（来源标注）");
assert.equal(source.parsedRecords, 1139);
assert.deepEqual(source.subjectBreakdown, { "历史类": 550, "物理类": 589 });
assert.equal(source.provenance.eolAuthorityAttribution, "湖南省教育厅");
assert.equal(source.provenance.chsiAttribution, "湖南考试招生");
assert.deepEqual(source.provenance.governmentCheckpoints, { history600: 2369, physics600: 15860 });
assert.equal(source.provenance.authorityRows, 1152);
assert.equal(source.provenance.rowComparisons, 1139);
assert.equal(source.provenance.cellComparisons, 3417);
assert.equal(source.provenance.zeroScoreGaps, 11);
assert.match(source.provenance.verification, /all 1139 independently mirrored rows.*3417/);
assert.equal(source.provenance.evidenceSha256["government-release.html"], "cb36b5eed2ce049ac310d203ae7270dd95f8e24d5729dedbd8cea0b2ff9c114a");
assert.equal(source.provenance.evidenceSha256["chsi-physics.png"], "ad7de963ba347b317bed18b5781b1cdc39d545463d66a899145f300564c02427");
assert.equal(source.provenance.evidenceSha256["chsi-history.png"], "8f222b93ac9a6b63c8045caeefe24a5eee291020701e79221b26d05ed6aecea7");
assert.equal(source.provenance.evidenceSha256["eol-physics.html"], "ae4ef3d00194a9f6bcc7913be4f3457a1b7e934fda6252c9b4ec561702a7999a");
assert.equal(source.provenance.evidenceSha256["eol-history.html"], "c6b7b31ea7ce997caf11eb6d2a6e495290cd8fd3becb94fa78f195cdc0bdd167");
assert.equal(source.provenance.evidenceSha256["dxsbb-physics.html"], "f9b6d7402daed7b5f60ac86dd98af3c4f41a40a57208ffe4d2108bbf25cd9e86");
assert.equal(source.provenance.evidenceSha256["dxsbb-history.html"], "53a17305011c0fe822305d91fa7373a13d8abd8f9550ebe2a71e4abf208eeafd");
assert.match(source.evidenceBoundary, /not institution-native minimum admission ranks/);

console.log(JSON.stringify({ ok: true, dataset: payload.dataset, rows: payload.rankConversions.length, cellsCompared: payload.audit.cellComparisons, zeroScoreGaps: 11, sourceId }, null, 2));
