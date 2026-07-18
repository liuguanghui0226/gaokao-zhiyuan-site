#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(projectRoot, "site/data/release-v3.275/jiangsu.json.gz"))));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const sourceId = "official-jiangsu-rank-2025-v3319";
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function rankAtScore(subjectType, score) {
  const row = shard.rankConversions.find((item) => item.sourceId === sourceId && item.subjectType === subjectType && score >= Number(item.scoreRange?.min ?? item.score) && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd) } : null;
}

assert.deepEqual(rankAtScore("历史类", 700), { start: 1, end: 109 });
assert.deepEqual(rankAtScore("物理类", 720), { start: 1, end: 126 });
assert.deepEqual(rankAtScore("历史类", 600), { start: 5559, end: 5796 });
assert.deepEqual(rankAtScore("物理类", 600), { start: 33986, end: 34888 });
assert.deepEqual(rankAtScore("历史类", 482), { start: 55916, end: 56398 });
assert.deepEqual(rankAtScore("物理类", 463), { start: 204992, end: 205975 });
assert.equal(rankAtScore("历史类", 481), null);
assert.equal(rankAtScore("物理类", 462), null);

assert.equal(linked.length, 7060);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 2003);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 5057);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 8);
assert.ok(linked.every((row) => (row.subjectType === "历史类" ? Number(row.minScore) >= 482 : Number(row.minScore) >= 463)));

const belowFloor = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && row.formalScoreScope !== "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
  && ((row.subjectType === "历史类" && Number(row.minScore) < 482) || (row.subjectType === "物理类" && Number(row.minScore) < 463)));
assert.equal(belowFloor.length, 1496);
assert.deepEqual(Object.fromEntries(["历史类", "物理类"].map((subject) => [subject, belowFloor.filter((row) => row.subjectType === subject).length])), { "历史类": 632, "物理类": 864 });

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
  && ((row.subjectType === "历史类" && Number.isInteger(Number(row.minScore)) && Number(row.minScore) >= 482 && Number(row.minScore) <= 750)
    || (row.subjectType === "物理类" && Number.isInteger(Number(row.minScore)) && Number(row.minScore) >= 463 && Number(row.minScore) <= 750)));
assert.equal(excludedSpecial.length, 123);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

assert.ok(app.includes('record?.rankEvidenceScope === "score-derived-provincial-segment"'));
assert.ok(app.includes("if (rank > 0 && minRankEnd > 0)"));
assert.ok(app.includes('const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次"'));
assert.ok(app.includes("!isSpecialPathRecord(record)"));

console.log(JSON.stringify({ ok: true, benchmark: { subjectType: "物理类", score: 600, rankStart: 33986, rankEnd: 34888 }, linkedRecords: 7060, belowPublishedFloor: 1496, specialPathExcluded: 123 }, null, 2));
