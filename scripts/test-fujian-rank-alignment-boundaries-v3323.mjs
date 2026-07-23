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
const shard = readGzipJson(path.join(releaseDir, "fujian.json.gz"));
const sourceId = "official-fujian-rank-2025-v3323";
const sourceRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function rankAt(subjectType, score) {
  const row = sourceRanks.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd) } : null;
}

function hasNumericScore(row) {
  return row.minScore !== null
    && row.minScore !== undefined
    && row.minScore !== ""
    && Number.isInteger(Number(row.minScore));
}

assert.equal(sourceRanks.length, 932);
assert.deepEqual(rankAt("历史类", 600), { start: 1683, end: 1756 });
assert.deepEqual(rankAt("物理类", 600), { start: 12437, end: 12735 });
assert.equal(rankAt("历史类", 664), null);
assert.deepEqual(rankAt("历史类", 215), { start: 60233, end: 60252 });
assert.deepEqual(rankAt("物理类", 215), { start: 192083, end: 192096 });
assert.equal(rankAt("历史类", 214), null);

assert.equal(linked.length, 7591);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 6353);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1238);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 2772);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 4819);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 10);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 5664);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 0);
assert.ok(linked.every((row) => row.rankDerivedFromScore && row.rankRangeText.endsWith("（最低分换算）")));

const ordinaryUnranked = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && hasNumericScore(row)
  && Number(row.minScore) >= 215
  && Number(row.minScore) <= 750
  && row.formalScoreScope !== "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(ordinaryUnranked.length, 0);

const belowPublishedFloor = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && hasNumericScore(row)
  && Number(row.minScore) < 215
  && row.formalScoreScope !== "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(belowPublishedFloor.length, 1);
assert.ok(belowPublishedFloor.every((row) => row.rankSourceId !== sourceId));

const specialExcluded = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && hasNumericScore(row)
  && Number(row.minScore) >= 215
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(specialExcluded.length, 149);
assert.ok(specialExcluded.every((row) => row.rankSourceId !== sourceId));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__fujianRankTest = { state, estimateRankFromScore };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__fujianRankTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const profile = (score, subject) => ({
  score: String(score),
  province: "福建",
  subject,
  rankUsage: "",
  rankCategory: "",
  rankLevelUsage: "",
  strategy: "balanced",
});
const history600 = api.estimateRankFromScore(profile(600, "历史类"));
const physics600 = api.estimateRankFromScore(profile(600, "物理类"));
assert.equal(history600.year, 2026);
assert.equal(history600.rank, 1896);
assert.equal(physics600.year, 2026);
assert.equal(physics600.rank, 13847);
assert.ok(history600.sourceTitle.includes("福建省2026"));

console.log(JSON.stringify({
  ok: true,
  linkedRecords: linked.length,
  currentScore600: { year: history600.year, historyRank: history600.rank, physicsRank: physics600.rank },
  historical2025Score600: { historyRank: rankAt("历史类", 600).end, physicsRank: rankAt("物理类", 600).end },
  ordinaryUnranked: ordinaryUnranked.length,
  belowPublishedFloor: belowPublishedFloor.length,
}, null, 2));
