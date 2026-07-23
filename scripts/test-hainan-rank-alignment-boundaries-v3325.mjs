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
const shard = readGzipJson(path.join(releaseDir, "hainan.json.gz"));
const sourceId = "official-hainan-rank-2025-v3325";
const sourceRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function rankAt(score) {
  const row = sourceRanks.find((item) => (
    score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score)
  ));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd) } : null;
}

function hasNumericScore(row) {
  return row.minScore !== null
    && row.minScore !== undefined
    && row.minScore !== ""
    && Number.isInteger(Number(row.minScore));
}

assert.equal(sourceRanks.length, 555);
assert.deepEqual(rankAt(900), { start: 1, end: 105 });
assert.deepEqual(rankAt(800), { start: 1, end: 105 });
assert.deepEqual(rankAt(799), { start: 106, end: 110 });
assert.deepEqual(rankAt(700), { start: 1721, end: 1763 });
assert.deepEqual(rankAt(600), { start: 12011, end: 12182 });
assert.deepEqual(rankAt(500), { start: 37237, end: 37504 });
assert.deepEqual(rankAt(246), { start: 67404, end: 67408 });
assert.equal(rankAt(245), null);

assert.equal(linked.length, 4241);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 3976);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 265);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 2867);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 447);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 56);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 871);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 16);
assert.ok(linked.every((row) => row.subjectType === "综合"));
assert.ok(linked.every((row) => row.rankDerivedFromScore && row.rankRangeText.endsWith("（最低分换算）")));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-comprehensive-filing-score-including-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));

const ordinaryUnranked = shard.records.filter((row) => Number(row.year) === 2025
  && row.subjectType === "综合"
  && hasNumericScore(row)
  && Number(row.minScore) >= 246
  && Number(row.minScore) <= 900
  && row.formalScoreScope !== "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(ordinaryUnranked.length, 0);

const specialExcluded = shard.records.filter((row) => Number(row.year) === 2025
  && row.subjectType === "综合"
  && hasNumericScore(row)
  && Number(row.minScore) >= 246
  && Number(row.minScore) <= 900
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(specialExcluded.length, 35);
assert.ok(specialExcluded.every((row) => row.rankSourceId !== sourceId));

const mislabeledSubjectRows = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && hasNumericScore(row)
  && Number(row.minScore) >= 246
  && Number(row.minScore) <= 900
  && row.formalScoreScope !== "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(mislabeledSubjectRows.length, 87);
assert.equal(mislabeledSubjectRows.filter((row) => row.subjectType === "历史类").length, 4);
assert.equal(mislabeledSubjectRows.filter((row) => row.subjectType === "物理类").length, 83);
assert.ok(mislabeledSubjectRows.every((row) => row.rankSourceId !== sourceId));

const mislabeledSpecialRows = shard.records.filter((row) => Number(row.year) === 2025
  && (row.subjectType === "历史类" || row.subjectType === "物理类")
  && hasNumericScore(row)
  && Number(row.minScore) >= 246
  && Number(row.minScore) <= 900
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(mislabeledSpecialRows.length, 10);
assert.ok(mislabeledSpecialRows.every((row) => row.rankSourceId !== sourceId));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__hainanRankTest = { state, estimateRankFromScore };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__hainanRankTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const current593 = api.estimateRankFromScore({
  score: "593",
  province: "海南",
  subject: "综合",
  rankUsage: "",
  rankCategory: "",
  rankLevelUsage: "",
  strategy: "balanced",
});
assert.equal(current593.year, 2026);
assert.equal(current593.rank, 14034);
assert.equal(current593.rankStart, 13839);
assert.ok(current593.sourceTitle.includes("海南"));

console.log(JSON.stringify({
  ok: true,
  linkedRecords: linked.length,
  currentScore593: { year: current593.year, rank: current593.rank },
  historical2025Score600: rankAt(600),
  ordinaryUnranked: ordinaryUnranked.length,
  specialExcluded: specialExcluded.length,
  mislabeledSubjectRows: mislabeledSubjectRows.length,
}, null, 2));
