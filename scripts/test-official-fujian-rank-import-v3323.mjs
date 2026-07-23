#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-fujian-rank-conversion-2025-v3323-import.json"), "utf8"));
const sourceId = "official-fujian-rank-2025-v3323";

function rankAt(subjectType, score) {
  const row = payload.rankConversions.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd), count: Number(row.sameRankScore) } : null;
}

assert.equal(payload.dataset, "official-fujian-rank-conversion-2025-v3323-import");
assert.equal(payload.rankConversions.length, 932);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "历史类").length, 457);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "物理类").length, 475);
assert.equal(payload.rankConversions.filter((row) => row.topWithheldRange).length, 2);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 932);

assert.deepEqual(rankAt("历史类", 750), { start: 1, end: 14, count: 14 });
assert.deepEqual(rankAt("历史类", 671), { start: 15, end: 15, count: 1 });
assert.equal(rankAt("历史类", 664), null);
assert.deepEqual(rankAt("历史类", 600), { start: 1683, end: 1756, count: 74 });
assert.deepEqual(rankAt("历史类", 441), { start: 27400, end: 27621, count: 222 });
assert.deepEqual(rankAt("历史类", 215), { start: 60233, end: 60252, count: 20 });
assert.equal(rankAt("历史类", 214), null);
assert.deepEqual(rankAt("物理类", 750), { start: 1, end: 46, count: 46 });
assert.deepEqual(rankAt("物理类", 688), { start: 47, end: 58, count: 12 });
assert.deepEqual(rankAt("物理类", 600), { start: 12437, end: 12735, count: 299 });
assert.deepEqual(rankAt("物理类", 450), { start: 110889, end: 111729, count: 841 });
assert.deepEqual(rankAt("物理类", 215), { start: 192083, end: 192096, count: 14 });
assert.equal(rankAt("物理类", 214), null);

assert.equal(payload.audit.structuredRows, 933);
assert.equal(payload.audit.officialImageRows, 930);
assert.equal(payload.audit.officialImageCellsCompared, 2790);
assert.equal(payload.audit.zeroCandidateRows, 1);
assert.equal(payload.audit.allCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksContinuous, true);
assert.equal(payload.audit.officialImages, 8);
assert.equal(payload.audit.imageOcrRowsCompared, 930);
assert.deepEqual(payload.audit.imageOcrMatches, {
  score: 459,
  people: 465,
  cumulative: 438,
  all: 400,
  scoreCumulative: 419,
});
assert.equal(Object.keys(payload.audit.evidenceSha256).length, 36);

const source = payload.sourceNotes.find((row) => row.id === sourceId);
assert.equal(source.publisher, "福建省教育考试院");
assert.deepEqual(source.publishedScoreFloors, { 历史类: 215, 物理类: 215 });
assert.equal(source.provenance.structuredRows, 933);
assert.equal(source.provenance.officialImageRows, 930);
assert.equal(source.provenance.imageOcrCumulativeMatches, 438);
assert.ok(source.cautions.some((value) => value.includes("664分为0人")));
assert.ok(source.cautions.some((value) => value.includes("低于215分")));

console.log(JSON.stringify({ ok: true, sourceId, rankConversions: 932, comparedRows: 930, comparedCells: 2790 }, null, 2));
