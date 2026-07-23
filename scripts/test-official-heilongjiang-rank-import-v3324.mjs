#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-heilongjiang-rank-conversion-2025-v3324-import.json"), "utf8"));
const sourceId = "official-heilongjiang-rank-2025-v3324";

function rankAt(subjectType, score) {
  const row = payload.rankConversions.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd), count: Number(row.sameRankScore) } : null;
}

assert.equal(payload.dataset, "official-heilongjiang-rank-conversion-2025-v3324-import");
assert.equal(payload.rankConversions.length, 1091);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "历史类").length, 528);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "物理类").length, 563);
assert.equal(payload.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1091);

assert.deepEqual(rankAt("历史类", 750), { start: 1, end: 19, count: 19 });
assert.deepEqual(rankAt("历史类", 658), { start: 20, end: 21, count: 2 });
assert.equal(rankAt("历史类", 654), null);
assert.equal(rankAt("历史类", 144), null);
assert.deepEqual(rankAt("历史类", 600), { start: 800, end: 846, count: 47 });
assert.deepEqual(rankAt("历史类", 405), { start: 22738, end: 22977, count: 240 });
assert.deepEqual(rankAt("历史类", 130), { start: 54707, end: 54707, count: 1 });
assert.equal(rankAt("历史类", 129), null);
assert.deepEqual(rankAt("物理类", 750), { start: 1, end: 34, count: 34 });
assert.deepEqual(rankAt("物理类", 693), { start: 35, end: 39, count: 5 });
assert.equal(rankAt("物理类", 136), null);
assert.equal(rankAt("物理类", 134), null);
assert.deepEqual(rankAt("物理类", 600), { start: 5844, end: 5997, count: 154 });
assert.deepEqual(rankAt("物理类", 360), { start: 84951, end: 85313, count: 363 });
assert.deepEqual(rankAt("物理类", 130), { start: 117407, end: 117407, count: 1 });
assert.equal(rankAt("物理类", 129), null);

assert.equal(payload.audit.officialXlsTableRows, 1093);
assert.equal(payload.audit.officialPositiveRows, 1091);
assert.equal(payload.audit.eolTableRows, 1094);
assert.equal(payload.audit.rowComparisons, 1091);
assert.equal(payload.audit.cellComparisons, 3273);
assert.equal(payload.audit.sourceDifferences, 0);
assert.equal(payload.audit.rawCountCellAnomalies, 2);
assert.deepEqual(payload.audit.zeroScoreGaps, { 历史类: [654, 144], 物理类: [136, 134] });
assert.equal(payload.audit.bottomWithheldBuckets, 2);
assert.equal(payload.audit.allDerivedCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksContinuous, true);
assert.equal(payload.audit.scoreBasis, "gaokao-cultural-score-excluding-policy-bonus");
assert.equal(Object.keys(payload.audit.evidenceSha256).length, 7);

const source = payload.sourceNotes.find((row) => row.id === sourceId);
assert.equal(source.publisher, "黑龙江省招生考试院");
assert.deepEqual(source.publishedScoreFloors, { 历史类: 130, 物理类: 130 });
assert.equal(source.scoreBasis, "gaokao-cultural-score-excluding-policy-bonus");
assert.equal(source.provenance.officialPositiveRows, 1091);
assert.equal(source.provenance.cellComparisons, 3273);
assert.equal(source.provenance.rawCountCellAnomalies.length, 2);
assert.ok(source.cautions.some((value) => value.includes("不含照顾政策分")));
assert.ok(source.cautions.some((value) => value.includes("654、144分")));
assert.ok(source.cautions.some((value) => value.includes("129分及以下")));

console.log(JSON.stringify({ ok: true, sourceId, rankConversions: 1091, comparedRows: 1091, comparedCells: 3273 }, null, 2));
