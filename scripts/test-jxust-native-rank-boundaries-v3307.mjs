#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, admissionFit, admissionRecordLimitWarning, isScoreDerivedRankRecord, profileAdmissionRecords };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2023-2025-v3307-jxust-import.json"), "utf8"));
api.state.data = { admissionScoreLayer: { records: payload.records, rankConversions: [], sourceNotes: payload.sourceNotes } };

const computer = payload.records.find((record) => record.id === "jxust-2025-5333");
assert.ok(computer);
assert.equal(api.isScoreDerivedRankRecord(computer), false);
const fit = api.admissionFit(computer, { score: "593", rank: "17798" }, "2026-07-17");
assert.match(fit.text, /近年最低位次/);
assert.doesNotMatch(fit.text, /最低分换算位次/);
const warning = api.admissionRecordLimitWarning(computer);
assert.match(warning, /学校官网单校录取边界/);
assert.doesNotMatch(warning, /一分一段表换算/);
assert.match(warning, /不能单独推断录取概率/);

const profile = {
  province: "江西",
  subject: "物理类",
  score: "593",
  rank: "17798",
  disciplineFocus: "08",
  redLines: "",
  electiveSubjects: ["化学"],
};
const ordinaryCandidates = api.profileAdmissionRecords(profile);
assert.ok(ordinaryCandidates.some((record) => record.id === computer.id));
assert.ok(ordinaryCandidates.every((record) => record.formalScoreScope !== "special-path-only"));
const special = payload.records.find((record) => record.formalScoreScope === "special-path-only" && record.province === "江西");
assert.ok(special);
assert.ok(!ordinaryCandidates.some((record) => record.id === special.id));

console.log(JSON.stringify({
  ok: true,
  fitText: fit.text,
  warning,
  ordinaryCandidateCount: ordinaryCandidates.length,
  specialPathExcluded: special.id,
}, null, 2));
