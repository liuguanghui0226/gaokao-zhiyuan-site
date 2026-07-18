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
globalThis.__gaokaoTest = {
  state, admissionFit, admissionRecordLimitWarning, admissionCautionText,
  buildAdmissionOptions, profileAdmissionRecords,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-xinjiang-undergraduate2-filing-2025-v3312-import.json"), "utf8"));
api.state.data = { admissionScoreLayer: { structuredRecords: 1076, records: payload.records, rankConversions: [], sourceNotes: payload.sourceNotes } };

const historyXinjiangTech = payload.records.find((record) => record.imageId === "29671" && record.schoolCode === "1590");
assert.ok(historyXinjiangTech);
assert.equal(historyXinjiangTech.schoolName, "新疆科技学院");
assert.equal(historyXinjiangTech.minScore, 372);
assert.equal(historyXinjiangTech.minRankEnd, null);

const exactFit = api.admissionFit(historyXinjiangTech, { score: "372", rank: "90000" }, "2026-07-18");
assert.equal(exactFit.zone, "分数临界");
assert.match(exactFit.text, /分数高出近年最低分0分/);
assert.match(exactFit.text, /缺位次需复核/);
assert.doesNotMatch(exactFit.text, /近年最低位次|最低分换算位次|\d+%|概率/);

const stableFit = api.admissionFit(historyXinjiangTech, { score: "400", rank: "70000" }, "2026-07-18");
assert.equal(stableFit.zone, "分数稳");
assert.match(stableFit.text, /高出近年最低分28分/);
assert.match(stableFit.text, /缺位次需复核/);
assert.doesNotMatch(stableFit.text, /位次比|\d+%|概率/);

assert.equal(api.admissionRecordLimitWarning(historyXinjiangTech), "");
assert.match(api.admissionCautionText(historyXinjiangTech), /官方原图复核/);

const historyProfile = {
  province: "新疆",
  subject: "历史类",
  score: "372",
  rank: "90000",
  disciplineFocus: "",
  cities: "",
  interest: "新疆科技学院 广东培正学院",
  abilityProfile: "",
  redLines: "",
  electives: "历史 政治",
};
const ordinaryHistory = api.profileAdmissionRecords(historyProfile);
assert.equal(ordinaryHistory.length, 457);
assert.ok(ordinaryHistory.some((record) => record.id === historyXinjiangTech.id));
assert.ok(ordinaryHistory.every((record) => record.dataType !== "admission-plan" && !record.noFiling));

const candidate = {
  id: "xinjiang-undergraduate2-boundary",
  disciplines: [],
  keywords: ["新疆科技学院", "广东培正学院"],
  cities: [],
};
const options = api.buildAdmissionOptions(candidate, historyProfile);
assert.ok(options.some((item) => item.name === "新疆科技学院"));
assert.ok(!options.some((item) => item.name === "广东培正学院"));
const option = options.find((item) => item.name === "新疆科技学院");
assert.ok(option.tags.includes("最低分372"));
assert.ok(!option.tags.some((tag) => /^位次/.test(tag)));
assert.equal(option.scoreStatus, "已接入本科投档线，位次待补");
assert.match(option.focus, /缺位次需复核/);
assert.doesNotMatch(option.focus, /\d+%|录取概率/);

const physicsFloor = payload.records.find((record) => record.subjectType === "物理类" && record.minScore === 280);
assert.ok(physicsFloor);
const belowFit = api.admissionFit(physicsFloor, { score: "260", rank: "999999" }, "2026-07-18");
assert.equal(belowFit.zone, "分数高冲");
assert.match(belowFit.text, /低于近年最低分20分/);
assert.match(belowFit.text, /缺位次需复核/);
assert.doesNotMatch(belowFit.text, /\d+%|概率/);

const noFilingSample = payload.records.find((record) => record.imageId === "29672" && record.schoolCode === "1940");
assert.ok(noFilingSample?.noFiling);
assert.equal(noFilingSample.minScore, null);
assert.ok(!ordinaryHistory.some((record) => record.id === noFilingSample.id));

console.log(JSON.stringify({
  ok: true,
  exactFit: exactFit.text,
  stableFit: stableFit.text,
  recommendation: { school: option.name, tags: option.tags },
  noFilingExcluded: noFilingSample.schoolName,
  lowScoreBoundary: belowFit.text,
}, null, 2));
