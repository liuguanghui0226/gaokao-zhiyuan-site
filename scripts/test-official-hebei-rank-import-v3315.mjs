#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hebei-rank-conversion-2025-v3315-import.json"), "utf8"));
const sourceId = "official-hebei-rank-2025-v3315";

assert.equal(payload.dataset, "official-hebei-rank-conversion-2025-v3315-import");
assert.equal(payload.sourceId, sourceId);
assert.equal(payload.rankConversions.length, 1087);
assert.equal(payload.audit.parsedRecords, 1087);
assert.equal(payload.audit.duplicateIds, 0);
assert.equal(payload.audit.officialPdfPages, 18);
assert.equal(payload.audit.mirrorScoreRows, 554);
assert.equal(payload.audit.officialOcrScoreRows, 554);
assert.equal(payload.audit.fullTableComparisons, 1087);
assert.equal(payload.audit.fullTableDifferences, 0);
assert.equal(payload.audit.allScoreRowsContiguous, true);
assert.equal(payload.audit.allCumulativeRanksMonotonic, true);
assert.equal(payload.audit.allPublishedCountsClose, true);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1087);

const expected = {
  "历史类": { rows: 533, topScore: 672, topEnd: 35, bottomEnd: 243714, checkpoints: { 600: 6004, 527: 33954, 477: 64897, 200: 236503 } },
  "物理类": { rows: 554, topScore: 693, topEnd: 32, bottomEnd: 363040, checkpoints: { 600: 27073, 499: 162246, 459: 224230, 200: 361477 } },
};

for (const [subjectType, config] of Object.entries(expected)) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType).sort((left, right) => right.score - left.score);
  assert.equal(rows.length, config.rows);
  assert.equal(rows[0].score, config.topScore);
  assert.equal(rows[0].rankStart, 1);
  assert.equal(rows[0].rankEnd, config.topEnd);
  assert.deepEqual(rows[0].scoreRange, { min: config.topScore, max: 750 });
  assert.equal(rows.at(-1).score, 140);
  assert.equal(rows.at(-1).rankEnd, config.bottomEnd);
  assert.equal(rows.reduce((sum, row) => sum + row.sameRankScore, 0), config.bottomEnd);
  assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1));
  assert.ok(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1));
  assert.ok(rows.every((row) => row.sourceId === sourceId && row.sourceQuality === "official-hebei-rank-conversion-pdf-ocr-full-table-cross-verified"));
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) assert.equal(rows.find((row) => row.score === Number(score)).rankEnd, rankEnd);
}

const source = payload.sourceNotes[0];
assert.equal(source.id, sourceId);
assert.equal(source.publisher, "河北省教育考试院");
assert.equal(source.parsedRecords, 1087);
assert.deepEqual(source.subjectBreakdown, { "历史类": 533, "物理类": 554 });
assert.equal(source.provenance.authorityAuthored, true);
assert.equal(source.provenance.officialPdfPages, 18);
assert.equal(source.provenance.fullTableComparisons, 1087);
assert.equal(source.provenance.officialPdfSha256, "d4b2e17f81b3aeb80cdbe9e2b5fbdcc1318f4f57b0dbfb6a1b4707bb5f16f3e2");
assert.equal(source.provenance.officialOcrSha256, "6e57ba38389e4fc77faeac2d6bcf2bffa4a2897c08968d64499ee2840d8faead");
assert.equal(source.provenance.independentMirrorSha256, "cdbaa423992e87def2b183f3e825ea143aa520f3edfd35f4ae87f8ae3a5fb6c9");
assert.match(source.evidenceBoundary, /score-derived provincial segment ranges/);

console.log(JSON.stringify({ ok: true, dataset: payload.dataset, rows: payload.rankConversions.length, comparisons: payload.audit.fullTableComparisons, sourceId }, null, 2));
