#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "site/data/release-v3.275/guangdong.json.gz"))));
const sourceId = "official-guangdong-rank-2025-v3331";
const ranks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const findRank = (subjectType, usage, score) => ranks.find((row) => row.subjectType === subjectType && row.rankUsage === usage && row.score === score);
assert.deepEqual(
  ["undergraduate", "vocational"].map((usage) => findRank("历史类", usage, 500).rankEnd),
  [58353, 58355],
);
assert.deepEqual(
  ["undergraduate", "vocational"].map((usage) => findRank("物理类", usage, 500).rankEnd),
  [165626, 165633],
);
assert.deepEqual(
  [findRank("历史类", "undergraduate", 600).rankEnd, findRank("物理类", "undergraduate", 600).rankEnd],
  [5295, 26988],
);
assert.deepEqual(
  [findRank("历史类", "undergraduate", 100).rankEnd, findRank("物理类", "vocational", 100).rankEnd],
  [292200, 440208],
);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 1253);
assert.equal(linked.filter((row) => row.rankUsage === "undergraduate").length, 1251);
assert.equal(linked.filter((row) => row.rankUsage === "vocational").length, 2);
assert.equal(linked.filter((row) => row.formalScoreScope === "special-path-only").length, 0);
assert.ok(linked.every((row) => Number.isInteger(row.minScore) && row.rankDerivedFromScore === true));
const nonIntegerIds = ["2025-52715ad5e413ee62", "2025-9e9c906de503ea2a", "2025-9ea5c5258ecef39a"];
assert.ok(nonIntegerIds.every((id) => !linked.some((row) => row.id === id)));
console.log(JSON.stringify({ status: "ok", linked: linked.length, undergraduate: 1251, vocational: 2 }, null, 2));
