#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/province-plan-readiness.json.gz");
assert.ok(fs.existsSync(assetFile), "province plan readiness runtime asset must exist");
const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(manifest.version, "v3.364");
assert.equal(manifest.applicationPlanReadiness.currentYear, 2026);
assert.equal(manifest.applicationPlanReadiness.currentPlanConfirmedGroups, 3768);
assert.equal(manifest.applicationPlanReadiness.currentPlanCoverageRate, 0.009676);
assert.equal(manifest.applicationPlanReadiness.provincesWithCurrentYearMatches, 31);
assert.equal(manifest.applicationPlanReadiness.provincesWithPlans, 31);
assert.equal(manifest.provinceRows.length, 31);
assert.ok(manifest.provinceRows.some((row) => row.province === "吉林"));
assert.ok(manifest.provinceRows.some((row) => row.province === "西藏"));

const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex >= 0, "could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  provincePlanReadinessRows,
  renderProvincePlanReadiness,
  setPlanManifest(value) {
    state.planReadinessManifest = value;
  },
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
api.setPlanManifest(manifest);

const rows = api.provincePlanReadinessRows();
assert.equal(rows.length, 31);
assert.ok(rows[0].recentPlanCoverageRate > 0);
assert.equal(rows[0].priorityLabel, "重点补数");
assert.ok(rows.some((row) => row.province === "吉林" && row.currentYearTransitionMatchedCandidateGroups > 0));
assert.ok(rows.every((row) => row.currentYearMatchedCandidateGroups > 0));
assert.ok(rows.every((row) => row.recentPlanCoverageRate >= 0 && row.recentPlanCoverageRate <= 1));

const html = api.renderProvincePlanReadiness();
assert.match(html, /逐省计划证据进度/);
assert.match(html, /2026计划已佐证 3,768 \/ 389,435/);
assert.match(html, /0\.97%/);
assert.match(html, /计划未命中只表示待核，不表示停招/);
assert.match(html, /吉林/);
assert.match(html, /西藏/);
assert.match(html, /重点补数/);
assert.match(html, /近两年计划匹配/);
assert.match(html, /2026衔接匹配/);
assert.match(html, /2026计划匹配/);

console.log(JSON.stringify({
  status: "ok",
  version: manifest.version,
  provinceCount: rows.length,
  currentPlanConfirmedGroups: manifest.applicationPlanReadiness.currentPlanConfirmedGroups,
  currentPlanCoverageRate: manifest.applicationPlanReadiness.currentPlanCoverageRate,
  firstPriorityProvinces: rows.slice(0, 5).map((row) => row.province),
}, null, 2));
