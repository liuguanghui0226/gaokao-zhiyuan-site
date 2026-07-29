#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume test execution.");
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { admissionRouteTags, dedupeAdmissionRecords };`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

function readShard(name) {
  return JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/${name}.json.gz`))).toString("utf8"),
  ).records;
}

const hebei = readShard("hebei");
const pediatrics = hebei.filter((record) =>
  record.year === 2025 &&
  record.subjectType === "物理类" &&
  record.schoolName === "河北医科大学" &&
  record.majorName === "儿科学" &&
  record.dataType === "major-admission"
);
assert.equal(pediatrics.length, 3);
const pediatricsDeduped = api.dedupeAdmissionRecords(pediatrics);
assert.equal(pediatricsDeduped.length, 3);
assert.deepEqual(
  [...pediatricsDeduped.map((record) => record.batch)].sort(),
  ["国家专项计划", "地方专项计划", "本科批"].sort(),
);

const liaoning = readShard("liaoning");
const dalianLawHistory = liaoning.filter((record) =>
  record.year === 2025 &&
  record.subjectType === "历史类" &&
  record.schoolName === "大连大学" &&
  record.majorName === "法学"
);
assert.equal(dalianLawHistory.length, 3);
const dalianLawDeduped = api.dedupeAdmissionRecords(dalianLawHistory);
assert.equal(dalianLawDeduped.length, 1, "ordinary batch aliases must still collapse");
assert.match(dalianLawDeduped[0].sourceQuality, /official/);
assert.equal(dalianLawDeduped[0].minScore, 557);

const shandong = readShard("shandong");
const sanyaMarketing = shandong.filter((record) =>
  record.year === 2025 &&
  record.schoolName === "三亚中瑞酒店管理职业学院" &&
  record.majorName === "市场营销(奢侈品营销方向)" &&
  ["普通类常规批第2次志愿", "普通类常规批第3次志愿"].includes(record.batch)
);
assert.equal(sanyaMarketing.length, 2);
assert.equal(api.dedupeAdmissionRecords(sanyaMarketing).length, 2);
assert.ok(api.admissionRouteTags(sanyaMarketing[0]).includes("普通类常规批第2次志愿"));
assert.ok(api.admissionRouteTags(sanyaMarketing[1]).includes("普通类常规批第3次志愿"));

console.log(JSON.stringify({
  status: "ok",
  preserved: {
    hebeiMedicalPediatrics: pediatricsDeduped.map((record) => record.batch).sort(),
    shandongVacancyRounds: sanyaMarketing.map((record) => record.batch).sort(),
  },
  retainedAliasEvidencePreference: {
    school: dalianLawDeduped[0].schoolName,
    major: dalianLawDeduped[0].majorName,
    sourceQuality: dalianLawDeduped[0].sourceQuality,
    minScore: dalianLawDeduped[0].minScore,
  },
}, null, 2));
