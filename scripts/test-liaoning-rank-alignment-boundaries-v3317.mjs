#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "liaoning.json.gz"))));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const sourceId = "official-liaoning-rank-2025-v3317";
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

assert.deepEqual(rankAtScore("历史类", 700), { start: 1, end: 10 });
assert.deepEqual(rankAtScore("物理类", 720), { start: 1, end: 11 });
assert.deepEqual(rankAtScore("历史类", 600), { start: 1963, end: 2025 });
assert.deepEqual(rankAtScore("物理类", 600), { start: 13272, end: 13601 });
assert.deepEqual(rankAtScore("历史类", 437), { start: 26702, end: 26916 });
assert.deepEqual(rankAtScore("物理类", 367), { start: 117758, end: 118109 });
assert.deepEqual(rankAtScore("历史类", 150), { start: 56322, end: 56324 });
assert.deepEqual(rankAtScore("物理类", 150), { start: 143367, end: 143368 });
assert.equal(rankAtScore("历史类", 667), null);
assert.equal(rankAtScore("物理类", 703), null);
assert.equal(rankAtScore("物理类", 149), null);

const physics600 = linked.find((row) => row.sourceId === "official-liaoning-2025-filing-undergrad-physics" && row.minScore === 600);
assert.ok(physics600);
assert.equal(physics600.minRankStart, 13272);
assert.equal(physics600.minRankEnd, 13601);
assert.equal(zoneFromRank(physics600.minRankEnd, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 600, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 601, physics600), "冲");
assert.equal(zoneFromRank(physics600.minRankEnd + 3501, physics600), "高冲");
assert.equal(zoneFromRank(physics600.minRankEnd - 1500, physics600), "稳妥");
assert.equal(zoneFromRank(physics600.minRankEnd - 5000, physics600), "稳");

assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 15794);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 5789);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 0);
assert.ok(linked.every((row) => Number(row.minScore) !== 667 || row.subjectType !== "历史类"));
assert.ok(linked.every((row) => Number(row.minScore) !== 703 || row.subjectType !== "物理类"));

const excludedSpecial = shard.records.filter((row) => Number(row.year) === 2025
  && row.formalScoreScope === "special-path-only"
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 150
  && Number(row.minScore) <= 750
  && !Number(row.minRankEnd || row.minRank));
assert.equal(excludedSpecial.length, 41);
assert.ok(excludedSpecial.every((row) => row.rankSourceId !== sourceId));

assert.ok(app.includes('record?.rankEvidenceScope === "score-derived-provincial-segment"'));
assert.ok(app.includes("if (rank > 0 && minRankEnd > 0)"));
assert.ok(app.includes('const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次"'));
assert.ok(app.includes("!isSpecialPathRecord(record)"));

console.log(JSON.stringify({ ok: true, benchmark: { subjectType: "物理类", score: 600, rankStart: 13272, rankEnd: 13601 }, linkedRecords: linked.length, topBucketLinked: 0, specialPathExcluded: excludedSpecial.length }, null, 2));
