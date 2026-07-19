#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const readGzipJson = (file) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const shard = readGzipJson(path.join(releaseDir, "shanxi.json.gz"));
const sourceId = "official-shanxi-rank-2025-v3321";
const sourceRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function rankAt(subjectType, score) {
  const row = sourceRanks.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd) } : null;
}

assert.equal(sourceRanks.length, 517);
assert.deepEqual(rankAt("历史类", 600), { start: 1836, end: 1918 });
assert.deepEqual(rankAt("物理类", 600), { start: 10177, end: 10452 });
assert.equal(rankAt("历史类", 442), null);
assert.equal(rankAt("物理类", 418), null);

assert.equal(linked.length, 6587);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 5826);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 761);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 2064);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 4523);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 5132);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 130);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 0);
assert.ok(linked.every((row) => row.rankDerivedFromScore && row.rankRangeText.endsWith("（最低分换算）")));

const belowFloor = shard.records.filter((row) => Number(row.year) === 2025
  && ((row.subjectType === "历史类" && Number(row.minScore) < 443) || (row.subjectType === "物理类" && Number(row.minScore) < 419))
  && Number.isInteger(Number(row.minScore))
  && !Number(row.minRankEnd || row.minRank));
assert.equal(belowFloor.length, 2100);
assert.ok(belowFloor.every((row) => row.rankSourceId !== sourceId));

const specialExcluded = shard.records.filter((row) => Number(row.year) === 2025
  && ((row.subjectType === "历史类" && Number(row.minScore) >= 443) || (row.subjectType === "物理类" && Number(row.minScore) >= 419))
  && Number.isInteger(Number(row.minScore))
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(specialExcluded.length, 75);
assert.ok(specialExcluded.every((row) => row.rankSourceId !== sourceId));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__shanxiRankTest = { state, estimateRankFromScore };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__shanxiRankTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const profile = (score, subject) => ({
  score: String(score),
  province: "山西",
  subject,
  rankUsage: "",
  rankCategory: "",
  rankLevelUsage: "",
  strategy: "balanced",
});
const history600 = api.estimateRankFromScore(profile(600, "历史类"));
const physics600 = api.estimateRankFromScore(profile(600, "物理类"));
assert.equal(history600.year, 2026);
assert.equal(history600.rank, 1649);
assert.equal(physics600.year, 2026);
assert.equal(physics600.rank, 14366);
assert.ok(history600.sourceTitle.includes("山西省2026"));

console.log(JSON.stringify({ ok: true, linkedRecords: linked.length, currentScore600: { year: history600.year, historyRank: history600.rank, physicsRank: physics600.rank }, historical2025Score600: { historyRank: rankAt("历史类", 600).end, physicsRank: rankAt("物理类", 600).end }, belowFloorUnranked: belowFloor.length }, null, 2));
