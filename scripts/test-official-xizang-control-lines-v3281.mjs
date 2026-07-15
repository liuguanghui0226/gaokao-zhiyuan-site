#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.281-xizang-control-provenance-and-low-score-safety-846462records";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const verification = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-xizang-control-lines-2026-government-verification.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-xizang-control-lines-2026-v3281-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const xizang = readGzipJson(path.join(releaseDir, "xizang.json.gz"));
const records = xizang.records.filter((record) => record.sourceId === "official-xizang-control-lines-2026");
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-xizang-control-lines-2026");

assert.equal(verification.verificationRows.length, 22);
assert.deepEqual(verification.diagnostics.breakdown, { ordinary: 12, artSports: 8, military: 2 });
assert.equal(runtimeManifest.after.verifiedRecords, 22);
assert.deepEqual(runtimeManifest.after.routeCounts, { ordinary: 12, "art-sports": 8, military: 2 });
assert.equal(records.length, 22);
assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 846462);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 846462);
assert.equal(manifest.shards["西藏"].records, 28315);
assert.equal(sourceNote.quality, "official-xizang-control-line-image-and-government-html-verified");
assert.equal(sourceNote.mirrorUrl, "https://www.xizang.gov.cn/xwzx_406/bmkx/202606/t20260626_547152.html");
assert.equal(sourceNote.mirrorHtmlSha256, verification.sourcePatch.mirrorHtmlSha256);

const ordinary = records.filter((record) => record.formalScoreScope === "control-line-only");
const special = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(ordinary.length, 12);
assert.equal(special.length, 10);
assert.ok(ordinary.every((record) => record.controlLineKind === "普通生源"));
assert.ok(special.every((record) => ["艺术体育类文化线", "部队生源"].includes(record.controlLineKind)));
assert.ok(records.every((record) => record.candidateCategory === record.candidateClass));
assert.ok(records.every((record) => record.controlLineSection === record.batch));
assert.ok(records.every((record) => record.sourceMirrorUrl === sourceNote.mirrorUrl));
assert.ok(special.filter((record) => record.controlLineKind === "艺术体育类文化线").every((record) => record.rankUsage === "art-sports"));
assert.ok(special.filter((record) => record.controlLineKind === "部队生源").every((record) => record.rankUsage === "military"));

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__xizangControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  isVocationalProfile,
  classifyProfileBand,
  scoreCandidate,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__xizangControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = xizang.records;
api.state.data.admissionScoreLayer.rankConversions = xizang.rankConversions;

function profile(subject, candidateCategory, score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    rank: "1000",
    province: "西藏",
    subject,
    candidateCategory,
    rankUsage: "",
    rankLevelUsage: "",
    electives: "化学 生物",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "稳健",
  };
}

const historyA = profile("历史/文科", "A类考生", 294);
const historyB = profile("历史/文科", "B类考生", 304);
const historyUnselected = profile("历史/文科", "", 304);
const physicsA = profile("物理/理科", "A类考生", 260);
const physicsB = profile("物理/理科", "B类考生", 300);
const physicsUnselected = profile("物理/理科", "", 300);

assert.equal(api.ordinaryBachelorControlLine(historyA)?.score, 294);
assert.equal(api.ordinaryBachelorControlLine(historyB)?.score, 304);
assert.equal(api.ordinaryBachelorControlLine(historyUnselected)?.score, 304);
assert.equal(api.ordinaryBachelorControlLine(physicsA)?.score, 260);
assert.equal(api.ordinaryBachelorControlLine(physicsB)?.score, 300);
assert.equal(api.ordinaryBachelorControlLine(physicsUnselected)?.score, 300);
assert.equal(api.ordinaryVocationalControlLine(historyA)?.score, 237);
assert.equal(api.ordinaryVocationalControlLine(historyB)?.score, 237);
assert.equal(api.ordinaryVocationalControlLine(physicsA)?.score, 195);
assert.equal(api.ordinaryVocationalControlLine(physicsB)?.score, 195);

assert.equal(api.isVocationalProfile({ ...historyA, score: "293" }), true);
assert.equal(api.isVocationalProfile({ ...historyA, score: "294" }), false);
assert.equal(api.isVocationalProfile({ ...historyB, score: "303" }), true);
assert.equal(api.isVocationalProfile({ ...historyB, score: "304" }), false);
assert.equal(api.isVocationalProfile({ ...physicsA, score: "259" }), true);
assert.equal(api.isVocationalProfile({ ...physicsA, score: "260" }), false);
assert.equal(api.isVocationalProfile({ ...physicsB, score: "299" }), true);
assert.equal(api.isVocationalProfile({ ...physicsB, score: "300" }), false);

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
assert.ok(vocationalCandidate);
const belowPhysics = profile("物理/理科", "B类考生", 194);
const atPhysics = profile("物理/理科", "B类考生", 195);
const belowHistory = profile("历史/文科", "A类考生", 236);
const atHistory = profile("历史/文科", "A类考生", 237);
const missingScore = { ...profile("物理/理科", "B类考生", 195), score: "" };
const belowPhysicsResult = api.scoreCandidate(vocationalCandidate, belowPhysics, api.classifyProfileBand(belowPhysics));
const atPhysicsResult = api.scoreCandidate(vocationalCandidate, atPhysics, api.classifyProfileBand(atPhysics));
const belowHistoryResult = api.scoreCandidate(vocationalCandidate, belowHistory, api.classifyProfileBand(belowHistory));
const atHistoryResult = api.scoreCandidate(vocationalCandidate, atHistory, api.classifyProfileBand(atHistory));
const missingScoreResult = api.scoreCandidate(vocationalCandidate, missingScore, api.classifyProfileBand(missingScore));

for (const result of [belowPhysicsResult, belowHistoryResult]) {
  assert.equal(result.confidence, "C");
  assert.ok(result.total <= 42);
  assert.ok(result.reasons.some((reason) => /低于.*普通高职专科最低控制线/.test(reason)));
  assert.ok(result.warnings.some((warning) => /不得视为普通批可录取名单/.test(warning)));
}
assert.ok(atPhysicsResult.warnings.every((warning) => !/不得视为普通批可录取名单/.test(warning)));
assert.ok(atHistoryResult.warnings.every((warning) => !/不得视为普通批可录取名单/.test(warning)));
assert.ok(missingScoreResult.warnings.every((warning) => !/不得视为普通批可录取名单/.test(warning)));

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  verifiedRecords: records.length,
  bachelorBoundaries: { historyA: 294, historyB: 304, physicsA: 260, physicsB: 300 },
  vocationalBoundaries: { history: 237, physics: 195 },
  belowLineSafety: { maxTotal: 42, confidence: "C" },
}, null, 2));
