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
globalThis.__gaokaoTest = {
  admissionTrendCanonicalMergeSafe,
  admissionTrendExactKey,
  admissionTrendKey,
  trendForRecord,
  setTrendRecords(records) {
    state.data = { admissionScoreLayer: { records } };
    admissionTrendIndexCache = null;
  },
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

function readShard(name) {
  return JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/${name}.json.gz`))).toString("utf8"),
  ).records;
}

const beijing = readShard("beijing");
const zhejiang = readShard("zhejiang");
const liaoning = readShard("liaoning");
api.setTrendRecords([...beijing, ...zhejiang, ...liaoning]);

const cufe = beijing.filter((record) =>
  record.schoolName === "中央财经大学" &&
  /大数据管理与应用.*许国志大数据英才班/.test(record.majorName) &&
  [2024, 2023].includes(Number(record.year))
);
assert.equal(cufe.length, 2);
assert.equal(api.admissionTrendKey(cufe[0]), api.admissionTrendKey(cufe[1]));
assert.notEqual(api.admissionTrendExactKey(cufe[0]), api.admissionTrendExactKey(cufe[1]));
const cufeTrend = api.trendForRecord(cufe.find((record) => record.year === 2024));
assert.match(cufeTrend.text, /2024年645/);
assert.match(cufeTrend.text, /2023年642/);

const tsinghua = zhejiang.filter((record) =>
  /清华大学.*一流大学建设高校/.test(record.schoolName) &&
  record.majorName === "文科试验班类(通用基础类)" &&
  [2022, 2021].includes(Number(record.year))
);
assert.equal(tsinghua.length, 2);
assert.equal(api.admissionTrendKey(tsinghua[0]), api.admissionTrendKey(tsinghua[1]));
assert.notEqual(api.admissionTrendExactKey(tsinghua[0]), api.admissionTrendExactKey(tsinghua[1]));
const tsinghuaTrend = api.trendForRecord(tsinghua.find((record) => record.year === 2022));
assert.match(tsinghuaTrend.text, /2022年1/);
assert.match(tsinghuaTrend.text, /2021年2/);

const hnust = beijing.filter((record) =>
  record.schoolName === "湖南科技大学" &&
  record.majorName === "化学工程与工艺" &&
  [2023, 2022].includes(Number(record.year))
);
assert.equal(hnust.length, 2);
assert.equal(api.admissionTrendKey(hnust[0]), api.admissionTrendKey(hnust[1]));
assert.notEqual(api.admissionTrendExactKey(hnust[0]), api.admissionTrendExactKey(hnust[1]));
const hnustTrend = api.trendForRecord(hnust.find((record) => record.year === 2023));
assert.match(hnustTrend.text, /2023年511/);
assert.match(hnustTrend.text, /2022年491/);

const conflict = liaoning.filter((record) =>
  record.schoolName === "辽宁中医药大学" &&
  /护理学.*中外合作办学/.test(record.majorName) &&
  [2025, 2024, 2023].includes(Number(record.year))
);
assert.ok(conflict.length >= 5);
assert.equal(api.admissionTrendCanonicalMergeSafe(conflict), false);
const ascii2025 = conflict.find((record) =>
  record.year === 2025 &&
  record.majorName === "护理学(中外合作办学)" &&
  Number(record.minScore) === 468
);
const conflictFallbackTrend = api.trendForRecord(ascii2025);
assert.match(conflictFallbackTrend.text, /2025年468/);
assert.match(conflictFallbackTrend.text, /2023年458/);
assert.doesNotMatch(conflictFallbackTrend.text, /2025年469/);

console.log(JSON.stringify({
  status: "ok",
  recovered: {
    majorTypography: { school: "中央财经大学", scores: [645, 642] },
    schoolTypography: { school: "清华大学", ranks: [1, 2] },
    electiveTypography: { school: "湖南科技大学", scores: [511, 491] },
  },
  conflictFallback: {
    school: "辽宁中医药大学",
    major: "护理学(中外合作办学)",
    scores: [468, 458],
  },
}, null, 2));
