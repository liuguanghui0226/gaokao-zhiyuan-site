#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  admissionFit,
  admissionMultiyearSafetyBoundary,
  admissionRankBasisKey,
  setRecords(records) {
    state.data = { admissionScoreLayer: { records } };
    admissionTrendIndexCache = null;
  },
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const route = {
  province: "北京",
  subjectType: "综合",
  batch: "本科批",
  schoolName: "深圳大学",
  schoolCode: "10590",
  dataType: "major-admission",
  majorName: "计算机科学与技术",
  admissionSubtype: "普通",
  campus: "粤海校区",
  electiveRequirement: "物理+化学",
  sourceQuality: "official-school-szu-2024-2025-first-choice-major-admission",
  formalScoreScope: "school-official-only",
};
const latest = {
  ...route,
  id: "szu-2025",
  year: 2025,
  minScore: 627,
  minRankEnd: 6400,
};
const prior = {
  ...route,
  id: "szu-2024",
  year: 2024,
  minScore: 636,
  minRankEnd: 4790,
};
const profile = { province: "北京", subject: "综合", rank: "6000", score: "630" };

api.setRecords([latest, prior]);
const rankGuard = api.admissionMultiyearSafetyBoundary(latest, profile);
const guardedRankFit = api.admissionFit(latest, profile, "2026-07-30");
assert.equal(rankGuard.metric, "rank");
assert.equal(rankGuard.latestBoundary, 6400);
assert.equal(rankGuard.safetyBoundary, 4790);
assert.equal(guardedRankFit.historicalGuard.applied, true);
assert.equal(guardedRankFit.historicalGuard.scoreBefore, 86);
assert.equal(guardedRankFit.score, 42);
assert.equal(guardedRankFit.zone, "多年保护高冲");
assert.match(guardedRankFit.text, /只降低乐观程度，不会抬高候选/);

const restrictiveLatest = { ...latest, id: "restrictive-2025", minRankEnd: 4790 };
const lenientPrior = { ...prior, id: "lenient-2024", minRankEnd: 6400 };
api.setRecords([restrictiveLatest, lenientPrior]);
const noPromotion = api.admissionFit(restrictiveLatest, profile, "2026-07-30");
assert.equal(noPromotion.historicalGuard, undefined);
assert.equal(noPromotion.score, 42);
assert.equal(noPromotion.zone, "高冲");

const extremePrior = { ...prior, id: "extreme-2023", year: 2023, minRankEnd: 100 };
api.setRecords([latest, prior, extremePrior]);
const outlierGuard = api.admissionMultiyearSafetyBoundary(latest, profile);
assert.equal(outlierGuard.safetyBoundary, 4790);
assert.equal(outlierGuard.outlierDiscarded, true);

const mismatchedBasisPrior = {
  ...prior,
  id: "derived-2024",
  minScore: 0,
  rankDerivedFromScore: true,
  rankEvidenceScope: "score-derived-provincial-segment",
  rankPolicyBonusIncluded: true,
};
api.setRecords([{ ...latest, minScore: 0 }, mismatchedBasisPrior]);
assert.equal(api.admissionMultiyearSafetyBoundary({ ...latest, minScore: 0 }, profile), null);

const thirdPartyPrior = {
  ...prior,
  id: "third-party-2024",
  sourceQuality: "third-party-score-summary",
  formalScoreScope: "",
};
api.setRecords([latest, thirdPartyPrior]);
assert.equal(api.admissionMultiyearSafetyBoundary(latest, profile), null);

const specialPathPrior = {
  ...prior,
  id: "special-2024",
  formalScoreScope: "special-path-only",
};
api.setRecords([latest, specialPathPrior]);
assert.equal(api.admissionMultiyearSafetyBoundary(latest, profile), null);

const scoreRoute = {
  ...route,
  schoolName: "湖南科技大学",
  schoolCode: "10534",
  majorName: "应用统计学",
  campus: "",
  electiveRequirement: "",
  sourceQuality: "official-school-hnust-2021-2025-national-static-json-score-only",
};
const scoreLatest = { ...scoreRoute, id: "hnust-2025", year: 2025, minScore: 512 };
const scorePrior = { ...scoreRoute, id: "hnust-2024", year: 2024, minScore: 570 };
const scoreProfile = { province: "北京", subject: "综合", score: "540" };
api.setRecords([scoreLatest, scorePrior]);
const scoreGuard = api.admissionMultiyearSafetyBoundary(scoreLatest, scoreProfile);
const guardedScoreFit = api.admissionFit(scoreLatest, scoreProfile, "2026-07-30");
assert.equal(scoreGuard.metric, "score");
assert.equal(scoreGuard.safetyBoundary, 570);
assert.equal(guardedScoreFit.historicalGuard.scoreBefore, 84);
assert.equal(guardedScoreFit.score, 36);
assert.equal(guardedScoreFit.zone, "多年保护分数高冲");

const scoreExtreme = { ...scorePrior, id: "hnust-2023", year: 2023, minScore: 700 };
api.setRecords([scoreLatest, scorePrior, scoreExtreme]);
const scoreOutlierGuard = api.admissionMultiyearSafetyBoundary(scoreLatest, scoreProfile);
assert.equal(scoreOutlierGuard.safetyBoundary, 570);
assert.equal(scoreOutlierGuard.outlierDiscarded, true);

console.log(JSON.stringify({
  status: "ok",
  rankGuard: {
    latestBoundary: rankGuard.latestBoundary,
    safetyBoundary: rankGuard.safetyBoundary,
    scoreBefore: guardedRankFit.historicalGuard.scoreBefore,
    scoreAfter: guardedRankFit.score,
  },
  noPromotion: { score: noPromotion.score, zone: noPromotion.zone },
  scoreGuard: {
    latestBoundary: scoreGuard.latestBoundary,
    safetyBoundary: scoreGuard.safetyBoundary,
    scoreBefore: guardedScoreFit.historicalGuard.scoreBefore,
    scoreAfter: guardedScoreFit.score,
  },
  controls: {
    oneExtremeOutlierDiscarded: outlierGuard.outlierDiscarded && scoreOutlierGuard.outlierDiscarded,
    thirdPartyExcluded: true,
    specialPathExcluded: true,
    mismatchedRankBasisExcluded: true,
  },
}, null, 2));
