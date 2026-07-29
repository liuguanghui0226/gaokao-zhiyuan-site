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
  admissionTrendKey,
  admissionTrendSeries,
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
  );
}

const beijing = readShard("beijing").records;
const jiangxi = readShard("jiangxi").records;
api.setTrendRecords([...beijing, ...jiangxi]);

const minzu = beijing.filter((record) =>
  record.schoolName === "中央民族大学" &&
  record.majorName === "电子信息类"
);
const minzuSeries = api.admissionTrendSeries(minzu);
assert.equal(minzuSeries.length, 4);
assert.ok(minzuSeries.every((record) => record.formalScoreScope === "school-official-only"));
const minzuThird2025 = minzu.find((record) => record.year === 2025 && /third-party/.test(record.sourceQuality));
const minzuTrend = api.trendForRecord(minzuThird2025);
assert.equal(minzuTrend.bonus, 5);
assert.equal(minzuTrend.evidenceLabel, "");
assert.match(minzuTrend.text, /2025年7,249/);
assert.match(minzuTrend.text, /2024年6,848/);

const xidian = beijing.filter((record) =>
  record.schoolName === "西安电子科技大学" &&
  record.majorName === "计算机类"
);
assert.equal(xidian.length, 4);
const xidian2025 = xidian.find((record) => record.year === 2025);
const xidianTrend = api.trendForRecord(xidian2025);
assert.ok(xidianTrend.label.startsWith("近两年"));
assert.doesNotMatch(xidianTrend.text, /2023年|2022年/);
assert.notEqual(api.admissionTrendKey(xidian2025), api.admissionTrendKey(xidian.find((record) => record.year === 2023)));

const acupuncture = beijing.filter((record) =>
  record.schoolName === "湖南中医药大学" &&
  record.majorName === "针灸推拿学"
);
assert.equal(acupuncture.length, 2);
assert.notEqual(api.admissionTrendKey(acupuncture[0]), api.admissionTrendKey(acupuncture[1]));
assert.equal(api.trendForRecord(acupuncture.find((record) => record.year === 2025)), null);

const jxufeDataScience = jiangxi.filter((record) =>
  record.schoolName === "江西财经大学" &&
  record.majorName === "数据科学与大数据技术" &&
  !record.majorGroup
);
const jxufeTrend = api.trendForRecord(jxufeDataScience.find((record) => record.year === 2025));
assert.equal(jxufeTrend.bonus, 2);
assert.equal(jxufeTrend.evidenceLabel, "趋势含待复核第三方");
assert.match(jxufeTrend.caution, /待复核第三方摘要/);

console.log(JSON.stringify({
  status: "ok",
  officialFirst: {
    school: "中央民族大学",
    major: "电子信息类",
    years: minzuSeries.map((record) => record.year),
    source: "school-official-only",
  },
  routeIsolation: {
    xidianVisibleYears: [2025, 2024],
    xidianExcludedYears: [2023, 2022],
    hunanTcmCrossCampusTrend: null,
  },
  thirdPartyTrend: {
    school: "江西财经大学",
    bonus: jxufeTrend.bonus,
    warning: jxufeTrend.evidenceLabel,
  },
}, null, 2));
