#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-tianjin-rank-conversion-2025-v3327-import.json"),
  "utf8",
));

function rankAt(score) {
  const row = payload.rankConversions.find((item) => (
    score >= Number(item.scoreRange?.[0] ?? item.score)
    && score <= Number(item.scoreRange?.[1] ?? item.score)
  ));
  return row ? { start: row.rankStart, end: row.rankEnd, count: row.sameRankScore } : null;
}

assert.deepEqual(rankAt(750), { start: 1, end: 656, count: 656 });
assert.deepEqual(rankAt(680), { start: 1, end: 656, count: 656 });
assert.deepEqual(rankAt(679), { start: 657, end: 722, count: 66 });
assert.deepEqual(rankAt(650), { start: 3289, end: 3422, count: 134 });
assert.deepEqual(rankAt(600), { start: 12739, end: 12965, count: 227 });
assert.deepEqual(rankAt(550), { start: 25588, end: 25874, count: 287 });
assert.deepEqual(rankAt(500), { start: 39954, end: 40233, count: 280 });
assert.deepEqual(rankAt(300), { start: 71904, end: 71938, count: 35 });
assert.equal(rankAt(299), null);
assert.equal(rankAt(751), null);

for (let index = 1; index < payload.rankConversions.length; index += 1) {
  const previous = payload.rankConversions[index - 1];
  const current = payload.rankConversions[index];
  assert.equal(previous.score - current.score, 1);
  assert.equal(current.rankStart, previous.rankEnd + 1);
  assert.equal(current.rankEnd - current.rankStart + 1, current.sameRankScore);
}

console.log("Tianjin 2025 rank alignment boundaries v3.327 tests passed");
