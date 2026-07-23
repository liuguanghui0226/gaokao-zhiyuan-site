#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hubei-rank-conversion-2025-v3322-import.json"), "utf8"));
const sourceId = "official-hubei-rank-2025-v3322";

function rankAt(subjectType, score) {
  const row = payload.rankConversions.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd), count: Number(row.sameRankScore) } : null;
}

assert.equal(payload.dataset, "official-hubei-rank-conversion-2025-v3322-import");
assert.equal(payload.rankConversions.length, 1313);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "历史类").length, 650);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "物理类").length, 663);
assert.equal(payload.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1313);

assert.deepEqual(rankAt("历史类", 700), { start: 1, end: 15, count: 15 });
assert.deepEqual(rankAt("历史类", 673), { start: 16, end: 17, count: 2 });
assert.deepEqual(rankAt("历史类", 600), { start: 3041, end: 3166, count: 126 });
assert.deepEqual(rankAt("历史类", 442), { start: 50551, end: 50955, count: 405 });
assert.deepEqual(rankAt("历史类", 0), { start: 138679, end: 141436, count: 2758 });
assert.equal(rankAt("历史类", -1), null);
assert.deepEqual(rankAt("物理类", 710), { start: 1, end: 22, count: 22 });
assert.deepEqual(rankAt("物理类", 691), { start: 23, end: 25, count: 3 });
assert.deepEqual(rankAt("物理类", 600), { start: 13849, end: 14274, count: 426 });
assert.deepEqual(rankAt("物理类", 426), { start: 147881, end: 148657, count: 777 });
assert.deepEqual(rankAt("物理类", 0), { start: 248105, end: 249802, count: 1698 });
assert.equal(rankAt("物理类", -1), null);

assert.equal(payload.audit.officialPdfRows, 1311);
assert.equal(payload.audit.officialPdfCellsValidated, 3933);
assert.equal(payload.audit.allCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksContinuous, true);
assert.equal(payload.audit.officialImages, 12);
assert.equal(payload.audit.imageOcrRowsCompared, 1311);
assert.deepEqual(payload.audit.imageOcrMatches, {
  score: 1276,
  people: 1046,
  cumulative: 1289,
  all: 1024,
  scoreCumulative: 1260,
});

const source = payload.sourceNotes.find((row) => row.id === sourceId);
assert.ok(source.publisher.includes("湖北省招办"));
assert.deepEqual(source.publishedScoreFloors, { 历史类: 0, 物理类: 0 });
assert.equal(source.provenance.officialPdfRows, 1311);
assert.equal(source.provenance.imageOcrCumulativeMatches, 1289);
assert.ok(source.cautions.some((value) => value.includes("含政策性加分")));

console.log(JSON.stringify({ ok: true, sourceId, rankConversions: 1313, comparedRows: 1311, comparedCells: 3933 }, null, 2));
