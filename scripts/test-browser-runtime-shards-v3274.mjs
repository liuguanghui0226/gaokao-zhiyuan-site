#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const siteDataDir = path.join(projectRoot, "site/data");
const siteIndex = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const releaseMatch = siteIndex.match(/__GAOKAO_RUNTIME_RELEASE_BASE__\s*=\s*["']\.\/data\/([^"']+)/);
const releaseDir = releaseMatch ? path.join(siteDataDir, releaseMatch[1]) : "";
const usingCompressedRelease = Boolean(releaseDir && fs.existsSync(path.join(releaseDir, "knowledge-core.json.gz")));
const appFile = path.join(projectRoot, "site/assets/app.js");
const importFile = path.join(projectRoot, "data/admissions/official-xizang-vacancy-plans-2025-v3272-import.json");
const szuImportFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2024-2025-v3274-szu-import.json");
const hnuImportFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2024-v3275-hnu-import.json");

function runtimeDataFile(relativePath) {
  if (usingCompressedRelease) return path.join(releaseDir, `${path.basename(relativePath)}.gz`);
  return path.join(siteDataDir, relativePath);
}

function runtimeBytes(file) {
  const bytes = fs.readFileSync(file);
  return file.endsWith(".gz") ? zlib.gunzipSync(bytes) : bytes;
}

function runtimeJson(file) {
  return JSON.parse(runtimeBytes(file).toString("utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(runtimeBytes(file)).digest("hex");
}

const coreFile = runtimeDataFile("knowledge-core.json");
const manifestFile = runtimeDataFile("provinces/manifest.json");
const core = runtimeJson(coreFile);
const manifest = runtimeJson(manifestFile);
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));
const szuImported = JSON.parse(fs.readFileSync(szuImportFile, "utf8"));
const hnuImported = JSON.parse(fs.readFileSync(hnuImportFile, "utf8"));

assert.match(fs.readFileSync(appFile, "utf8"), /const DEFAULT_PROFILE = \{[\s\S]*?rank: "",/, "Default example must leave rank blank so province/score changes trigger current rank estimation");

assert.equal(core.modelVersion, "local-deterministic-v3.305-pending-vocational-schedule-audit-and-ui-847238records");
assert.equal(core.modelPolicy.version, core.modelVersion);
assert.equal(core.admissionScoreLayer.records.length, 0);
assert.equal(core.admissionScoreLayer.rankConversions.length, 0);
assert.equal(core.admissionScoreLayer.structuredRecords, 847238);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 116656);
assert.equal(core.admissionScoreLayer.admissionPlanRecords, 71877);
assert.equal(core.admissionScoreLayer.admissionPlanCount, 358294, "vacancy snapshots must not inflate annual plan count");
assert.equal(core.admissionScoreLayer.vacancyPlanRecords, 2187);
assert.equal(core.admissionScoreLayer.vacancyPlanSnapshotCount, 6099);
assert.equal(core.admissionScoreLayer.ordinaryVocationalVacancyRecords, 926);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5110);
assert.equal(core.admissionScoreLayer.coverage.dataTypes["control-line"], 1592);
assert.ok(core.admissionScoreLayer.sourceNotes.some((note) => note.id === "official-xizang-vacancy-plans-2025-v3272"));
assert.ok(core.admissionScoreLayer.sourceNotes.some((note) => note.id === "official-xizang-admission-schedule-2026-v3272"));
assert.ok(core.admissionScoreLayer.sourceNotes.some((note) => note.id === "official-szu-national-2024-2025-school-admission"));
assert.ok(core.admissionScoreLayer.sourceNotes.some((note) => note.id === "official-hnu-national-2024-major-admission"));
assert.ok(core.admissionScoreLayer.sourceNotes.some((note) => note.id === "official-jiangxi-control-lines-2026"));
const zhejiangControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-zhejiang-control-lines-2026");
assert.equal(zhejiangControlSource.quality, "official-zhejiang-control-line-html-verified");
assert.equal(zhejiangControlSource.pageHtmlSha256, "ecbb3531e9dfed98bb6ae4e31a18d5e9979fe789e04bdad39f7bf6648a5a0550");
const hunanControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-hunan-control-lines-2026");
assert.equal(hunanControlSource.quality, "official-hunan-control-line-images-ocr-verified");
assert.equal(hunanControlSource.pageHtmlSha256, "cf4e18a47cd675d8921f0e78c3a035dcdbc56312aa8bb74cc51bf03ac2df5aae");
const guangdongControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-guangdong-control-lines-2026");
assert.equal(guangdongControlSource.quality, "official-guangdong-control-line-html-verified");
assert.equal(guangdongControlSource.pageHtmlSha256, "fba7a579d36918cda0bede7be5d0ebac92320629cb8d12f8f9cedba3b8353052");
const anhuiControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-anhui-control-lines-2026");
assert.equal(anhuiControlSource.quality, "official-anhui-control-line-chsi-and-government-image-verified");
assert.equal(anhuiControlSource.imageSha256, "9761df950662518da62273f02405988502f0c39c01a3d69ab24ae58be65fd04b");
const beijingControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-beijing-control-lines-2026");
assert.equal(beijingControlSource.quality, "official-beijing-control-line-html-verified");
assert.equal(beijingControlSource.pageHtmlSha256, "d6770b626bc7399ba50924b56be892867b5576e4ee667f957238e0dbc08fef3c");
const tianjinControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-tianjin-control-lines-2026");
assert.equal(tianjinControlSource.quality, "official-content-mirror-tianjin-control-line-html-verified");
assert.equal(tianjinControlSource.ordinaryVocationalStatus, "pending-official-release");
assert.equal(tianjinControlSource.ordinaryVocationalPending, true);
const shanghaiControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-shanghai-control-lines-2026");
assert.equal(shanghaiControlSource.quality, "official-shanghai-control-line-html-verified");
assert.equal(shanghaiControlSource.ordinaryVocationalStatus, "pending-official-release");
assert.equal(shanghaiControlSource.ordinaryVocationalExpectedPublicationAt, "2026-07-29");
assert.equal(shanghaiControlSource.controlPageSha256, "7ec1b138300d46710ea88f21b088b9f10438ad8d94d63caf4ad7cc2c616e28a5");
const neimengguControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-neimenggu-control-lines-2026");
assert.equal(neimengguControlSource.quality, "official-neimenggu-control-line-html-verified");
assert.equal(neimengguControlSource.parsedRecords, 74);
assert.equal(neimengguControlSource.controlPageSha256, "46a797ff4eb016f8db7cadc7410491a12934c1fd04a35b244577157210eec8c8");
assert.equal(neimengguControlSource.rankHistorySha256, "9479d472ed9c58b94a1071b8f0174c0c56612f2e4b369185dc996c2f2b820ac1");
assert.equal(neimengguControlSource.rankPhysicsSha256, "fe27c70886ba49833956c58c23a1f9c4003ad3d7fd3baeac2d761244781e1954");
const fujianControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-fujian-control-lines-2026");
assert.equal(fujianControlSource.quality, "official-fujian-control-line-image-verified");
assert.equal(fujianControlSource.parsedRecords, 22);
assert.equal(fujianControlSource.controlPageSha256, "c2acd98f9bd57a7031fb3e28de51849d5f2427b5535108abc418e22c71391a3b");
assert.equal(fujianControlSource.controlImageSha256, "3e02438605e2703d2a86be08eec2fddfa797e2b313c8795a2082e9418245e645");
assert.equal(fujianControlSource.rankImageEvidence.length, 8);
const xizangControlSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-xizang-control-lines-2026");
assert.equal(xizangControlSource.mirrorUrl, "https://www.xizang.gov.cn/xwzx_406/bmkx/202606/t20260626_547152.html");
assert.equal(xizangControlSource.quality, "official-xizang-control-line-image-and-government-html-verified");
assert.deepEqual(core.admissionScoreLayer.coverage.formalScoreMissingProvinces, ["西藏"]);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 116656);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedSources, 137);
assert.equal(core.admissionScoreLayer.rankSourceCoverage.queuedSources, 66);

assert.equal(manifest.modelVersion, core.modelVersion);
assert.equal(manifest.provinceCount, 31);
assert.equal(manifest.recordCount, 847238);
assert.equal(manifest.rankConversionCount, 116656);
assert.equal(manifest.unknownRecords, 0);
assert.equal(manifest.unknownRankConversions, 0);
assert.equal(manifest.core.sha256, sha256(coreFile));
assert.equal(manifest.core.bytes, runtimeBytes(coreFile).byteLength);

for (const entry of Object.values(manifest.shards)) {
  const file = runtimeDataFile(`provinces/${entry.file}`);
  assert.equal(runtimeBytes(file).byteLength, entry.bytes, `${entry.file} byte count mismatch`);
  assert.equal(sha256(file), entry.sha256, `${entry.file} SHA-256 mismatch`);
}

assert.equal(manifest.shards["北京"].records, 6490);
assert.equal(manifest.shards["北京"].rankConversions, 688);
const beijing = runtimeJson(runtimeDataFile(`provinces/${manifest.shards["北京"].file}`));
const beijingControlLines = beijing.records.filter((record) => record.sourceId === "official-beijing-control-lines-2026");
assert.equal(beijingControlLines.length, 9);
assert.equal(beijingControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 2);
assert.equal(beijingControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 7);
assert.equal(beijingControlLines.find((record) => record.controlLineRouteKind === "ordinary-bachelor")?.minScore, 429);
assert.equal(beijingControlLines.find((record) => record.controlLineRouteKind === "ordinary-vocational")?.minScore, 120);
assert.equal(beijingControlLines.find((record) => record.controlLineRouteKind === "ordinary-vocational")?.scoreBasis, "chinese-math-foreign-450");
assert.equal(beijing.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-beijing-rank-2026" && record.sourceUrl === "https://www.bjeea.cn/html/gkgz/tzgg/2026/0624/88238.html").length, 341);
assert.equal(manifest.shards["天津"].records, 9656);
assert.equal(manifest.shards["天津"].rankConversions, 381);
const tianjin = runtimeJson(runtimeDataFile(`provinces/${manifest.shards["天津"].file}`));
const tianjinControlLines = tianjin.records.filter((record) => record.sourceId === "official-tianjin-control-lines-2026");
assert.equal(tianjinControlLines.length, 6);
assert.equal(tianjinControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 1);
assert.equal(tianjinControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 5);
assert.equal(tianjinControlLines.find((record) => record.controlLineRouteKind === "ordinary-bachelor")?.minScore, 458);
assert.equal(tianjinControlLines.find((record) => record.controlLineRouteKind === "ordinary-vocational"), undefined);
assert.equal(tianjin.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-tianjin-rank-2026" && record.sourceUrl === "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260624/2293845980.html").length, 381);
assert.equal(manifest.shards["上海"].records, 5986);
assert.equal(manifest.shards["上海"].rankConversions, 214);
const shanghai = runtimeJson(runtimeDataFile(`provinces/${manifest.shards["上海"].file}`));
const shanghaiControlLines = shanghai.records.filter((record) => record.sourceId === "official-shanghai-control-lines-2026");
assert.equal(shanghaiControlLines.length, 5);
assert.equal(shanghaiControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 1);
assert.equal(shanghaiControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 4);
assert.equal(shanghaiControlLines.find((record) => record.controlLineRouteKind === "ordinary-bachelor")?.minScore, 403);
assert.equal(shanghaiControlLines.find((record) => record.controlLineRouteKind === "ordinary-vocational"), undefined);
assert.deepEqual(shanghaiControlLines.filter((record) => record.controlLineRouteKind === "art").map((record) => record.minScore).sort((left, right) => left - right), [220, 302]);
assert.equal(shanghai.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-shanghai-rank-2026" && record.sourceUrl === "https://www.shmeea.edu.cn/page/02200/20260623/20375.html").length, 214);
const neimengguEntry = manifest.shards["内蒙古"];
assert.equal(neimengguEntry.records, 15333);
assert.equal(neimengguEntry.rankConversions, 974);
const neimenggu = runtimeJson(runtimeDataFile(`provinces/${neimengguEntry.file}`));
const neimengguControlLines = neimenggu.records.filter((record) => record.sourceId === "official-neimenggu-control-lines-2026");
assert.equal(neimengguControlLines.length, 74);
assert.equal(neimengguControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(neimengguControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 70);
assert.equal(neimengguControlLines.filter((record) => Number.isFinite(record.professionalMinScore)).length, 36);
assert.deepEqual(
  neimengguControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-bachelor")
    .map((record) => [record.subjectType, record.minScore])
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
  [["历史类", 403], ["物理类", 363]].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
);
assert.deepEqual(
  neimengguControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-vocational")
    .map((record) => [record.subjectType, record.minScore])
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
  [["历史类", 160], ["物理类", 160]].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
);
assert.equal(neimenggu.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-neimenggu-rank-2026" && record.subjectType === "历史类" && record.sourceUrl === "https://www.nm.zsks.cn/fzlm/26gktj/202606/t20260624_46464.html").length, 471);
assert.equal(neimenggu.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-neimenggu-rank-2026" && record.subjectType === "物理类" && record.sourceUrl === "https://www.nm.zsks.cn/fzlm/26gktj/202606/t20260624_46462.html").length, 503);
const fujianEntry = manifest.shards["福建"];
assert.equal(fujianEntry.records, 21516);
assert.equal(fujianEntry.rankConversions, 927);
const fujian = runtimeJson(runtimeDataFile(`provinces/${fujianEntry.file}`));
const fujianControlLines = fujian.records.filter((record) => record.sourceId === "official-fujian-control-lines-2026");
assert.equal(fujianControlLines.length, 22);
assert.equal(fujianControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(fujianControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 18);
assert.equal(fujianControlLines.filter((record) => Number.isFinite(record.professionalMinScore)).length, 16);
assert.deepEqual(
  fujianControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-bachelor")
    .map((record) => [record.subjectType, record.minScore])
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
  [["历史类", 458], ["物理类", 446]].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
);
assert.deepEqual(
  fujianControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-vocational")
    .map((record) => [record.subjectType, record.minScore])
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
  [["历史类", 235], ["物理类", 235]].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
);
assert.equal(fujian.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-fujian-rank-2026" && record.subjectType === "历史类" && record.sourceUrl === "https://www.eeafj.cn/gkptgkgsgg/20260625/14698.html").length, 455);
assert.equal(fujian.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-fujian-rank-2026" && record.subjectType === "物理类" && record.sourceUrl === "https://www.eeafj.cn/gkptgkgsgg/20260625/14699.html").length, 472);
const hebeiEntry = manifest.shards["河北"];
assert.equal(hebeiEntry.records, 68517);
assert.equal(hebeiEntry.rankConversions, 1094);
const hebei = runtimeJson(runtimeDataFile(`provinces/${hebeiEntry.file}`));
const hebeiControlLines = hebei.records.filter((record) => record.sourceId === "official-hebei-control-lines-2026");
assert.equal(hebeiControlLines.length, 54);
assert.equal(hebeiControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(hebeiControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 50);
assert.equal(hebeiControlLines.filter((record) => Number.isFinite(record.professionalMinScore)).length, 28);
assert.deepEqual(
  hebeiControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-bachelor")
    .map((record) => [record.subjectType, record.minScore])
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
  [["历史类", 485], ["物理类", 443]].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
);
assert.deepEqual(
  hebeiControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-vocational")
    .map((record) => [record.subjectType, record.minScore])
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
  [["历史类", 200], ["物理类", 200]].sort((left, right) => left[0].localeCompare(right[0], "zh-CN")),
);
assert.equal(hebei.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-hebei-rank-2026" && record.sourceUrl === "https://www.hebeea.edu.cn/c/2026-06-24/493215.html").length, 1094);
const xizangEntry = manifest.shards["西藏"];
assert.equal(xizangEntry.records, 28315);
assert.equal(xizangEntry.rankConversions, 0);
const xizang = runtimeJson(runtimeDataFile(`provinces/${xizangEntry.file}`));
const xizang2026ControlLines = xizang.records.filter((record) => record.sourceId === "official-xizang-control-lines-2026");
assert.equal(xizang2026ControlLines.length, 22);
assert.equal(xizang2026ControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 12);
assert.equal(xizang2026ControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 10);
assert.ok(xizang2026ControlLines.every((record) => record.candidateCategory === record.candidateClass));
const szuXizangRecords = xizang.records.filter((record) => record.sourceId === "official-szu-national-2024-2025-school-admission");
assert.equal(szuXizangRecords.length, 17);
assert.ok(szuXizangRecords.every((record) => ["A类考生", "B类考生"].includes(record.candidateCategory)));
assert.ok(szuXizangRecords.every((record) => record.rankUnavailable === true && !Object.hasOwn(record, "minRankEnd")));
assert.ok(szuXizangRecords.some((record) => record.majorName === "计算机科学与技术" && record.candidateCategory === "A类考生"));
assert.ok(szuXizangRecords.some((record) => record.majorName === "计算机科学与技术" && record.candidateCategory === "B类考生"));
assert.equal(szuImported.records.length, 1568);
assert.equal(hnuImported.records.length, 901);
const vacancyRecords = xizang.records.filter((record) => record.sourceId === "official-xizang-vacancy-plans-2025-v3272");
assert.equal(vacancyRecords.length, 2187);
assert.equal(vacancyRecords.reduce((sum, record) => sum + record.planCount, 0), 6099);
assert.equal(vacancyRecords.filter((record) => record.formalScoreScope === "vacancy-plan-only").length, 2157);
assert.equal(vacancyRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 30);
assert.equal(vacancyRecords.filter((record) => /专科|高职/.test(record.batch) && record.formalScoreScope === "vacancy-plan-only").length, 926);
assert.ok(vacancyRecords.every((record) => record.planOnly === true && record.planStage === "征集志愿"));
assert.ok(vacancyRecords.every((record) => !Object.hasOwn(record, "minScore")));
assert.ok(vacancyRecords.every((record) => !Object.hasOwn(record, "minRank") && !Object.hasOwn(record, "minRankEnd")));
assert.ok(vacancyRecords.every((record) => record.sourceAttachment));

const anhuiEntry = manifest.shards["安徽"];
assert.equal(anhuiEntry.records, 15385);
assert.equal(anhuiEntry.rankConversions, 976);
const anhui = runtimeJson(runtimeDataFile(`provinces/${anhuiEntry.file}`));
const anhuiControlLines = anhui.records.filter((record) => record.sourceId === "official-anhui-control-lines-2026");
assert.equal(anhuiControlLines.length, 52);
assert.equal(anhuiControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(anhuiControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 48);
assert.equal(anhuiControlLines.filter((record) => Number.isFinite(record.professionalMinScore)).length, 40);
assert.deepEqual(
  anhuiControlLines.filter((record) => record.controlLineRouteKind === "ordinary-bachelor").map((record) => record.minScore).sort((left, right) => left - right),
  [451, 490],
);
assert.deepEqual(
  anhuiControlLines.filter((record) => record.controlLineRouteKind === "ordinary-vocational").map((record) => record.minScore).sort((left, right) => left - right),
  [200, 200],
);
const anhuiRankRows = anhui.rankConversions.filter((record) => record.year === 2026 && record.sourceId === "official-anhui-rank-2026");
assert.equal(anhuiRankRows.length, 976);
assert.ok(anhuiRankRows.every((record) => record.sourceUrl === "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847718.html"));

const jiangxiEntry = manifest.shards["江西"];
assert.equal(jiangxiEntry.records, 12798);
const jiangxi = runtimeJson(runtimeDataFile(`provinces/${jiangxiEntry.file}`));
const jiangxiControlLines = jiangxi.records.filter((record) => record.sourceId === "official-jiangxi-control-lines-2026");
assert.equal(jiangxiControlLines.length, 30);
assert.deepEqual(
  jiangxiControlLines
    .filter((record) => record.majorGroup === "普通类" && record.controlLineSection === "本科")
    .map((record) => record.minScore)
    .sort((left, right) => left - right),
  [412, 479],
);
const hnuJiangxi = jiangxi.records.filter((record) => record.sourceId === "official-hnu-national-2024-major-admission");
assert.equal(hnuJiangxi.length, 37);
const hnuJiangxiCs = hnuJiangxi.find((record) => record.majorName === "计算机科学与技术" && record.admissionType === "普通类");
assert.ok(hnuJiangxiCs, "Hunan University Jiangxi computer-science record is missing from browser shard");
assert.equal(hnuJiangxiCs.minScore, 627);
assert.equal(hnuJiangxiCs.minRankEnd, 3880);
assert.equal(hnuJiangxiCs.sourcePlanYear, 2025);
assert.equal(hnuJiangxiCs.formalScoreScope, "school-official-only");
const hnuJiangxiSpecial = hnuJiangxi.filter((record) => record.formalScoreScope === "special-path-only");
assert.ok(hnuJiangxiSpecial.length > 0);
assert.ok(hnuJiangxiSpecial.every((record) => /专项|艺术/.test(record.admissionType)));

const hunanEntry = manifest.shards["湖南"];
assert.equal(hunanEntry.records, 31914);
assert.equal(hunanEntry.rankConversions, 1137);
const hunan = runtimeJson(runtimeDataFile(`provinces/${hunanEntry.file}`));
const hunanControlLines = hunan.records.filter((record) => record.sourceId === "official-hunan-control-lines-2026");
assert.equal(hunanControlLines.length, 37);
assert.equal(hunanControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(hunanControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 33);
assert.deepEqual(
  hunanControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-bachelor")
    .map((record) => record.minScore)
    .sort((left, right) => left - right),
  [400, 446],
);
assert.deepEqual(
  hunanControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-vocational")
    .map((record) => record.minScore)
    .sort((left, right) => left - right),
  [200, 200],
);

const guangdongEntry = manifest.shards["广东"];
assert.equal(guangdongEntry.records, 17644);
assert.equal(guangdongEntry.rankConversions, 8816);
const guangdong = runtimeJson(runtimeDataFile(`provinces/${guangdongEntry.file}`));
const guangdongControlLines = guangdong.records.filter((record) => record.sourceId === "official-guangdong-control-lines-2026");
assert.equal(guangdongControlLines.length, 49);
assert.equal(guangdongControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 4);
assert.equal(guangdongControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 45);
assert.deepEqual(
  guangdongControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-bachelor")
    .map((record) => record.minScore)
    .sort((left, right) => left - right),
  [425, 440],
);
assert.deepEqual(
  guangdongControlLines
    .filter((record) => record.controlLineRouteKind === "ordinary-vocational")
    .map((record) => record.minScore)
    .sort((left, right) => left - right),
  [200, 200],
);
const guangdongRankRows = guangdong.rankConversions.filter((record) =>
  record.year === 2026 && ["official-guangdong-rank-2026", "official-guangdong-special-rank-2026"].includes(record.sourceId)
);
assert.equal(guangdongRankRows.length, 8816);
assert.ok(guangdongRankRows.every((record) => record.sourceUrl === "https://eea.gd.gov.cn/ptgk/content/post_4916165.html"));

const zhejiangEntry = manifest.shards["浙江"];
assert.equal(zhejiangEntry.records, 110946);
assert.equal(zhejiangEntry.rankConversions, 428);
const zhejiang = runtimeJson(runtimeDataFile(`provinces/${zhejiangEntry.file}`));
const zhejiangControlLines = zhejiang.records.filter((record) => record.sourceId === "official-zhejiang-control-lines-2026");
assert.equal(zhejiangControlLines.length, 57);
assert.equal(zhejiangControlLines.filter((record) => record.formalScoreScope === "control-line-only").length, 2);
assert.equal(zhejiangControlLines.filter((record) => record.formalScoreScope === "special-path-only").length, 55);
assert.deepEqual(
  zhejiangControlLines
    .filter((record) => record.controlLineRouteKind === "segment")
    .map((record) => record.minScore)
    .sort((left, right) => left - right),
  [266, 494],
);

const vacancyById = new Map(vacancyRecords.map((record) => [record.id, record]));
for (const importedRecord of imported.records) {
  const expectedShardRecord = Object.fromEntries(Object.entries(importedRecord).filter(([, value]) =>
    value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)
  ));
  assert.deepEqual(vacancyById.get(importedRecord.id), expectedShardRecord, `import-to-shard field drift for ${importedRecord.id}`);
}
const borderSpecialRecords = vacancyRecords.filter((record) => record.specialPathReason === "边境专项计划");
assert.equal(borderSpecialRecords.length, 3);
assert.ok(borderSpecialRecords.every((record) => record.formalScoreScope === "special-path-only"));

const englishRecords = vacancyRecords.filter((record) => record.schoolName === "西藏民族大学" && record.majorName === "英语");
assert.equal(englishRecords.length, 6);
for (const majorCode of ["29", "31"]) {
  const codeRecords = englishRecords.filter((record) => record.majorCode === majorCode);
  assert.equal(new Set(codeRecords.map((record) => record.vacancyKey)).size, 1);
  assert.ok(codeRecords.every((record) => record.vacancyRepeatCount === 3));
}
assert.notEqual(
  englishRecords.find((record) => record.majorCode === "29").vacancyKey,
  englishRecords.find((record) => record.majorCode === "31").vacancyKey,
);

const digitalMedia = vacancyRecords.filter((record) => record.majorName === "数字媒体技术");
assert.equal(digitalMedia.length, 23);
assert.ok(digitalMedia.every((record) => record.disciplineCodes.includes("08")));
const dongying = digitalMedia.find((record) => record.schoolName === "东营职业学院" && record.vacancyRound === "17");
assert.deepEqual(dongying.eligibilityThresholds, { A: 202, B: 202 });
assert.equal(dongying.vacancyRepeatCount, 2);
assert.equal(dongying.vacancyOccurrence, 2);
assert.equal(dongying.planCount, 3);
assert.equal(dongying.tuition, "5000");

const correctedPlan = xizang.records.find((record) => record.id === "2026-xizang-plan-0a1d8e04b447e164ed");
assert.equal(correctedPlan.schoolCode, "1466");
assert.equal(correctedPlan.schoolName, "三峡大学(中外合作办学)");
assert.equal(correctedPlan.originalSchoolCode, "0329");
const xizangReadiness = core.admissionScoreLayer.provinceReadiness.rows.find((row) => row.province === "西藏");
assert.equal(xizangReadiness.readinessScore, 66);
assert.equal(xizangReadiness.status, "usable");
assert.equal(xizangReadiness.vacancyPlanRecords, 2187);
assert.equal(xizangReadiness.vacancyPlanSnapshotCount, 6099);
assert.equal(xizangReadiness.ordinaryVocationalVacancyRecords, 926);
assert.equal(xizangReadiness.planCount, 87995, "readiness annual plan count must remain unchanged");
assert.equal(xizangReadiness.vacancyPlanRecords, 2187, "vacancy records must remain separate from annual plans");
assert.equal(xizangReadiness.vacancyPlanSnapshotCount, 6099, "vacancy plan snapshots must remain separate from annual plans");
assert.ok(xizangReadiness.missing.includes("缺可计算一分一段"));
assert.ok(xizangReadiness.missing.includes("高职专科正式投档/录取数据待补（已有征集计划快照）"));

const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoShardTest = {
  state,
  profilePlanRecords,
  buildPlanOptions,
  candidatePoolsForProfile,
  scoreCandidate,
  classifyScoreBand,
  admissionDataFreshness,
  profileAdmissionRecords,
  isSpecialPathRecord,
  isVocationalPlanRecord,
  vacancyEligibilityForProfile,
  CANDIDATE_POOLS,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoShardTest;
api.state.data = core;
api.state.data.admissionScoreLayer.records = xizang.records;
api.state.data.admissionScoreLayer.rankConversions = xizang.rankConversions;

const lowProfile = {
  childType: "均衡探索型",
  score: "250",
  rank: "",
  province: "西藏",
  subject: "物理/理科",
  disciplineFocus: "08",
  interest: "数字媒体技术",
  cities: "",
  abilityProfile: "喜欢数字媒体技术和计算机实践",
  redLines: "",
  budget: "中等敏感",
  strategy: "稳健",
};
const highProfile = { ...lowProfile, score: "650", rank: "3000" };
const xizangProfileA = { ...highProfile, candidateCategory: "A类考生" };
const xizangProfileB = { ...highProfile, candidateCategory: "B类考生" };
assert.ok(api.profileAdmissionRecords(highProfile).every((record) => !record.candidateCategory), "unselected A/B category must not mix into ordinary candidates");
assert.ok(api.profileAdmissionRecords(xizangProfileA).filter((record) => record.sourceId === "official-szu-national-2024-2025-school-admission").every((record) => record.candidateCategory === "A类考生"));
assert.ok(api.profileAdmissionRecords(xizangProfileB).filter((record) => record.sourceId === "official-szu-national-2024-2025-school-admission").every((record) => record.candidateCategory === "B类考生"));
const engineering = api.CANDIDATE_POOLS.find((item) => item.id === "engineering-industry");
const lowOptions = api.buildPlanOptions(engineering, lowProfile, api.classifyScoreBand(lowProfile.score, lowProfile.rank));
assert.ok(lowOptions.some((option) => option.record.majorName === "数字媒体技术"), "real Xizang shard did not surface digital-media vacancy");
const lowVacancyOptions = lowOptions.filter((option) => option.record.formalScoreScope === "vacancy-plan-only");
assert.ok(lowVacancyOptions.length > 0, "historical vacancy signal was crowded out by annual plans");
assert.ok(lowVacancyOptions.some((option) => option.record.majorName === "数字媒体技术"));
assert.ok(lowVacancyOptions.every((option) => /历史时点快照/.test(option.focus)));
assert.ok(lowVacancyOptions.every((option) => option.scoreStatus.includes("历史低需求/补录机会信号")));
const highOptions = api.buildPlanOptions(engineering, highProfile, api.classifyScoreBand(highProfile.score, highProfile.rank));
assert.ok(highOptions.every((option) => !api.isVocationalPlanRecord(option.record)), "high-score profile leaked vocational plans");
const adversarialHighProfile = { ...highProfile, interest: "高职 专升本 数字媒体技术" };
const highRecommendations = api.candidatePoolsForProfile(adversarialHighProfile)
  .map((candidate) => api.scoreCandidate(candidate, adversarialHighProfile, api.classifyScoreBand(adversarialHighProfile.score, adversarialHighProfile.rank)))
  .sort((left, right) => right.total - left.total || right.evidence.length - left.evidence.length)
  .slice(0, 8);
assert.ok(highRecommendations.every((item) => item.id !== "vocational-dual"));
assert.ok(highRecommendations.every((item) => item.schoolOptions.every((option) => !option.record || !api.isVocationalPlanRecord(option.record))));
assert.equal(api.vacancyEligibilityForProfile(dongying, { ...lowProfile, score: "180" }).state, "below-all");

const freshness = api.admissionDataFreshness(lowProfile, "2026-07-15");
assert.equal(freshness.latestPlanYear, 2026);
assert.equal(freshness.latestAdmissionYear, 2025);
assert.equal(freshness.latestRankYear, null);
assert.equal(freshness.latestVacancyYear, 2025);
assert.equal(freshness.scheduleStage.state, "active");
assert.ok(freshness.warnings.some((warning) => /没有可计算的一分一段/.test(warning)));
assert.ok(freshness.warnings.some((warning) => /征集志愿仅是各轮剩余计划快照/.test(warning)));
assert.ok(freshness.warnings.some((warning) => /未确认对应类别时/.test(warning)));
const categoryFreshness = api.admissionDataFreshness(xizangProfileA, "2026-07-15");
assert.ok(categoryFreshness.warnings.some((warning) => /已按“?A类考生”?排除/.test(warning)));
assert.ok(api.profilePlanRecords(lowProfile).every((record) => !api.isSpecialPathRecord(record)));

const recommendations = api.CANDIDATE_POOLS
  .map((candidate) => api.scoreCandidate(candidate, lowProfile, api.classifyScoreBand(lowProfile.score, lowProfile.rank)))
  .sort((a, b) => b.total - a.total)
  .slice(0, 8);
assert.ok(recommendations.some((item) => item.schoolOptions.some((option) => option.record?.sourceId === "official-xizang-vacancy-plans-2025-v3272")));
assert.ok(recommendations.every((item) => item.schoolOptions.every((option) => !option.record || !api.isSpecialPathRecord(option.record))));

assert.equal(imported.audit.recordCount, vacancyRecords.length);
assert.equal(imported.audit.planSnapshotCount, vacancyRecords.reduce((sum, record) => sum + record.planCount, 0));

console.log(JSON.stringify({
  ok: true,
  modelVersion: manifest.modelVersion,
  provinceCount: manifest.provinceCount,
  recordCount: manifest.recordCount,
  rankConversionCount: manifest.rankConversionCount,
  xizang: {
    ...xizangEntry,
    vacancyRecords: vacancyRecords.length,
    vacancyPlanSnapshots: vacancyRecords.reduce((sum, record) => sum + record.planCount, 0),
    digitalMediaTechnologyRecords: digitalMedia.length,
    szuAorBRecords: szuXizangRecords.length,
    lowOptionSchools: lowOptions.map((option) => `${option.name}-${option.record.majorName}`),
    highVocationalOptions: highOptions.filter((option) => api.isVocationalPlanRecord(option.record)).length,
    highCandidateIds: highRecommendations.map((item) => item.id),
  },
  freshness: {
    latestPlanYear: freshness.latestPlanYear,
    latestAdmissionYear: freshness.latestAdmissionYear,
    latestRankYear: freshness.latestRankYear,
    stage: freshness.scheduleStage.text,
  },
}, null, 2));
