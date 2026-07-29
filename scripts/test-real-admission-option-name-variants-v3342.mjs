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
globalThis.__gaokaoTest = { admissionRecordsShareRoute, dedupeAdmissionRecords };`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

function readShard(name) {
  return JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/${name}.json.gz`))).toString("utf8"),
  ).records;
}

const beijing = readShard("beijing");
const vocationalAliases = beijing.filter((record) =>
  ["2025-d37e661d958f8489", "2025-beijing-voc-filing-3607e463e96749dfc5"].includes(record.id)
);
assert.equal(vocationalAliases.length, 2);
assert.equal(api.admissionRecordsShareRoute(vocationalAliases[0], vocationalAliases[1]), true);
const vocationalWinner = api.dedupeAdmissionRecords(vocationalAliases);
assert.equal(vocationalWinner.length, 1);
assert.equal(vocationalWinner[0].id, "2025-beijing-voc-filing-3607e463e96749dfc5");

const cufeVariants = beijing.filter((record) =>
  record.schoolName === "中央财经大学" &&
  ["财政学(财政理论与政策)", "财政学（财政理论与政策）"].includes(record.majorName) &&
  [2023, 2024].includes(record.year)
);
assert.equal(cufeVariants.length, 2);
const cufeWinner = api.dedupeAdmissionRecords(cufeVariants);
assert.equal(cufeWinner.length, 1);
assert.equal(cufeWinner[0].year, 2024);
assert.equal(cufeWinner[0].majorName, "财政学（财政理论与政策）");

const liaoning = readShard("liaoning");
const dalianPhysicsConflicts = liaoning.filter((record) =>
  ["2025-4903ec8571bc6ed9", "2025-e7870c193e6be7bf"].includes(record.id)
);
assert.equal(dalianPhysicsConflicts.length, 2);
assert.equal(api.admissionRecordsShareRoute(dalianPhysicsConflicts[0], dalianPhysicsConflicts[1]), false);
assert.equal(api.dedupeAdmissionRecords(dalianPhysicsConflicts).length, 2);

const nursingCooperationConflicts = liaoning.filter((record) =>
  ["2025-efe84bca4369b6b4", "2025-e2755d8591aa3a8c"].includes(record.id)
);
assert.equal(nursingCooperationConflicts.length, 2);
assert.equal(api.admissionRecordsShareRoute(
  nursingCooperationConflicts[0],
  nursingCooperationConflicts[1],
), false);
assert.equal(api.dedupeAdmissionRecords(nursingCooperationConflicts).length, 2);

console.log(JSON.stringify({
  status: "ok",
  officialTypographyWinner: {
    school: vocationalWinner[0].schoolName,
    major: vocationalWinner[0].majorName,
    sourceQuality: vocationalWinner[0].sourceQuality,
  },
  crossYearTypographyWinner: {
    school: cufeWinner[0].schoolName,
    major: cufeWinner[0].majorName,
    year: cufeWinner[0].year,
  },
  preservedBoundaryConflicts: {
    dalianPhysics: dalianPhysicsConflicts.map((record) => record.minScore).sort(),
    nursingCooperation: nursingCooperationConflicts.map((record) => record.minScore).sort(),
  },
}, null, 2));
