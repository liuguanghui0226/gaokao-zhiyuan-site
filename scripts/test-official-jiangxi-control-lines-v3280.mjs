#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-jiangxi-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-jiangxi-control-lines-2026-v3280-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const jiangxi = readGzipJson(path.join(releaseDir, "jiangxi.json.gz"));
const sourceRecords = jiangxi.records.filter((record) => record.sourceId === "official-jiangxi-control-lines-2026");

assert.equal(imported.records.length, 30);
assert.deepEqual(imported.diagnostics.breakdown, { ordinary: 4, special: 2, threeSchool: 2, art: 20, sports: 2 });
assert.equal(sourceRecords.length, 30);
assert.equal(new Set(sourceRecords.map((record) => record.id)).size, 30);
assert.ok(sourceRecords.every((record) => record.dataType === "control-line" && record.year === 2026 && record.province === "江西"));
assert.equal(core.modelVersion, "local-deterministic-v3.288-neimenggu-control-lines2026-and-rank-provenance-846746records");
assert.equal(core.modelPolicy.version, core.modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 846746);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1100);
assert.equal(core.admissionScoreLayer.sourceNotes.filter((note) => note.id === "official-jiangxi-control-lines-2026").length, 1);
assert.equal(manifest.modelVersion, core.modelVersion);
assert.equal(manifest.recordCount, 846746);
assert.equal(manifest.shards["江西"].records, 12798);
assert.equal(runtimeManifest.after.sourceRecords, 30);

function findLine(subjectType, section, category) {
  return sourceRecords.find((record) => record.subjectType === subjectType && record.controlLineSection === section && record.majorGroup === category);
}

assert.equal(findLine("历史类", "本科", "普通类")?.minScore, 479);
assert.equal(findLine("历史类", "高职（专科）", "普通类")?.minScore, 220);
assert.equal(findLine("物理类", "本科", "普通类")?.minScore, 412);
assert.equal(findLine("物理类", "高职（专科）", "普通类")?.minScore, 200);
assert.equal(findLine("艺术类", "本科", "书法类")?.professionalScoreLine, 241);
assert.equal(findLine("体育类", "高职（专科）", "体育类")?.professionalScoreLine, 60);
assert.ok(sourceRecords.filter((record) => record.majorGroup !== "普通类").every((record) => record.formalScoreScope === "special-path-only"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__jiangxiControlTest = {
  state,
  ordinaryBachelorControlLine,
  isVocationalProfile,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__jiangxiControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = jiangxi.records;
api.state.data.admissionScoreLayer.rankConversions = jiangxi.rankConversions;

const history = { province: "江西", subject: "历史/文科", candidateCategory: "", rankUsage: "" };
const physics = { province: "江西", subject: "物理/理科", candidateCategory: "", rankUsage: "" };
assert.equal(api.ordinaryBachelorControlLine(history)?.score, 479);
assert.equal(api.ordinaryBachelorControlLine(physics)?.score, 412);
assert.equal(api.isVocationalProfile({ ...history, score: "478" }), true);
assert.equal(api.isVocationalProfile({ ...history, score: "479" }), false);
assert.equal(api.isVocationalProfile({ ...physics, score: "411" }), true);
assert.equal(api.isVocationalProfile({ ...physics, score: "412" }), false);
assert.equal(api.isVocationalProfile({ ...physics, score: "650", rankUsage: "vocational" }), true);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: core.modelVersion,
  sourceRecords: sourceRecords.length,
  ordinaryBoundaries: { history: 479, physics: 412 },
  isolatedRoutes: { special: 2, threeSchool: 2, art: 20, sports: 2 },
}, null, 2));
