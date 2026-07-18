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
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-xinjiang-undergraduate1-filing-2025-v3311-import.json"), "utf8"));
api.state.data = { admissionScoreLayer: { structuredRecords: 505, records: payload.records, rankConversions: [], sourceNotes: payload.sourceNotes } };

const historyBeijingJiaotong = payload.records.find((record) => record.imageId === "29619" && record.schoolCode === "1004");
assert.ok(historyBeijingJiaotong);
assert.equal(historyBeijingJiaotong.schoolName, "北京交通大学");
assert.equal(historyBeijingJiaotong.minScore, 547);
assert.equal(historyBeijingJiaotong.minRankEnd, null);

const exactFit = api.admissionFit(historyBeijingJiaotong, { score: "547", rank: "17798" }, "2026-07-18");
assert.equal(exactFit.zone, "分数临界");
assert.match(exactFit.text, /分数高出近年最低分0分/);
assert.match(exactFit.text, /缺位次需复核/);
assert.doesNotMatch(exactFit.text, /近年最低位次|最低分换算位次|\d+%|概率/);

const stableFit = api.admissionFit(historyBeijingJiaotong, { score: "565", rank: "1000" }, "2026-07-18");
assert.equal(stableFit.zone, "分数稳");
assert.match(stableFit.text, /高出近年最低分18分/);
assert.match(stableFit.text, /缺位次需复核/);
assert.doesNotMatch(stableFit.text, /位次比|\d+%|概率/);

const warning = api.admissionRecordLimitWarning(historyBeijingJiaotong);
assert.equal(warning, "");
const caution = api.admissionCautionText(historyBeijingJiaotong);
assert.match(caution, /官方原图复核/);
assert.doesNotMatch(caution, /最低分换算位次|真实最低位次/);

const profile = {
  province: "新疆",
  subject: "历史类",
  score: "547",
  rank: "17798",
  disciplineFocus: "",
  cities: "",
  interest: "北京交通大学",
  abilityProfile: "",
  redLines: "",
  electives: "物理 化学",
};
const ordinary = api.profileAdmissionRecords(profile);
assert.equal(ordinary.length, 200);
assert.ok(ordinary.some((record) => record.id === historyBeijingJiaotong.id));
assert.ok(ordinary.every((record) => record.formalScoreScope !== "special-path-only"));

const candidate = {
  id: "xinjiang-beijing-jiaotong",
  disciplines: [],
  keywords: ["北京交通大学"],
  cities: [],
};
const options = api.buildAdmissionOptions(candidate, profile);
assert.equal(options.length, 2);
const option = options.find((item) => item.name === "北京交通大学");
assert.ok(option);
assert.equal(option.name, "北京交通大学");
assert.equal(option.record.id, historyBeijingJiaotong.id);
assert.ok(option.tags.includes("最低分547"));
assert.ok(!option.tags.some((tag) => /^位次/.test(tag)));
assert.equal(option.scoreStatus, "已接入本科投档线，位次待补");
assert.match(option.focus, /缺位次需复核/);
assert.match(option.focus, /官方原图复核/);
assert.doesNotMatch(option.focus, /\d+%|录取概率/);

const physicsFloor = payload.records.find((record) => record.subjectType === "物理类" && record.minScore === 421);
assert.ok(physicsFloor);
const belowFit = api.admissionFit(physicsFloor, { score: "300", rank: "999999" }, "2026-07-18");
assert.equal(belowFit.zone, "分数高冲");
assert.match(belowFit.text, /低于近年最低分121分/);
assert.match(belowFit.text, /缺位次需复核/);
assert.doesNotMatch(belowFit.text, /\d+%|概率/);

console.log(JSON.stringify({
  ok: true,
  exactFit: exactFit.text,
  stableFit: stableFit.text,
  scoreStatus: option.scoreStatus,
  recommendation: { school: option.name, tags: option.tags },
  lowScoreBoundary: belowFit.text,
}, null, 2));
