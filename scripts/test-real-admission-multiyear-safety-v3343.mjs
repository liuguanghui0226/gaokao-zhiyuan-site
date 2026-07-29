#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
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
  setRecords(records) {
    state.data = { admissionScoreLayer: { records } };
    admissionTrendIndexCache = null;
  },
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const shard = JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(root, "site/data/release-v3.275/jiangxi.json.gz"))
).toString("utf8"));
const records = shard.records.filter((record) =>
  record.schoolName === "西安科技大学" &&
  record.majorName === "建筑环境与能源应用工程" &&
  [2024, 2025].includes(Number(record.year))
);
assert.equal(records.length, 2);
const latest = records.find((record) => Number(record.year) === 2025);
const prior = records.find((record) => Number(record.year) === 2024);
assert.equal(latest.minRankEnd, 95753);
assert.equal(prior.minRankEnd, 23904);

api.setRecords(shard.records);
const profile = {
  province: "江西",
  subject: "物理",
  rank: "50000",
  score: "550",
};
const guard = api.admissionMultiyearSafetyBoundary(latest, profile);
const fit = api.admissionFit(latest, profile, "2026-07-30");
assert.equal(guard.metric, "rank");
assert.equal(guard.latestBoundary, 95753);
assert.equal(guard.safetyBoundary, 23904);
assert.equal(fit.historicalGuard.applied, true);
assert.equal(fit.historicalGuard.scoreBefore, 94);
assert.equal(fit.score, 42);
assert.equal(fit.zone, "多年保护高冲");
assert.match(fit.text, /2025年95,753名/);
assert.match(fit.text, /2024年23,904名/);

console.log(JSON.stringify({
  status: "ok",
  sample: {
    province: latest.province,
    schoolName: latest.schoolName,
    majorName: latest.majorName,
    latest: { year: latest.year, minScore: latest.minScore, minRankEnd: latest.minRankEnd },
    prior: { year: prior.year, minScore: prior.minScore, minRankEnd: prior.minRankEnd },
    profileRank: Number(profile.rank),
    scoreBefore: fit.historicalGuard.scoreBefore,
    scoreAfter: fit.score,
    zoneAfter: fit.zone,
  },
}, null, 2));
