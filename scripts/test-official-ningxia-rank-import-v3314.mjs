#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-ningxia-rank-conversion-2025-v3314-import.json"), "utf8"));
const sourceId = "official-ningxia-rank-2025-v3314";

assert.equal(payload.dataset, "official-ningxia-rank-conversion-2025-v3314-import");
assert.equal(payload.sourceId, sourceId);
assert.equal(payload.rankConversions.length, 959);
assert.equal(payload.audit.parsedRecords, 959);
assert.equal(payload.audit.duplicateIds, 0);
assert.equal(payload.audit.allScoreRowsContiguous, true);
assert.equal(payload.audit.allCumulativeRanksMonotonic, true);
assert.equal(payload.audit.bothMirrorPairsByteIdentical, true);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 959);

const expected = {
  "历史类": { rows: 467, topScore: 616, topEnd: 54, bottomScore: 150, bottomEnd: 21406, checkpoints: { 482: 3415, 404: 9485 } },
  "物理类": { rows: 492, topScore: 641, topEnd: 104, bottomScore: 150, bottomEnd: 44491, checkpoints: { 441: 16119, 372: 30025 } },
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
  assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1));
  assert.ok(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1));
  assert.ok(rows.every((row) => row.sourceId === sourceId && row.sourceQuality === "official-ningxia-rank-conversion-pdf-mirror-verified"));
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) assert.equal(rows.find((row) => row.score === Number(score)).rankEnd, rankEnd);
}

const source = payload.sourceNotes[0];
assert.equal(source.id, sourceId);
assert.equal(source.publisher, "宁夏教育考试院");
assert.equal(source.parsedRecords, 959);
assert.deepEqual(source.subjectBreakdown, { "历史类": 467, "物理类": 492 });
assert.equal(source.provenance.authorityAuthored, true);
assert.equal(source.provenance.mirrorVerification, "two-independent-domains-byte-identical-per-subject");
assert.equal(source.evidence["历史类"].pdfSha256, "e28bb509aa331e201474dfdb29fc6f804b6d1ba8228c71c049e11fdfb860286f");
assert.equal(source.evidence["物理类"].pdfSha256, "4f3c76dcfe85d70836290cfc866480b2d10e8d8f8a634d3f2448ed8e326548c3");
assert.match(source.evidenceBoundary, /score-derived provincial segment ranges/);

console.log(JSON.stringify({ ok: true, dataset: payload.dataset, rows: payload.rankConversions.length, sourceId }, null, 2));
