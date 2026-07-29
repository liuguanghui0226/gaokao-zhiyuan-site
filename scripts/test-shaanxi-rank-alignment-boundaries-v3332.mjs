#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "site/data/release-v3.275/shaanxi.json.gz"))));
const sourceId = "official-shaanxi-rank-2025-v3332";
const ranks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const findRank = (subjectType, score) => ranks.find((row) => row.subjectType === subjectType && row.score === score && row.rankEstimateUsable !== false);
assert.equal(ranks.length, 1143);
assert.equal(ranks.filter((row) => row.rankEstimateUsable !== false).length, 1141);
assert.deepEqual(
  [findRank("历史类", 600).rankEnd, findRank("物理类", 600).rankEnd],
  [2134, 11374],
);
assert.deepEqual(
  [findRank("历史类", 500).rankEnd, findRank("物理类", 500).rankEnd],
  [17255, 55138],
);
assert.deepEqual(
  [findRank("历史类", 414).rankEnd, findRank("物理类", 394).rankEnd],
  [42525, 128434],
);
assert.deepEqual(
  [findRank("历史类", 200).rankEnd, findRank("物理类", 200).rankEnd],
  [72820, 168847],
);
const guarded = shard.rankConversions.filter((row) => row.containsAbsentCandidates);
assert.equal(guarded.length, 4);
assert.ok(guarded.every((row) => row.rankEstimateUsable === false));
assert.deepEqual(
  guarded.map((row) => row.year).sort(),
  [2025, 2025, 2026, 2026],
);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 992);
assert.equal(linked.filter((row) => row.rankUsage === "undergraduate").length, 986);
assert.equal(linked.filter((row) => row.rankUsage === "vocational").length, 6);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 263);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 729);
assert.equal(linked.filter((row) => row.formalScoreScope === "special-path-only").length, 0);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true && row.rankPolicyBonusIncluded === null));
const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.ok(app.includes("record.rankEstimateUsable !== false"));
console.log(JSON.stringify({ status: "ok", linked: 992, undergraduate: 986, vocational: 6, guarded: 4 }, null, 2));
