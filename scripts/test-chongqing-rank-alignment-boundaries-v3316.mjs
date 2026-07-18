#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "chongqing.json.gz"))));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const sourceId = "official-chongqing-rank-2025-v3316";
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function zoneFromRank(candidateRank, record) {
  const gap = candidateRank - Number(record.minRankEnd);
  if (gap <= -5000) return "稳";
  if (gap <= -1500) return "稳妥";
  if (gap <= 600) return "临界稳";
  if (gap <= 3500) return "冲";
  return "高冲";
}

function rankAtScore(subjectType, score) {
  const rows = shard.rankConversions.filter((row) => row.sourceId === sourceId && row.subjectType === subjectType);
  const exact = rows.find((row) => {
    const range = row.scoreRange || { min: row.score, max: row.score };
    return score >= Number(range.min) && score <= Number(range.max);
  });
  return exact ? { start: Number(exact.rankStart), end: Number(exact.rankEnd) } : null;
}

assert.deepEqual(rankAtScore("历史类", 700), { start: 1, end: 66 });
assert.deepEqual(rankAtScore("物理类", 700), { start: 1, end: 159 });
assert.deepEqual(rankAtScore("历史类", 600), { start: 1512, end: 1576 });
assert.deepEqual(rankAtScore("物理类", 600), { start: 11421, end: 11716 });
assert.deepEqual(rankAtScore("历史类", 438), { start: 34958, end: 35253 });
assert.deepEqual(rankAtScore("物理类", 425), { start: 102788, end: 103219 });
assert.deepEqual(rankAtScore("历史类", 180), { start: 73370, end: 73373 });
assert.deepEqual(rankAtScore("物理类", 180), { start: 139478, end: 139478 });
assert.equal(rankAtScore("物理类", 179), null);

const physics600 = linked.find((row) => row.sourceId === "official-chongqing-undergraduate-2025-physics-parallel" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 11421);
assert.equal(physics600.minRankEnd, 11716);
assert.equal(zoneFromRank(physics600.minRankEnd, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 600, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 601, physics600), "冲");
assert.equal(zoneFromRank(physics600.minRankEnd + 3501, physics600), "高冲");
assert.equal(zoneFromRank(physics600.minRankEnd - 1500, physics600), "稳妥");
assert.equal(zoneFromRank(physics600.minRankEnd - 5000, physics600), "稳");

assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 19800);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 9094);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 50);
assert.equal(linked.filter((row) => row.subjectType === "历史类" && row.minRankStart === 1).length, 20);
assert.equal(linked.filter((row) => row.subjectType === "物理类" && row.minRankStart === 1).length, 30);

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && row.formalScoreScope === "special-path-only"
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 180
  && Number(row.minScore) <= 750
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 337);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

assert.ok(app.includes('record?.rankEvidenceScope === "score-derived-provincial-segment"'));
assert.ok(app.includes("if (rank > 0 && minRankEnd > 0)"));
assert.ok(app.includes('const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次"'));
assert.ok(app.includes("!isSpecialPathRecord(record)"));

console.log(JSON.stringify({ ok: true, benchmark: { subjectType: "物理类", score: 600, rankStart: 11421, rankEnd: 11716 }, linkedRecords: linked.length, topBucketLinked: 50, specialPathExcluded: excludedSpecial.length }, null, 2));
