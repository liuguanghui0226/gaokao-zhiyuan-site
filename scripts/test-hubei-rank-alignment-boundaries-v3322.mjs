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
const shard = readGzipJson(path.join(releaseDir, "hubei.json.gz"));
const sourceId = "official-hubei-rank-2025-v3322";
const sourceRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function rankAt(subjectType, score) {
  const row = sourceRanks.find((item) => item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd) } : null;
}

assert.equal(sourceRanks.length, 1313);
assert.deepEqual(rankAt("历史类", 600), { start: 3041, end: 3166 });
assert.deepEqual(rankAt("物理类", 600), { start: 13849, end: 14274 });
assert.deepEqual(rankAt("历史类", 0), { start: 138679, end: 141436 });
assert.deepEqual(rankAt("物理类", 0), { start: 248105, end: 249802 });

assert.equal(linked.length, 7659);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 7069);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 590);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 2591);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 5068);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 4553);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 1900);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 1);
assert.ok(linked.every((row) => row.rankDerivedFromScore && row.rankRangeText.endsWith("（最低分换算）")));

const ordinaryUnranked = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && Number(row.minScore) >= 0
  && Number(row.minScore) <= 750
  && Number.isInteger(Number(row.minScore))
  && row.formalScoreScope !== "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(ordinaryUnranked.length, 0);

const specialExcluded = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && Number(row.minScore) >= 0
  && Number(row.minScore) <= 750
  && Number.isInteger(Number(row.minScore))
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(specialExcluded.length, 196);
assert.ok(specialExcluded.every((row) => row.rankSourceId !== sourceId));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__hubeiRankTest = { state, estimateRankFromScore };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__hubeiRankTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const profile = (score, subject) => ({
  score: String(score),
  province: "湖北",
  subject,
  rankUsage: "",
  rankCategory: "",
  rankLevelUsage: "",
  strategy: "balanced",
});
const history600 = api.estimateRankFromScore(profile(600, "历史类"));
const physics600 = api.estimateRankFromScore(profile(600, "物理类"));
assert.equal(history600.year, 2026);
assert.equal(history600.rank, 3275);
assert.equal(physics600.year, 2026);
assert.equal(physics600.rank, 23608);
assert.ok(history600.sourceTitle.includes("湖北省2026"));

console.log(JSON.stringify({ ok: true, linkedRecords: linked.length, currentScore600: { year: history600.year, historyRank: history600.rank, physicsRank: physics600.rank }, historical2025Score600: { historyRank: rankAt("历史类", 600).end, physicsRank: rankAt("物理类", 600).end }, ordinaryUnranked: ordinaryUnranked.length }, null, 2));
