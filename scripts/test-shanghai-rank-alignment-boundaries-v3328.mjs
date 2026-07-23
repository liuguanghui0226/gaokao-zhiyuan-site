#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-shanghai-rank-conversion-2025-v3328-import.json"),
  "utf8",
));

function rankAt(score) {
  const row = payload.rankConversions.find((item) => (
    score >= Number(item.scoreRange?.[0] ?? item.score)
    && score <= Number(item.scoreRange?.[1] ?? item.score)
  ));
  return row ? { start: row.rankStart, end: row.rankEnd, count: row.sameRankScore } : null;
}

assert.deepEqual(rankAt(660), { start: 1, end: 52, count: 52 });
assert.deepEqual(rankAt(623), { start: 1, end: 52, count: 52 });
assert.deepEqual(rankAt(622), { start: 53, end: 64, count: 12 });
assert.deepEqual(rankAt(621), { start: 65, end: 75, count: 11 });
assert.deepEqual(rankAt(600), { start: 1147, end: 1250, count: 104 });
assert.deepEqual(rankAt(550), { start: 10255, end: 10506, count: 252 });
assert.deepEqual(rankAt(500), { start: 23964, end: 24251, count: 288 });
assert.deepEqual(rankAt(450), { start: 37915, end: 38181, count: 267 });
assert.deepEqual(rankAt(402), { start: 49070, end: 49276, count: 207 });
assert.equal(rankAt(401), null);
assert.equal(rankAt(661), null);

for (let index = 1; index < payload.rankConversions.length; index += 1) {
  const previous = payload.rankConversions[index - 1];
  const current = payload.rankConversions[index];
  assert.equal(previous.score - current.score, 1);
  assert.equal(current.rankStart, previous.rankEnd + 1);
  assert.equal(current.rankEnd - current.rankStart + 1, current.sameRankScore);
}

console.log("Shanghai 2025 rank alignment boundaries v3.328 tests passed");
