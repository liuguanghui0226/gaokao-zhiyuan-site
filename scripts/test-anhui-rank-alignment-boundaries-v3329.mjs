#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-anhui-rank-conversion-2025-v3329-import.json"),
  "utf8",
));

function rankAt(subjectType, score) {
  const row = payload.rankConversions.find((item) => (
    item.subjectType === subjectType
    && score >= Number(item.scoreRange?.[0] ?? item.score)
    && score <= Number(item.scoreRange?.[1] ?? item.score)
  ));
  return row ? { start: row.rankStart, end: row.rankEnd, count: row.sameRankScore } : null;
}

assert.deepEqual(rankAt("历史类", 750), { start: 1, end: 23, count: 23 });
assert.deepEqual(rankAt("历史类", 668), { start: 1, end: 23, count: 23 });
assert.deepEqual(rankAt("历史类", 667), { start: 24, end: 27, count: 4 });
assert.deepEqual(rankAt("历史类", 600), { start: 3286, end: 3415, count: 130 });
assert.deepEqual(rankAt("历史类", 500), { start: 32983, end: 33445, count: 463 });
assert.deepEqual(rankAt("历史类", 400), { start: 84474, end: 85010, count: 537 });
assert.deepEqual(rankAt("历史类", 300), { start: 125491, end: 125754, count: 264 });
assert.deepEqual(rankAt("历史类", 200), { start: 141331, end: 141400, count: 70 });
assert.equal(rankAt("历史类", 199), null);
assert.deepEqual(rankAt("物理类", 750), { start: 1, end: 43, count: 43 });
assert.deepEqual(rankAt("物理类", 691), { start: 1, end: 43, count: 43 });
assert.deepEqual(rankAt("物理类", 690), { start: 44, end: 57, count: 14 });
assert.deepEqual(rankAt("物理类", 600), { start: 26394, end: 27089, count: 696 });
assert.deepEqual(rankAt("物理类", 500), { start: 133576, end: 135050, count: 1475 });
assert.deepEqual(rankAt("物理类", 400), { start: 256702, end: 257548, count: 847 });
assert.deepEqual(rankAt("物理类", 300), { start: 308294, end: 308550, count: 257 });
assert.deepEqual(rankAt("物理类", 200), { start: 320751, end: 320779, count: 29 });
assert.equal(rankAt("物理类", 199), null);

for (const subjectType of ["历史类", "物理类"]) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType);
  for (let index = 1; index < rows.length; index += 1) {
    assert.equal(rows[index - 1].score - rows[index].score, 1);
    assert.equal(rows[index].rankStart, rows[index - 1].rankEnd + 1);
    assert.equal(rows[index].rankEnd - rows[index].rankStart + 1, rows[index].sameRankScore);
  }
}

console.log("Anhui 2025 rank alignment boundaries v3.329 tests passed");
