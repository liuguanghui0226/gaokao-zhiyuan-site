#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "hunan.json.gz"))));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const sourceId = "official-hunan-rank-2025-v3318";
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

assert.deepEqual(rankAtScore("历史类", 700), { start: 1, end: 55 });
assert.deepEqual(rankAtScore("物理类", 720), { start: 1, end: 53 });
assert.deepEqual(rankAtScore("历史类", 600), { start: 2274, end: 2369 });
assert.deepEqual(rankAtScore("物理类", 600), { start: 15423, end: 15860 });
assert.deepEqual(rankAtScore("历史类", 446), { start: 52546, end: 53081 });
assert.deepEqual(rankAtScore("物理类", 422), { start: 189316, end: 190592 });
assert.deepEqual(rankAtScore("历史类", 100), { start: 141153, end: 141153 });
assert.deepEqual(rankAtScore("物理类", 100), { start: 318820, end: 318823 });
assert.equal(rankAtScore("历史类", 129), null);
assert.equal(rankAtScore("物理类", 107), null);
assert.equal(rankAtScore("物理类", 99), null);

const physics600 = linked.find((row) => row.sourceId === "official-hunan-undergraduate-filing-2025" && row.subjectType === "物理类" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 15423);
assert.equal(physics600.minRankEnd, 15860);
assert.equal(zoneFromRank(physics600.minRankEnd, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 600, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 601, physics600), "冲");
assert.equal(zoneFromRank(physics600.minRankEnd + 3501, physics600), "高冲");
assert.equal(zoneFromRank(physics600.minRankEnd - 1500, physics600), "稳妥");
assert.equal(zoneFromRank(physics600.minRankEnd - 5000, physics600), "稳");

assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1483);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 2330);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 5);
assert.ok(linked.every((row) => Number(row.minScore) !== 129 || row.subjectType !== "历史类"));
assert.ok(linked.every((row) => Number(row.minScore) !== 107 || row.subjectType !== "物理类"));

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && row.formalScoreScope === "special-path-only"
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 100
  && Number(row.minScore) <= 750
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 388);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

assert.ok(app.includes('record?.rankEvidenceScope === "score-derived-provincial-segment"'));
assert.ok(app.includes("if (rank > 0 && minRankEnd > 0)"));
assert.ok(app.includes('const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次"'));
assert.ok(app.includes("!isSpecialPathRecord(record)"));

console.log(JSON.stringify({ ok: true, benchmark: { subjectType: "物理类", score: 600, rankStart: 15423, rankEnd: 15860 }, linkedRecords: linked.length, topBucketLinked: 5, specialPathExcluded: excludedSpecial.length }, null, 2));
