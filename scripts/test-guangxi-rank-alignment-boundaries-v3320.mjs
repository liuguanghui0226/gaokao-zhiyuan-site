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
const shard = readGzipJson(path.join(releaseDir, "guangxi.json.gz"));
const sourceId = "official-guangxi-rank-2025-v3320";
const sourceRanks = shard.rankConversions.filter((row) => row.sourceId === sourceId);
const linked = shard.records.filter((row) => row.rankSourceId === sourceId);

function rankAt(scope, subjectType, score) {
  const row = sourceRanks.find((item) => item.rankInstitutionScope === scope
    && item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd) } : null;
}

assert.equal(sourceRanks.length, 1896);
assert.deepEqual(rankAt("outside-guangxi", "历史类", 600), { start: 1248, end: 1291 });
assert.deepEqual(rankAt("inside-guangxi", "历史类", 600), { start: 1257, end: 1298 });
assert.deepEqual(rankAt("outside-guangxi", "物理类", 600), { start: 6205, end: 6442 });
assert.deepEqual(rankAt("inside-guangxi", "物理类", 600), { start: 6236, end: 6473 });

assert.equal(linked.length, 8222);
assert.equal(linked.filter((row) => row.rankInstitutionScope === "outside-guangxi").length, 7018);
assert.equal(linked.filter((row) => row.rankInstitutionScope === "inside-guangxi").length, 1204);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 7554);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 668);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 2826);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 5396);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 5062);
assert.equal(linked.filter((row) => row.dataType === "vocational-admission").length, 1871);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 1);
assert.ok(linked.every((row) => row.scoreBonusScope === (row.rankInstitutionScope === "inside-guangxi" ? "national-or-local-max" : "national-bonus-only")));

const beijing = linked.find((row) => row.schoolName === "北京大学" && row.sourceId === "official-guangxi-undergraduate-2025-gxeea-html-table");
const guangxi = linked.find((row) => row.schoolName === "广西大学" && row.sourceId === "official-guangxi-undergraduate-2025-gxeea-html-table");
assert.equal(beijing?.rankInstitutionScope, "outside-guangxi");
assert.equal(guangxi?.rankInstitutionScope, "inside-guangxi");
assert.ok(beijing?.rankRangeText.includes("区外院校全国性加分"));
assert.ok(guangxi?.rankRangeText.includes("区内院校最高加分"));

const specialExcluded = shard.records.filter((row) => Number(row.year) === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 200
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank));
assert.equal(specialExcluded.length, 110);
assert.ok(specialExcluded.every((row) => row.rankSourceId !== sourceId));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__guangxiRankTest = {
  state,
  estimateRankFromScore,
  admissionFit,
  profileRankForAdmissionRecord,
  profileScoreForAdmissionRecord,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__guangxiRankTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = shard.records;
api.state.data.admissionScoreLayer.rankConversions = shard.rankConversions;

const profile = {
  score: "600",
  guangxiLocalScore: "600",
  rank: "6442",
  guangxiLocalRank: "6473",
  province: "广西",
  subject: "物理类",
  rankUsage: "",
  rankCategory: "",
  rankLevelUsage: "",
  candidateCategory: "",
};
const outsideEstimate = api.estimateRankFromScore(profile, "outside-guangxi");
const insideEstimate = api.estimateRankFromScore(profile, "inside-guangxi");
assert.equal(outsideEstimate.rank, 6442);
assert.equal(outsideEstimate.rankInstitutionScope, "outside-guangxi");
assert.equal(insideEstimate.rank, 6473);
assert.equal(insideEstimate.rankInstitutionScope, "inside-guangxi");
assert.equal(api.profileRankForAdmissionRecord({ rankInstitutionScope: "outside-guangxi" }, profile), 6442);
assert.equal(api.profileRankForAdmissionRecord({ rankInstitutionScope: "inside-guangxi" }, profile), 6473);
assert.equal(api.profileScoreForAdmissionRecord({ rankInstitutionScope: "inside-guangxi" }, { ...profile, guangxiLocalScore: "605" }), 605);

const outsideFit = api.admissionFit({
  year: 2025,
  minScore: 600,
  minRankEnd: 6442,
  rankDerivedFromScore: true,
  rankInstitutionScope: "outside-guangxi",
  rankInstitutionScopeLabel: "广西区外院校",
}, profile, "2026-07-19");
const insideFit = api.admissionFit({
  year: 2025,
  minScore: 600,
  minRankEnd: 6473,
  rankDerivedFromScore: true,
  rankInstitutionScope: "inside-guangxi",
  rankInstitutionScopeLabel: "广西区内院校",
}, profile, "2026-07-19");
assert.equal(outsideFit.zone, "临界稳");
assert.equal(insideFit.zone, "临界稳");
assert.ok(outsideFit.text.includes("广西区外院校最低分换算位次"));
assert.ok(insideFit.text.includes("广西区内院校最低分换算位次"));
assert.ok(source.includes('id="guangxiLocalScoreInput"'));
assert.ok(source.includes('id="guangxiLocalRankInput"'));
assert.ok(source.includes('estimateRankFromScore(profile, "outside-guangxi")'));
assert.ok(source.includes('estimateRankFromScore(profile, "inside-guangxi")'));

console.log(JSON.stringify({ ok: true, linkedRecords: linked.length, linkedByScope: { outside: 7018, inside: 1204 }, score600: { outsideRank: outsideEstimate.rank, insideRank: insideEstimate.rank } }, null, 2));
