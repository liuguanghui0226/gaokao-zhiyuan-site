#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const readGzip = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(release, name))).toString("utf8"));
const core = readGzip("knowledge-core.json.gz");
const jiangxi = readGzip("jiangxi.json.gz");
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  state,
  scoreCandidate,
  classifyProfileBand,
  buildApplicationPlan,
  applicationPlanDetail,
  renderAdmissionHitPanel,
  CANDIDATE_POOLS,
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
api.state.data = {
  ...core,
  admissionScoreLayer: {
    ...core.admissionScoreLayer,
    records: jiangxi.records,
    rankConversions: jiangxi.rankConversions,
  },
};

const profile = {
  childType: "均衡探索型",
  score: "593",
  rank: "17798",
  province: "江西",
  subject: "物理/理科",
  selectedSubjects: ["物理", "化学", "生物"],
  disciplineFocus: "08",
  interest: "计算机 软件 数据 数字媒体 虚拟现实",
  cities: "南昌 武汉 长沙 重庆 西安 杭州",
  abilityProfile: "英语较好，喜欢数字内容与计算机实践",
  redLines: "",
  budget: "中等敏感",
  strategy: "均衡",
};
const band = api.classifyProfileBand(profile);
const engineering = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "engineering-industry");
const elite = api.CANDIDATE_POOLS.find((candidate) => candidate.id === "elite-platform");
const engineeringResult = api.scoreCandidate(engineering, profile, band);
const eliteResult = api.scoreCandidate(elite, profile, band);

assert.equal(engineeringResult.confidence, "B", "the real Jiangxi third-party best match must not remain A/A-");
assert.ok(engineeringResult.total <= 72, "third-party evidence must cap the displayed score");
assert.ok(engineeringResult.warnings.some((warning) => warning.includes("待复核第三方摘要")));
assert.ok(
  eliteResult.schoolOptions.every((option) => option.name !== "南昌大学共青学院"),
  "Nanchang University Gongqing College must not appear in the elite pool",
);

const tiers = api.buildApplicationPlan([engineeringResult, eliteResult]);
const review = tiers.find((tier) => tier.id === "review");
assert.ok(review?.options.length, "the real Jiangxi third-party candidates must be isolated for review");
assert.equal(review.label, "待复核数据候选");
assert.ok(
  review.options.every((option) => api.applicationPlanDetail(option).sourceLabel === "待复核第三方录取摘要"),
  "review-tier source labels must not claim an official source",
);
const logicalKeys = tiers.flatMap((tier) => tier.options).map((option) => [
  option.record.province,
  option.record.subjectType,
  option.record.schoolName,
  option.record.majorName || option.record.majorGroup,
  option.record.majorGroup,
  option.record.dataType,
].join("|"));
assert.equal(new Set(logicalKeys).size, logicalKeys.length, "application plan school-major identities must be unique");
const hitPanel = api.renderAdmissionHitPanel(profile);
assert.equal(
  hitPanel.split("江西财经大学 · 软件工程(VR软件开发）").length - 1,
  1,
  "the matched-admission summary must reuse logical deduplication",
);

console.log(JSON.stringify({
  status: "ok",
  sample: { province: profile.province, score: profile.score, rank: profile.rank },
  engineering: {
    total: engineeringResult.total,
    confidence: engineeringResult.confidence,
    topSchool: engineeringResult.schoolOptions[0]?.name,
    topMajor: engineeringResult.schoolOptions[0]?.record?.majorName,
  },
  reviewOptions: review.options.length,
  eliteIncludesIndependentCollege: false,
  logicalDuplicates: 0,
  matchedSummaryDuplicates: 0,
}, null, 2));
