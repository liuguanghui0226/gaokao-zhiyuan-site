#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.287-tianjin-control-lines2026-pending-vocational-and-rank-provenance-846672records";
const sourceId = "official-tianjin-control-lines-2026";
const rankSourceUrl = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260624/2293845980.html";

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const imported = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-tianjin-control-lines-2026-import.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-tianjin-control-lines-2026-v3287-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const tianjin = readGzipJson(path.join(releaseDir, "tianjin.json.gz"));
const records = tianjin.records.filter((record) => record.sourceId === sourceId);
const rankRows = tianjin.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-tianjin-rank-2026");
const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
const rankSourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-tianjin-rank-2026");

assert.equal(imported.diagnostics.recordCount, 6);
assert.equal(imported.diagnostics.ordinaryRecords, 1);
assert.equal(imported.diagnostics.specialPathRecords, 5);
assert.deepEqual(imported.diagnostics.routeCounts, { "ordinary-bachelor": 1, special: 1, art: 3, sports: 1 });
assert.deepEqual(imported.diagnostics.ordinaryBoundaries, { bachelor: 458, vocational: null });
assert.equal(imported.diagnostics.ordinaryVocationalStatus, "pending-official-release");
assert.equal(records.length, 6);
assert.equal(new Set(records.map((record) => record.id)).size, 6);
assert.equal(records.filter((record) => record.formalScoreScope === "control-line-only").length, 1);
assert.equal(records.filter((record) => record.formalScoreScope === "special-path-only").length, 5);

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 846672);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5093);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1026);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 846672);
assert.equal(manifest.shards["天津"].records, 9656);
assert.equal(manifest.shards["天津"].rankConversions, 381);
assert.equal(runtimeManifest.after.sourceRecords, 6);
assert.equal(runtimeManifest.after.rankSourceUrlRecords, 381);
assert.equal(runtimeManifest.after.rankValueChanges, 0);
assert.equal(rankRows.length, 381);
assert.ok(rankRows.every((record) => record.sourceUrl === rankSourceUrl));

assert.equal(sourceNote.province, "天津");
assert.equal(sourceNote.ordinaryVocationalPending, true);
assert.equal(sourceNote.ordinaryVocationalStatus, "pending-official-release");
assert.equal(sourceNote.undergraduatePageSha256, "dccf00c366229eb359e6837abf57efe053b618e25cea197a71815337cde1bb87");
assert.equal(sourceNote.artSportsPageSha256, "1f4b7fabbfd0bb5dfe4cf23ef1dbe1f6ee93735100ddce679ca4569e5f1c75af");
assert.equal(sourceNote.rankPageSha256, "6237d13873da2c099969bdc3bfeb16e56d194ae906a6f04d94304c56777f4905");
assert.equal(sourceNote.rankPdfSha256, "768a8cf5bc3c07d1a1d390c5040394192314c6845e4383cfdba2e01d4b9dec1d");
assert.equal(rankSourceNote.pageHtmlSha256, "6237d13873da2c099969bdc3bfeb16e56d194ae906a6f04d94304c56777f4905");
assert.equal(rankSourceNote.pdfSha256, "768a8cf5bc3c07d1a1d390c5040394192314c6845e4383cfdba2e01d4b9dec1d");
assert.equal(rankSourceNote.provenanceRevision.rankRowsLinked, 381);
assert.equal(rankSourceNote.provenanceRevision.valueChanges, 0);

const ordinary = records.find((record) => record.controlLineRouteKind === "ordinary-bachelor");
assert.equal(ordinary?.minScore, 458);
assert.equal(ordinary?.scoreBasis, "gaokao-total");
assert.equal(records.find((record) => record.controlLineRouteKind === "special")?.minScore, 547);
assert.deepEqual(records.filter((record) => record.controlLineRouteKind === "art").map((record) => record.minScore).sort((a, b) => a - b), [229, 297, 343]);
assert.equal(records.find((record) => record.controlLineRouteKind === "sports")?.minScore, 407);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /2026年普通专科控制线待发布/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__tianjinControlTest = {
  state,
  CANDIDATE_POOLS,
  ordinaryBachelorControlLine,
  ordinaryVocationalControlLine,
  pendingOrdinaryVocationalControlSource,
  ordinaryVocationalQualificationStatus,
  isVocationalProfile,
  candidatePoolsForProfile,
  classifyProfileBand,
  scoreCandidate,
  buildApplicationPlan,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__tianjinControlTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = tianjin.records;
api.state.data.admissionScoreLayer.rankConversions = tianjin.rankConversions;

function profile(score) {
  return {
    childType: "均衡探索型",
    score: String(score),
    vocationalScore: "",
    rank: "50000",
    province: "天津",
    subject: "综合",
    candidateCategory: "",
    rankUsage: "",
    rankLevelUsage: "",
    electives: "物理 化学",
    disciplineFocus: "08",
    interest: "计算机 数字媒体技术 软件 数据",
    cities: "天津 北京",
    abilityProfile: "重视实践和就业",
    redLines: "不接受高学费中外合作",
    budget: "中等敏感",
    strategy: "均衡",
  };
}

const below = profile(457);
const atLine = profile(458);
assert.equal(api.ordinaryBachelorControlLine(atLine)?.score, 458);
assert.equal(api.ordinaryVocationalControlLine(below), null);
assert.equal(api.isVocationalProfile(below), true);
assert.equal(api.isVocationalProfile(atLine), false);
assert.equal(api.pendingOrdinaryVocationalControlSource(below)?.id, sourceId);
assert.equal(api.pendingOrdinaryVocationalControlSource(atLine), null);
assert.equal(api.ordinaryVocationalQualificationStatus(below).pending, true);
assert.equal(api.ordinaryVocationalQualificationStatus(below).unknown, false);
assert.ok(api.candidatePoolsForProfile(below).some((candidate) => candidate.id === "vocational-dual"));
assert.ok(api.candidatePoolsForProfile(atLine).every((candidate) => candidate.id !== "vocational-dual"));

const vocationalCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "vocational-dual");
const pendingResult = api.scoreCandidate(vocationalCandidate, below, api.classifyProfileBand(below));
assert.equal(pendingResult.confidence, "C");
assert.ok(pendingResult.total <= 55);
assert.ok(pendingResult.schoolOptions.every((option) => !option.record && option.role === "路径调研"));
assert.equal(api.buildApplicationPlan([pendingResult]).length, 0);
assert.ok(pendingResult.reasons.some((reason) => /普通高职专科控制线尚待官方发布/.test(reason)));
assert.ok(pendingResult.warnings.some((warning) => /当前结果只作路径调研/.test(warning)));

const undergraduateCandidate = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const undergraduateResult = api.scoreCandidate(undergraduateCandidate, atLine, api.classifyProfileBand(atLine));
assert.ok(undergraduateResult.reasons.some((reason) => /普通本科录取控制分数线458分/.test(reason)));
assert.ok(undergraduateResult.reasons.some((reason) => /不等于达到任何具体院校或专业投档线/.test(reason)));

api.state.data.admissionScoreLayer.records = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(api.ordinaryBachelorControlLine(profile(600)), null, "Special-path rows must never become an ordinary bachelor line");
assert.equal(api.ordinaryVocationalControlLine(profile(600)), null, "Special-path rows must never become an ordinary vocational line");

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  sourceRecords: records.length,
  rankSourceUrlRecords: rankRows.length,
  ordinaryBoundary: 458,
  pendingVocationalLine: true,
  pendingLineSafety: { belowScore: 457, atLineScore: 458, maxTotal: 55, applicationPlanRows: 0 },
}, null, 2));
