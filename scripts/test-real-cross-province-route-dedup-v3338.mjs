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
globalThis.__gaokaoTest = { dedupeAdmissionRecords };`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const { dedupeAdmissionRecords } = context.__gaokaoTest;

function readShard(name) {
  return JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/${name}.json.gz`))).toString("utf8"),
  );
}

function recordsFor(records, schoolName, majorName) {
  return records.filter((record) =>
    record.year === 2025 &&
    record.schoolName === schoolName &&
    record.majorName === majorName
  );
}

const beijing = readShard("beijing").records;
const jiangxi = readShard("jiangxi").records;
const beijingSport = recordsFor(beijing, "北京体育大学", "院校专业组投档线");
const centralAcademy = recordsFor(beijing, "中央美术学院", "院校专业组投档线");
const shenyangAgricultural = recordsFor(beijing, "沈阳农业大学", "院校投档线");
const minzuElectronic = recordsFor(beijing, "中央民族大学", "电子信息类");
const jiangxiFinanceSoftware = recordsFor(jiangxi, "江西财经大学", "软件工程(VR软件开发）");

assert.equal(beijingSport.length, 8);
assert.equal(dedupeAdmissionRecords(beijingSport).length, 8, "eight official professional groups must remain");
assert.equal(centralAcademy.length, 4);
assert.equal(dedupeAdmissionRecords(centralAcademy).length, 4, "four official professional groups must remain");
assert.equal(shenyangAgricultural.length, 2);
assert.equal(dedupeAdmissionRecords(shenyangAgricultural).length, 2, "ordinary and cooperation routes must remain");

assert.equal(minzuElectronic.length, 2);
const minzuDeduped = dedupeAdmissionRecords(minzuElectronic);
assert.equal(minzuDeduped.length, 1, "same route and score must collapse");
assert.equal(
  minzuDeduped[0].formalScoreScope,
  "school-official-only",
  "school-official evidence must replace the third-party duplicate",
);

assert.equal(jiangxiFinanceSoftware.length, 2);
assert.equal(dedupeAdmissionRecords(jiangxiFinanceSoftware).length, 1, "Jiangxi score-summary duplicate must collapse");

console.log(JSON.stringify({
  status: "ok",
  preservedRoutes: {
    beijingSportUniversity: dedupeAdmissionRecords(beijingSport).length,
    centralAcademyOfFineArts: dedupeAdmissionRecords(centralAcademy).length,
    shenyangAgriculturalUniversity: dedupeAdmissionRecords(shenyangAgricultural).length,
  },
  preferredEvidence: {
    school: minzuDeduped[0].schoolName,
    major: minzuDeduped[0].majorName,
    formalScoreScope: minzuDeduped[0].formalScoreScope,
  },
  collapsedJiangxiDuplicate: dedupeAdmissionRecords(jiangxiFinanceSoftware).length,
}, null, 2));
