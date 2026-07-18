#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.315-hebei-official-rank2025-aligned-868426records";
const pendingProvinces = ["上海", "天津", "江苏", "海南", "山西"];
const sourceIds = {
  上海: "official-shanghai-control-lines-2026",
  天津: "official-tianjin-control-lines-2026",
  江苏: "official-jiangsu-control-lines-2026",
  海南: "official-hainan-control-lines-2026",
  山西: "official-shanxi-control-lines-2026",
};
const shardFiles = { 上海: "shanghai", 天津: "tianjin", 江苏: "jiangsu", 海南: "hainan", 山西: "shanxi" };

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

const audit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-pending-vocational-schedule-audit-2026-v3305.json"), "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-pending-vocational-schedule-audit-2026-v3305-runtime-manifest.json"), "utf8"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));

assert.equal(audit.entries.length, 5);
assert.deepEqual([...audit.entries.map((entry) => entry.province)].sort(), [...pendingProvinces].sort());
assert.equal(audit.entries.filter((entry) => entry.expectedPublicationAt).length, 1);
assert.equal(audit.entries.find((entry) => entry.province === "上海")?.expectedPublicationAt, "2026-07-29");
assert.ok(audit.entries.filter((entry) => entry.province !== "上海").every((entry) => entry.expectedPublicationAt === null));
assert.ok(audit.entries.every((entry) => entry.noHistoricalSubstitution === true));

assert.equal(core.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.browserRuntime.fullMasterRecords, 868426);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 118702);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5119);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 118702);
assert.equal(runtimeManifest.after.modelVersion, "local-deterministic-v3.305-pending-vocational-schedule-audit-and-ui-847238records");
assert.equal(runtimeManifest.after.recordCount, 847238);
assert.deepEqual([...runtimeManifest.after.pendingProvinces].sort(), [...pendingProvinces].sort());
assert.deepEqual(runtimeManifest.after.exactPublicationDateProvinces, ["上海"]);
assert.deepEqual([...runtimeManifest.after.unannouncedPublicationDateProvinces].sort(), ["天津", "江苏", "海南", "山西"].sort());

const summary = core.admissionScoreLayer.pendingOrdinaryVocationalAudit;
assert.equal(summary.dataset, audit.dataset);
assert.equal(summary.checkedAt, "2026-07-17");
assert.equal(summary.pendingCount, 5);
assert.equal(summary.noHistoricalSubstitution, true);
assert.deepEqual(summary.exactPublicationDateProvinces, ["上海"]);
assert.deepEqual([...summary.publicationDateUnannouncedProvinces].sort(), ["天津", "江苏", "海南", "山西"].sort());

for (const entry of audit.entries) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === entry.sourceId);
  assert.ok(note, `${entry.province} source note is missing`);
  assert.equal(note.ordinaryVocationalStatus, "pending-official-release");
  assert.equal(note.ordinaryVocationalCheckedAt, "2026-07-17");
  assert.deepEqual(note.ordinaryVocationalReview.expectedPublicationAt, entry.expectedPublicationAt);
  assert.equal(note.ordinaryVocationalReview.exactPublicationDateStatus, entry.exactPublicationDateStatus);
  assert.equal(note.ordinaryVocationalReview.noHistoricalSubstitution, true);
  assert.equal(note.ordinaryVocationalReview.primarySource.url, entry.primarySource.url);
  assert.ok(note.ordinaryVocationalReview.officialMilestones.length >= 1);
  assert.ok(note.relatedUrls.includes(entry.primarySource.url));

  const shard = readGzipJson(path.join(releaseDir, `${shardFiles[entry.province]}.json.gz`));
  const sourceRecords = shard.records.filter((record) => record.sourceId === sourceIds[entry.province]);
  assert.ok(sourceRecords.length > 0, `${entry.province} control source should remain present`);
  assert.equal(sourceRecords.filter((record) => record.controlLineRouteKind === "ordinary-vocational").length, 0, `${entry.province} must not gain an invented ordinary vocational line`);
}

const shanghai = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceIds.上海).ordinaryVocationalReview;
assert.equal(shanghai.expectedPublicationAt, "2026-07-29");
assert.match(shanghai.officialMilestones[0].label, /7月29日晚公布专科各批次录取控制分数线/);

const jiangsu = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceIds.江苏).ordinaryVocationalReview;
assert.equal(jiangsu.expectedPublicationAt, null);
assert.equal(jiangsu.officialMilestones[0].startsAt, "2026-07-27");
assert.equal(jiangsu.officialMilestones[0].endsAt, "2026-07-28T17:00:00+08:00");

const tianjin = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceIds.天津).ordinaryVocationalReview;
assert.equal(tianjin.expectedPublicationAt, null);
assert.match(tianjin.scoreBasisNote, /语文、数学、外语三门/);
assert.equal(tianjin.officialMilestones[0].startsAt, "2026-07-26T09:00:00+08:00");

const shanxi = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceIds.山西).ordinaryVocationalReview;
assert.equal(shanxi.expectedPublicationAt, null);
assert.equal(shanxi.officialMilestones.length, 3);
assert.match(shanxi.officialMilestones[2].label, /8月4日至6日录取/);

const hainan = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceIds.海南).ordinaryVocationalReview;
assert.equal(hainan.expectedPublicationAt, null);
assert.match(hainan.officialMilestones[0].label, /先报志愿再划线/);
assert.match(hainan.reason, /100%的相应位次/);

const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex > 0, "Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__pendingVocationalTest = {
  pendingOrdinaryVocationalReviewDetails,
  renderPendingOrdinaryVocationalPanel,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__pendingVocationalTest;

for (const province of pendingProvinces) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === sourceIds[province]);
  const details = api.pendingOrdinaryVocationalReviewDetails(note);
  const html = api.renderPendingOrdinaryVocationalPanel({ province }, note);
  assert.equal(details.checkedAt, "2026-07-17");
  assert.equal(details.noHistoricalSubstitution, true);
  assert.ok(details.milestoneLabels.length >= 1);
  assert.match(html, new RegExp(province));
  assert.match(html, /2026年普通专科控制线待发布/);
  assert.match(html, /不生成可执行院校专业清单/);
  assert.match(html, /不使用往年控制线/);
  assert.match(html, /target="_blank"/);
  assert.ok(!/推荐院校|录取概率/.test(html));
}

assert.match(api.renderPendingOrdinaryVocationalPanel({ province: "上海" }, core.admissionScoreLayer.sourceNotes.find((item) => item.id === sourceIds.上海)), /2026年7月29日/);
assert.match(api.renderPendingOrdinaryVocationalPanel({ province: "天津" }, core.admissionScoreLayer.sourceNotes.find((item) => item.id === sourceIds.天津)), /三科450分口径/);

console.log(JSON.stringify({
  status: "ok",
  modelVersion,
  recordCount: manifest.recordCount,
  pendingProvinces,
  exactPublicationDateProvinces: ["上海"],
  unannouncedPublicationDateProvinces: ["天津", "江苏", "海南", "山西"],
  inventedVocationalLines: 0,
  uiPanelsChecked: 5,
}, null, 2));
