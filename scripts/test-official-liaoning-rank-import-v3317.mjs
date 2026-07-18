#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-liaoning-rank-conversion-2025-v3317-import.json"), "utf8"));
const sourceId = "official-liaoning-rank-2025-v3317";
const quality = "official-content-mirror-chsi-liaoning-exam-office-pdf-text-eol-cross-verified";

assert.equal(payload.dataset, "official-liaoning-rank-conversion-2025-v3317-import");
assert.equal(payload.sourceId, sourceId);
assert.equal(payload.rankConversions.length, 1073);
assert.equal(payload.audit.expectedRecords, 1073);
assert.equal(payload.audit.parsedRecords, 1073);
assert.equal(payload.audit.duplicateIds, 0);
assert.deepEqual(payload.audit.publishedRows, { "历史类": 517, "物理类": 556 });
assert.deepEqual(payload.audit.fullMirrorRows, { "历史类": 520, "物理类": 558 });
assert.equal(payload.audit.rowComparisons, 1073);
assert.equal(payload.audit.cellComparisons, 3219);
assert.equal(payload.audit.sourceDifferences, 0);
assert.deepEqual(payload.audit.zeroScoreGaps, { "历史类": [667, 164, 162], "物理类": [703, 153] });
assert.equal(payload.audit.allPublishedCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksMonotonic, true);
assert.equal(payload.audit.governmentAndChsiIndexesVerified, true);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1073);

const expected = {
  "历史类": { rows: 517, topScore: 669, topEnd: 10, bottomEnd: 56324, gaps: [667, 164, 162], checkpoints: { 600: 2025, 500: 14867, 437: 26916, 300: 50663, 150: 56324 } },
  "物理类": { rows: 556, topScore: 707, topEnd: 11, bottomEnd: 143368, gaps: [703, 153], checkpoints: { 600: 13601, 500: 56548, 367: 118109, 300: 135097, 150: 143368 } },
};

for (const [subjectType, config] of Object.entries(expected)) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType).sort((left, right) => right.score - left.score);
  assert.equal(rows.length, config.rows);
  assert.equal(rows[0].score, config.topScore);
  assert.equal(rows[0].rankStart, 1);
  assert.equal(rows[0].rankEnd, config.topEnd);
  assert.deepEqual(rows[0].scoreRange, { min: config.topScore, max: 750 });
  assert.equal(rows.at(-1).score, 150);
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
assert.equal(source.publisher, "辽宁省高中等教育招生考试委员会办公室");
assert.equal(source.parsedRecords, 1073);
assert.deepEqual(source.subjectBreakdown, { "历史类": 517, "物理类": 556 });
assert.equal(source.provenance.governmentIndexAttribution, "辽宁招生考试之窗");
assert.equal(source.provenance.officialDirectRetrievalStatus, "tls-unavailable-current-session");
assert.equal(source.provenance.rowComparisons, 1073);
assert.equal(source.provenance.cellComparisons, 3219);
assert.equal(source.provenance.zeroScoreGaps, 5);
assert.match(source.provenance.verification, /all 1073 published.*3219 cells/);
assert.equal(source.provenance.evidenceSha256["government-index.html"], "d31718802d4fa011d89f7fd2e71293b22dc0e1d59fc535f08c87e3c87722f64e");
assert.equal(source.provenance.evidenceSha256["chsi-physics.pdf"], "acf112a955da480b6d818036d5b5731ea4a937c43f94958eed1a3c68544be91b");
assert.equal(source.provenance.evidenceSha256["chsi-history.pdf"], "b9e0ed80edda7206107d772bf62214aa8a4a169c6dec982c05a97426ec36b4e4");
assert.equal(source.provenance.evidenceSha256["eol-physics.html"], "41d1ab7d388142957b8256a60693a84fb296362c5089bab063f9b1e4272b3994");
assert.equal(source.provenance.evidenceSha256["eol-history.html"], "d7d68c05926390b7248dee585095e321d5654904ce6aa4b48c738427a08e51a1");
assert.match(source.evidenceBoundary, /not institution-native minimum admission ranks/);

console.log(JSON.stringify({ ok: true, dataset: payload.dataset, rows: payload.rankConversions.length, cellsCompared: payload.audit.cellComparisons, zeroScoreGaps: 5, sourceId }, null, 2));
