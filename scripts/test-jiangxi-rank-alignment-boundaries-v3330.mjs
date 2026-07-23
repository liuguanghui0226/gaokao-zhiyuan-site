#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-jiangxi-rank-conversion-2025-v3330-import.json"),
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

assert.deepEqual(rankAt("历史类", 750), { start: 1, end: 24, count: 24 });
assert.deepEqual(rankAt("历史类", 661), { start: 1, end: 24, count: 24 });
assert.deepEqual(rankAt("历史类", 660), { start: 25, end: 25, count: 1 });
assert.deepEqual(rankAt("历史类", 600), { start: 2107, end: 2199, count: 93 });
assert.deepEqual(rankAt("历史类", 593), { start: 2888, end: 3009, count: 122 });
assert.deepEqual(rankAt("历史类", 441), { start: 76388, end: 76985, count: 598 });
assert.deepEqual(rankAt("历史类", 375), { start: 121362, end: 122112, count: 751 });
assert.deepEqual(rankAt("历史类", 100), { start: 206045, end: 206055, count: 11 });
assert.equal(rankAt("历史类", 99), null);

assert.deepEqual(rankAt("物理类", 750), { start: 1, end: 33, count: 33 });
assert.deepEqual(rankAt("物理类", 676), { start: 1, end: 33, count: 33 });
assert.deepEqual(rankAt("物理类", 675), { start: 34, end: 38, count: 5 });
assert.deepEqual(rankAt("物理类", 600), { start: 8683, end: 8985, count: 303 });
assert.deepEqual(rankAt("物理类", 593), { start: 11123, end: 11496, count: 374 });
assert.deepEqual(rankAt("物理类", 572), { start: 20571, end: 21129, count: 559 });
assert.equal(rankAt("物理类", 117), null);
assert.deepEqual(rankAt("物理类", 116), { start: 266372, end: 266375, count: 4 });
assert.equal(rankAt("物理类", 101), null);
assert.deepEqual(rankAt("物理类", 100), { start: 266423, end: 266425, count: 3 });
assert.equal(rankAt("物理类", 99), null);

for (const subjectType of ["历史类", "物理类"]) {
  const rows = payload.rankConversions.filter((row) => row.subjectType === subjectType);
  const omitted = [];
  for (let index = 1; index < rows.length; index += 1) {
    for (let score = rows[index - 1].score - 1; score > rows[index].score; score -= 1) omitted.push(score);
    assert.equal(rows[index].rankStart, rows[index - 1].rankEnd + 1);
    assert.equal(rows[index].rankEnd - rows[index].rankStart + 1, rows[index].sameRankScore);
  }
  assert.deepEqual(omitted, subjectType === "历史类" ? [] : [117, 101]);
}

console.log("Jiangxi 2025 rank alignment boundaries v3.330 tests passed");
