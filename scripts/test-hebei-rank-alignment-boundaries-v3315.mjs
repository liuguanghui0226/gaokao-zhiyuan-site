#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, "hebei.json.gz"))));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const sourceId = "official-hebei-rank-2025-v3315";
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

assert.deepEqual(rankAtScore("物理类", 700), { start: 1, end: 32 });
assert.deepEqual(rankAtScore("历史类", 679), { start: 1, end: 35 });
assert.deepEqual(rankAtScore("物理类", 600), { start: 26288, end: 27073 });
assert.deepEqual(rankAtScore("历史类", 600), { start: 5760, end: 6004 });
assert.deepEqual(rankAtScore("物理类", 459), { start: 222851, end: 224230 });
assert.deepEqual(rankAtScore("历史类", 477), { start: 64258, end: 64897 });
assert.deepEqual(rankAtScore("物理类", 200), { start: 361426, end: 361477 });
assert.deepEqual(rankAtScore("历史类", 200), { start: 236272, end: 236503 });
assert.equal(rankAtScore("物理类", 139), null);

const physics600 = linked.find((row) => row.sourceId === "official-hebei-undergraduate-filing-2025-physics" && row.minScore === 600);
assert.ok(physics600);
assert.equal(zoneFromRank(physics600.minRankEnd, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 600, physics600), "临界稳");
assert.equal(zoneFromRank(physics600.minRankEnd + 601, physics600), "冲");
assert.equal(zoneFromRank(physics600.minRankEnd + 3500, physics600), "冲");
assert.equal(zoneFromRank(physics600.minRankEnd + 3501, physics600), "高冲");
assert.equal(zoneFromRank(physics600.minRankEnd - 1500, physics600), "稳妥");
assert.equal(zoneFromRank(physics600.minRankEnd - 5000, physics600), "稳");

const ordinaryUndergraduate = linked.filter((row) => row.dataType === "major-admission" && /本科/.test(row.batch || ""));
const ordinaryVocational = linked.filter((row) => row.dataType === "vocational-admission");
assert.ok(ordinaryUndergraduate.length > 25000);
assert.ok(ordinaryVocational.length > 20000);
assert.ok(ordinaryUndergraduate.some((row) => ["稳", "稳妥", "临界稳", "冲", "高冲"].includes(zoneFromRank(27073, row))));
assert.ok(ordinaryVocational.some((row) => ["稳", "稳妥", "临界稳", "冲", "高冲"].includes(zoneFromRank(361477, row))));

const special = shard.records.filter((row) => Number(row.year) === 2025
  && row.formalScoreScope === "special-path-only"
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 140
  && Number(row.minScore) <= 750);
assert.ok(special.length >= 157);
assert.equal(special.filter((row) => row.rankSourceId === sourceId).length, 0);

assert.ok(app.includes('record?.rankEvidenceScope === "score-derived-provincial-segment"'));
assert.ok(app.includes("if (rank > 0 && minRankEnd > 0)"));
assert.ok(app.includes('const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次"'));
assert.ok(app.includes("!isSpecialPathRecord(record)"));

console.log(JSON.stringify({
  ok: true,
  benchmark: { subjectType: "物理类", score: 600, rankEnd: 27073 },
  linkedRecords: linked.length,
  undergraduatePool: ordinaryUndergraduate.length,
  vocationalPool: ordinaryVocational.length,
  specialPathExcluded: special.filter((row) => !row.rankSourceId).length,
}, null, 2));
