#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-chongqing-rank-conversion-2025-v3316-import.json"), "utf8"));
const sourceId = "official-chongqing-rank-2025-v3316";
const quality = "official-content-mirror-eol-chongqing-exam-authority-linked-full-table-dxsbb-cross-verified";

assert.equal(payload.dataset, "official-chongqing-rank-conversion-2025-v3316-import");
assert.equal(payload.sourceId, sourceId);
assert.equal(payload.rankConversions.length, 975);
assert.equal(payload.audit.parsedRecords, 975);
assert.equal(payload.audit.duplicateIds, 0);
assert.deepEqual(payload.audit.primaryRows, { "历史类": 473, "物理类": 502 });
assert.deepEqual(payload.audit.mirrorRows, { "历史类": 473, "物理类": 502 });
assert.equal(payload.audit.fullTableComparisons, 975);
assert.equal(payload.audit.fullCellComparisons, 2925);
assert.equal(payload.audit.fullTableDifferences, 0);
assert.equal(payload.audit.allScoreRowsContiguous, true);
assert.equal(payload.audit.allCumulativeRanksMonotonic, true);
assert.equal(payload.audit.allPublishedCountsClose, true);
assert.equal(payload.audit.authorityLinksPreservedByTwoIndexes, true);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 975);

const expected = {
  "历史类": { rows: 473, topScore: 652, topEnd: 66, bottomEnd: 73373, checkpoints: { 600: 1576, 500: 17717, 438: 35253, 300: 68711, 180: 73373 } },
  "物理类": { rows: 502, topScore: 681, topEnd: 159, bottomEnd: 139478, checkpoints: { 600: 11716, 500: 62078, 425: 103219, 300: 134938, 180: 139478 } },
};

for (const [subjectType, config] of Object.entries(expected)) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType).sort((left, right) => right.score - left.score);
  assert.equal(rows.length, config.rows);
  assert.equal(rows[0].score, config.topScore);
  assert.equal(rows[0].rankStart, 1);
  assert.equal(rows[0].rankEnd, config.topEnd);
  assert.deepEqual(rows[0].scoreRange, { min: config.topScore, max: 750 });
  assert.equal(rows.at(-1).score, 180);
  assert.equal(rows.at(-1).rankEnd, config.bottomEnd);
  assert.equal(rows.reduce((sum, row) => sum + row.sameRankScore, 0), config.bottomEnd);
  assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1));
  assert.ok(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1));
  assert.ok(rows.every((row) => row.sourceId === sourceId && row.sourceQuality === quality));
  for (const [score, rankEnd] of Object.entries(config.checkpoints)) {
    assert.equal(rows.find((row) => row.score === Number(score)).rankEnd, rankEnd);
  }
}

const source = payload.sourceNotes[0];
assert.equal(source.id, sourceId);
assert.equal(source.publisher, "重庆市教育考试院");
assert.equal(source.parsedRecords, 975);
assert.deepEqual(source.subjectBreakdown, { "历史类": 473, "物理类": 502 });
assert.equal(source.provenance.authorityAttributed, true);
assert.equal(source.provenance.officialDirectRetrievalStatus, "tls-unavailable-current-session");
assert.equal(source.provenance.fullTableComparisons, 975);
assert.equal(source.provenance.fullCellComparisons, 2925);
assert.match(source.provenance.verification, /all 975 rows and 2925/);
assert.equal(source.provenance.evidenceSha256["eol-history.html"], "da546a8a61c6820c70b9e177ff24cca9bf4c0d5f13bf5e4be184b413220893d0");
assert.equal(source.provenance.evidenceSha256["eol-physics.html"], "7338bf36ddb86e5bcf1cdb34eb6d2c9b5728b735cf3a486db16af7c8343f66a0");
assert.equal(source.provenance.evidenceSha256["dxsbb-history.html"], "5c3afc936a45c310d18d9c3e0273085265bb53b37f52b714415b5326170a4b59");
assert.equal(source.provenance.evidenceSha256["dxsbb-physics.html"], "a73d7af925c6389c4a3b34fe28b9526fe7e3e31dde54c1f233df1292ce2ea413");
assert.match(source.evidenceBoundary, /score-derived provincial segment ranges/);

console.log(JSON.stringify({ ok: true, dataset: payload.dataset, rows: payload.rankConversions.length, cellsCompared: payload.audit.fullCellComparisons, sourceId }, null, 2));
