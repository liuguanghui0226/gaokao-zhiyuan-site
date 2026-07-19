#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-shanxi-rank-conversion-2025-v3321-import.json"), "utf8"));
const sourceId = "official-shanxi-rank-2025-v3321";

function rankAt(subjectType, score) {
  const row = payload.rankConversions.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd), count: Number(row.sameRankScore) } : null;
}

assert.equal(payload.dataset, "official-shanxi-rank-conversion-2025-v3321-import");
assert.equal(payload.rankConversions.length, 517);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "历史类").length, 230);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "物理类").length, 287);
assert.equal(payload.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 517);

assert.deepEqual(rankAt("历史类", 700), { start: 1, end: 8, count: 8 });
assert.deepEqual(rankAt("历史类", 671), { start: 9, end: 11, count: 3 });
assert.deepEqual(rankAt("历史类", 600), { start: 1836, end: 1918, count: 83 });
assert.deepEqual(rankAt("历史类", 443), { start: 35630, end: 35877, count: 248 });
assert.equal(rankAt("历史类", 442), null);
assert.deepEqual(rankAt("物理类", 710), { start: 1, end: 10, count: 10 });
assert.deepEqual(rankAt("物理类", 704), { start: 11, end: 12, count: 2 });
assert.deepEqual(rankAt("物理类", 600), { start: 10177, end: 10452, count: 276 });
assert.deepEqual(rankAt("物理类", 419), { start: 119736, end: 120285, count: 550 });
assert.equal(rankAt("物理类", 418), null);

assert.equal(payload.audit.htmlRowComparisons, 515);
assert.equal(payload.audit.htmlCellComparisons, 1545);
assert.equal(payload.audit.htmlDifferences, 0);
assert.equal(payload.audit.authorityImageOcrScoreMatches, 509);
assert.equal(payload.audit.authorityImageOcrCumulativeMatches, 514);
assert.equal(payload.audit.authorityImageKnownRecognitionExceptions, 7);
assert.equal(payload.audit.governmentTextCheckpointComparisons, 2);
assert.equal(payload.audit.excludedUnadmittedCandidateSources, 1);

const source = payload.sourceNotes.find((row) => row.id === sourceId);
assert.equal(source.publisher, "山西省招生考试管理中心");
assert.deepEqual(source.publishedScoreFloors, { 历史类: 443, 物理类: 419 });
assert.equal(source.provenance.htmlDifferences, 0);
assert.equal(source.provenance.excludedUnadmittedCandidateTable, true);
assert.ok(source.cautions.some((value) => value.includes("专科段不得由本科表外推")));

console.log(JSON.stringify({ ok: true, sourceId, rankConversions: 517, comparedRows: 515, comparedCells: 1545 }, null, 2));
