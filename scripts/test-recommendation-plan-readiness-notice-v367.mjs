#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");
const bootIndex = app.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(
  app,
  /renderDataFreshnessPanel\(rec\.profile\)[\s\S]*?renderRecommendationPlanReadinessNotice\(rec\.profile\)/,
  "Recommendation results must surface the selected province's plan-readiness evidence",
);

const instrumented = `${app.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  recommendationPlanReadinessForProfile,
  renderRecommendationPlanReadinessNotice,
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const {
  recommendationPlanReadinessForProfile,
  renderRecommendationPlanReadinessNotice,
} = context.__gaokaoTest;

const manifest = {
  coverageScope: {
    currentYear: 2026,
    recentPlanYears: [2025, 2026],
  },
  provinceRows: [
    {
      province: "西藏",
      candidateGroups: 10000,
      eligibleRecentPlans: 120,
      exactRouteMatchedCandidateGroups: 3,
      routeTransitionMatchedCandidateGroups: 4,
      recentPlanMatchedCandidateGroups: 7,
      exactCurrentYearMatchedCandidateGroups: 3,
      transitionCurrentYearMatchedCandidateGroups: 2,
      currentYearMatchedCandidateGroups: 5,
    },
    {
      province: "江西",
      candidateGroups: 2000,
      eligibleRecentPlans: 80,
      exactRouteMatchedCandidateGroups: 20,
      routeTransitionMatchedCandidateGroups: 0,
      recentPlanMatchedCandidateGroups: 20,
      exactCurrentYearMatchedCandidateGroups: 20,
      transitionCurrentYearMatchedCandidateGroups: 0,
      currentYearMatchedCandidateGroups: 20,
    },
  ],
};

const readiness = recommendationPlanReadinessForProfile({ province: "西藏自治区" }, manifest);
assert.equal(readiness.province, "西藏");
assert.equal(readiness.currentYear, 2026);
assert.equal(readiness.currentYearMatchedCandidateGroups, 5);
assert.equal(readiness.currentYearCoverageRate, 0.0005);
assert.equal(readiness.priorityLabel, "重点补数");

const markup = renderRecommendationPlanReadinessNotice({ province: "西藏自治区" }, manifest);
assert.match(markup, /西藏2026计划证据匹配/);
assert.match(markup, /5\s*\/\s*10,000（0\.05%）/);
assert.match(markup, /严格匹配 3/);
assert.match(markup, /批次衔接匹配 2/);
assert.match(markup, /近两年匹配 7/);
assert.match(markup, /可用计划 120/);
assert.match(markup, /重点补数/);
assert.match(markup, /未匹配只表示本地证据待核，不表示停招/);

assert.equal(
  renderRecommendationPlanReadinessNotice({ province: "北京" }, manifest),
  "",
  "A missing province row must not fabricate readiness evidence",
);

console.log(JSON.stringify({
  status: "ok",
  province: readiness.province,
  currentYearCoverageRate: readiness.currentYearCoverageRate,
  visibleExactAndTransitionCounts: true,
  unknownDoesNotMeanDiscontinued: true,
}, null, 2));
