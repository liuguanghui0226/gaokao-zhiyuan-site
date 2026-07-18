#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "ningxia.json.gz"))));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const filingRows = shard.records.filter((row) => row.sourceId === "official-ningxia-undergraduate-b-2025");

function zoneFromRank(candidateRank, record) {
  const gap = candidateRank - Number(record.minRankEnd);
  if (gap <= -5000) return "稳";
  if (gap <= -1500) return "稳妥";
  if (gap <= 600) return "临界稳";
  if (gap <= 3500) return "冲";
  return "高冲";
}

function latestRankAtScore(subjectType, score) {
  const rows = shard.rankConversions.filter((row) => row.subjectType === subjectType && Number(row.year) === 2026);
  const exact = rows.find((row) => {
    const range = row.scoreRange || { min: row.score, max: row.score };
    return score >= Number(range.min) && score <= Number(range.max);
  });
  return exact ? Number(exact.rankEnd) : null;
}

const history404 = filingRows.find((row) => row.schoolName === "黑龙江大学" && row.subjectType === "历史类" && row.minScore === 404);
assert.ok(history404);
assert.equal(zoneFromRank(history404.minRankEnd, history404), "临界稳");
assert.equal(zoneFromRank(history404.minRankEnd + 600, history404), "临界稳");
assert.equal(zoneFromRank(history404.minRankEnd + 601, history404), "冲");
assert.equal(zoneFromRank(history404.minRankEnd - 1500, history404), "稳妥");
assert.equal(zoneFromRank(history404.minRankEnd - 5000, history404), "稳");

const candidateRank = latestRankAtScore("历史类", 593);
assert.ok(candidateRank > 0, "Latest 2026 history rank conversion must estimate a candidate rank");
const comparableOrdinary = filingRows.filter((row) => row.subjectType === "历史类" && row.formalScoreScope === "ordinary" && Number(row.minRankEnd) > 0);
const comparableSpecial = filingRows.filter((row) => row.subjectType === "历史类" && row.formalScoreScope === "special-path-only" && Number(row.minRankEnd) > 0);
assert.ok(comparableOrdinary.length > 500);
assert.ok(comparableSpecial.length > 0);
assert.ok(comparableOrdinary.some((row) => ["稳", "稳妥", "临界稳", "冲", "高冲"].includes(zoneFromRank(candidateRank, row))));
assert.ok(comparableSpecial.every((row) => row.formalScoreScope === "special-path-only"), "Special pathways must remain excluded from the ordinary pool");

const topHistory = filingRows.filter((row) => row.subjectType === "历史类" && row.minScore > 616);
const topPhysics = filingRows.filter((row) => row.subjectType === "物理类" && row.minScore > 641);
assert.equal(topHistory.length, 7);
assert.equal(topPhysics.length, 11);
assert.ok(topHistory.every((row) => row.minRankStart === 1 && row.minRankEnd === 54));
assert.ok(topPhysics.every((row) => row.minRankStart === 1 && row.minRankEnd === 104));
assert.ok(topHistory.concat(topPhysics).every((row) => row.cautions.some((text) => text.includes("不生成合并档内的伪精确位次"))));

assert.ok(app.includes('record?.rankEvidenceScope === "score-derived-provincial-segment"'));
assert.ok(app.includes("if (rank > 0 && minRankEnd > 0)"));
assert.ok(app.includes('const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次"'));

console.log(JSON.stringify({ ok: true, candidate: { subjectType: "历史类", score: 593, rank: candidateRank }, ordinaryPool: comparableOrdinary.length, specialPathExcluded: comparableSpecial.length }, null, 2));
