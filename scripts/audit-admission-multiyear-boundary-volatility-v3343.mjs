#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(root, "site/data/release-v3.275");
const outputFile = path.join(root, "data/admissions/evidence-v3343-admission-multiyear-boundary-volatility-manifest.json");
const generatedAt = "2026-07-30T06:30:00+08:00";
const genericMajorPattern = /^(院校投档线|院校专业组投档线|学校录取分数线|院校最低分|专业组投档线|投档线)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function canonicalTypography(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•‧∙・]/g, "·")
    .replace(/[‐‑‒–—―﹘﹣－]/g, "-")
    .replace(/[【〔〖［]/g, "[")
    .replace(/[】〕〗］]/g, "]")
    .replace(/[〈《]/g, "<")
    .replace(/[〉》]/g, ">");
}

function evidencePriority(record) {
  if (/third-party/.test(String(record?.sourceQuality || ""))) return 0;
  if (record?.formalScoreScope === "school-official-only") return 2;
  if (/official/.test(String(record?.sourceQuality || ""))) return 3;
  return 1;
}

function isNamedMajor(record) {
  const majorName = normalize(record?.majorName);
  return ["major-admission", "vocational-admission"].includes(record?.dataType) &&
    record?.formalScoreScope !== "special-path-only" &&
    Boolean(majorName) &&
    !genericMajorPattern.test(majorName);
}

function routeFields(record, canonical = true) {
  const clean = canonical ? canonicalTypography : normalize;
  return {
    group: clean(record?.majorGroup),
    subtype: clean(record?.admissionSubtype),
    campus: clean(record?.campus || record?.campusName || record?.schoolCampus),
    tuition: clean(record?.tuition || record?.tuitionFee),
    elective: clean(record?.electiveRequirement),
    majorCode: clean(record?.majorCode),
    rankScope: clean(record?.rankInstitutionScope),
  };
}

function trendKey(record, canonical = true) {
  const clean = canonical ? canonicalTypography : normalize;
  const route = routeFields(record, canonical);
  return [
    record.province || "",
    record.subjectType || "",
    record.batch || "",
    record.schoolName || record.schoolCode || "",
    record.dataType || "",
    record.majorName || "",
    route.group,
    route.subtype,
    route.campus,
    route.tuition,
    route.elective,
    route.majorCode,
    route.rankScope,
  ].map(clean).join("|");
}

function boundarySignature(record) {
  return [
    Number(record?.minScore) || 0,
    Number(record?.minRankEnd || record?.minRank) || 0,
  ].join("|");
}

function canonicalMergeSafe(records) {
  const exactKeys = new Set(records.map((record) => trendKey(record, false)));
  if (exactKeys.size < 2) return true;
  const boundariesByYear = new Map();
  for (const record of records) {
    const year = Number(record.year) || 0;
    if (!boundariesByYear.has(year)) boundariesByYear.set(year, new Set());
    boundariesByYear.get(year).add(boundarySignature(record));
  }
  return [...boundariesByYear.values()].every((signatures) => signatures.size <= 1);
}

function eligibilityBasisKey(record) {
  return [
    record?.candidateCategory || record?.candidateClass || "",
    record?.rankUsage || "",
    record?.rankCategory || "",
    record?.rankLevelUsage || "",
  ].map(normalize).join("|");
}

function rankBasisKey(record) {
  return [
    eligibilityBasisKey(record),
    record?.rankMetric || "",
    record?.rankScoreBasis || "",
    record?.rankEvidenceScope || "",
    record?.rankDerivedFromScore === true ? "score-derived" : "native-or-unknown",
    record?.rankPolicyBonusIncluded === true
      ? "bonus-included"
      : record?.rankPolicyBonusIncluded === false
        ? "bonus-excluded"
        : "bonus-unknown",
  ].map(normalize).join("|");
}

function scoreBasisKey(record) {
  return [
    eligibilityBasisKey(record),
    record?.scoreMetric || "",
  ].map(normalize).join("|");
}

function preferredRecord(existing, candidate) {
  if (!existing) return candidate;
  const existingPriority = evidencePriority(existing);
  const candidatePriority = evidencePriority(candidate);
  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority ? candidate : existing;
  }
  const existingHasRank = Number(existing.minRankEnd || existing.minRank) > 0;
  const candidateHasRank = Number(candidate.minRankEnd || candidate.minRank) > 0;
  if (candidateHasRank !== existingHasRank) return candidateHasRank ? candidate : existing;
  return existing;
}

function annualSeries(records) {
  const byYear = new Map();
  for (const record of records) {
    const year = Number(record.year) || 0;
    if (!year || evidencePriority(record) < 2) continue;
    byYear.set(year, preferredRecord(byYear.get(year), record));
  }
  return [...byYear.values()]
    .sort((left, right) => (Number(right.year) || 0) - (Number(left.year) || 0))
    .slice(0, 6);
}

function conservativeBoundary(values, metric) {
  const sorted = [...values].sort((left, right) =>
    metric === "rank" ? left - right : right - left);
  return sorted[sorted.length === 2 ? 0 : 1];
}

function compact(record) {
  return {
    id: record.id,
    province: record.province,
    year: record.year,
    subjectType: record.subjectType,
    schoolName: record.schoolName,
    majorName: record.majorName,
    batch: record.batch || "",
    majorGroup: record.majorGroup || "",
    minScore: Number(record.minScore) || null,
    minRankEnd: Number(record.minRankEnd || record.minRank) || null,
    sourceQuality: record.sourceQuality || "",
    formalScoreScope: record.formalScoreScope || "",
    rankBasis: rankBasisKey(record),
    scoreBasis: scoreBasisKey(record),
  };
}

const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const allAdmissionRecords = [];
const namedMajorRecords = [];
for (const [province, shard] of Object.entries(manifest.shards)) {
  const payload = readGzipJson(path.join(releaseDir, `${shard.file}.gz`));
  assert(payload.province === province, `Province mismatch for ${province}`);
  assert(payload.records.length === shard.records, `Record count mismatch for ${province}`);
  for (const record of payload.records) {
    if (!String(record?.dataType || "").includes("admission") || record.dataType === "admission-plan") continue;
    allAdmissionRecords.push(record);
    if (isNamedMajor(record)) namedMajorRecords.push(record);
  }
}

const canonicalGroups = new Map();
for (const record of namedMajorRecords) {
  const key = trendKey(record);
  if (!canonicalGroups.has(key)) canonicalGroups.set(key, []);
  canonicalGroups.get(key).push(record);
}

const safeGroups = [];
let typographyConflictGroups = 0;
for (const records of canonicalGroups.values()) {
  if (canonicalMergeSafe(records)) {
    safeGroups.push(records);
    continue;
  }
  typographyConflictGroups += 1;
  const exactGroups = new Map();
  for (const record of records) {
    const key = trendKey(record, false);
    if (!exactGroups.has(key)) exactGroups.set(key, []);
    exactGroups.get(key).push(record);
  }
  safeGroups.push(...exactGroups.values());
}

let officialMultiyearGroups = 0;
let officialRankMultiyearGroups = 0;
let officialScoreMultiyearGroups = 0;
let rankGuardedGroups = 0;
let scoreGuardedGroups = 0;
let rankPotentialZoneShiftGroups = 0;
let rankSevereVolatilityGroups = 0;
let scoreSevereVolatilityGroups = 0;
let discardedSingleOutlierGroups = 0;
let mixedRankBasisGroups = 0;
let mixedScoreBasisGroups = 0;
const affectedProvinceCounts = new Map();
const rankGuardedExamples = [];
const scoreGuardedExamples = [];
const provinceExamples = new Map();

function retainTopExample(list, example, limit = 80) {
  list.push(example);
  list.sort((left, right) => right.delta - left.delta);
  if (list.length > limit) list.length = limit;
}

for (const records of safeGroups) {
  const series = annualSeries(records);
  if (series.length < 2) continue;
  officialMultiyearGroups += 1;

  const latest = series[0];
  const latestBasis = rankBasisKey(latest);
  const allRankRows = series.filter((record) => Number(record.minRankEnd || record.minRank) > 0);
  const rankRows = allRankRows.filter((record) => rankBasisKey(record) === latestBasis);
  if (new Set(allRankRows.map(rankBasisKey)).size > 1) mixedRankBasisGroups += 1;
  const allScoreRows = series.filter((record) => Number(record.minScore) > 0);
  const latestScoreBasis = scoreBasisKey(latest);
  const scoreRows = allScoreRows.filter((record) => scoreBasisKey(record) === latestScoreBasis);
  if (new Set(allScoreRows.map(scoreBasisKey)).size > 1) mixedScoreBasisGroups += 1;

  let metric = "";
  let rows = [];
  if (Number(latest.minRankEnd || latest.minRank) > 0 && rankRows.length >= 2) {
    metric = "rank";
    rows = rankRows;
    officialRankMultiyearGroups += 1;
  } else if (Number(latest.minScore) > 0 && scoreRows.length >= 2) {
    metric = "score";
    rows = scoreRows;
    officialScoreMultiyearGroups += 1;
  } else {
    continue;
  }

  const values = rows.map((record) =>
    metric === "rank"
      ? Number(record.minRankEnd || record.minRank)
      : Number(record.minScore));
  const latestBoundary = values[0];
  const safetyBoundary = conservativeBoundary(values, metric);
  const extremeBoundary = metric === "rank" ? Math.min(...values) : Math.max(...values);
  if (rows.length >= 3 && safetyBoundary !== extremeBoundary) discardedSingleOutlierGroups += 1;

  const guarded = metric === "rank"
    ? latestBoundary > safetyBoundary
    : latestBoundary < safetyBoundary;
  if (!guarded) continue;

  const province = latest.province || "";
  affectedProvinceCounts.set(province, (affectedProvinceCounts.get(province) || 0) + 1);
  let delta;
  let severe;
  if (metric === "rank") {
    rankGuardedGroups += 1;
    delta = Number((((latestBoundary / safetyBoundary) - 1) * 100).toFixed(1));
    if (delta > 3) rankPotentialZoneShiftGroups += 1;
    severe = delta >= 18;
    if (severe) rankSevereVolatilityGroups += 1;
  } else {
    scoreGuardedGroups += 1;
    delta = safetyBoundary - latestBoundary;
    severe = delta >= 8;
    if (severe) scoreSevereVolatilityGroups += 1;
  }

  const example = {
    metric,
    delta,
    severe,
    latestBoundary,
    safetyBoundary,
    years: rows.map((record) => record.year),
    boundaries: values,
    records: rows.map(compact),
  };
  retainTopExample(metric === "rank" ? rankGuardedExamples : scoreGuardedExamples, example);
  const provinceExampleKey = `${province}|${metric}`;
  const existingProvinceExample = provinceExamples.get(provinceExampleKey);
  if (!existingProvinceExample || example.delta > existingProvinceExample.delta) {
    provinceExamples.set(provinceExampleKey, example);
  }
}

const guardedExamples = [...rankGuardedExamples, ...scoreGuardedExamples];

assert(allAdmissionRecords.length === 794934, `Admission record count drifted: ${allAdmissionRecords.length}`);
assert(namedMajorRecords.length === 596431, `Named-major record count drifted: ${namedMajorRecords.length}`);
assert(canonicalGroups.size === 460081, `Canonical trend-group count drifted: ${canonicalGroups.size}`);
assert(typographyConflictGroups === 138, `Typography conflict-group count drifted: ${typographyConflictGroups}`);
assert(officialMultiyearGroups === 70735, `Official multi-year group count drifted: ${officialMultiyearGroups}`);
assert(officialRankMultiyearGroups === 41133, `Official rank group count drifted: ${officialRankMultiyearGroups}`);
assert(officialScoreMultiyearGroups === 29211, `Official score group count drifted: ${officialScoreMultiyearGroups}`);
assert(rankGuardedGroups === 25100, `Rank-guarded group count drifted: ${rankGuardedGroups}`);
assert(scoreGuardedGroups === 11699, `Score-guarded group count drifted: ${scoreGuardedGroups}`);
assert(rankPotentialZoneShiftGroups === 18659, `Rank zone-shift count drifted: ${rankPotentialZoneShiftGroups}`);
assert(rankSevereVolatilityGroups === 5309, `Severe rank-volatility count drifted: ${rankSevereVolatilityGroups}`);
assert(scoreSevereVolatilityGroups === 6639, `Severe score-volatility count drifted: ${scoreSevereVolatilityGroups}`);
assert(discardedSingleOutlierGroups === 21630, `Discarded-outlier group count drifted: ${discardedSingleOutlierGroups}`);
assert(mixedRankBasisGroups === 503, `Mixed-rank-basis group count drifted: ${mixedRankBasisGroups}`);
assert(mixedScoreBasisGroups === 394, `Mixed-score-basis group count drifted: ${mixedScoreBasisGroups}`);

const evidence = {
  dataset: "evidence-v3343-admission-multiyear-boundary-volatility",
  generatedAt,
  sourceModelVersion: manifest.modelVersion,
  provinces: Object.keys(manifest.shards).length,
  admissionRecords: allAdmissionRecords.length,
  namedMajorRecords: namedMajorRecords.length,
  canonicalTrendGroups: canonicalGroups.size,
  typographyConflictGroups,
  safeTrendGroups: safeGroups.length,
  officialMultiyearGroups,
  officialRankMultiyearGroups,
  officialScoreMultiyearGroups,
  guardedGroups: rankGuardedGroups + scoreGuardedGroups,
  rankGuardedGroups,
  scoreGuardedGroups,
  rankPotentialZoneShiftGroups,
  rankSevereVolatilityGroups,
  scoreSevereVolatilityGroups,
  discardedSingleOutlierGroups,
  mixedRankBasisGroups,
  mixedScoreBasisGroups,
  affectedProvinceCounts: [...affectedProvinceCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([province, count]) => ({ province, count })),
  provinceExamples: [...provinceExamples.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
    .map(([key, example]) => ({ province: key.split("|")[0], ...example })),
  policy: {
    officialEvidenceOnly: true,
    maximumRecentYears: 6,
    rankBasisMustMatchLatest: true,
    scoreBasisMustMatchLatest: true,
    candidateCategoryAndRankUsageMustMatch: true,
    majorCodeRouteMustMatch: true,
    rankSafetyBoundary: "most restrictive of 2 years; second-most-restrictive of 3-6 years",
    scoreSafetyBoundary: "most restrictive of 2 years; second-most-restrictive of 3-6 years",
    oneExtremeOutlierDiscardedWhenThreeOrMoreYears: true,
    guardDirection: "downgrade-only",
    neverPromotesFromHistoricalBoundary: true,
  },
  guardedExamples,
  boundary: "Read-only audit. A guard is counted only when the latest official boundary is more permissive than the conservative official multi-year boundary. Rank rows with different scope, derivation, or policy-bonus basis are not mixed. The proposed runtime rule can only lower fit confidence; it cannot promote a candidate.",
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  provinces: evidence.provinces,
  admissionRecords: evidence.admissionRecords,
  namedMajorRecords: evidence.namedMajorRecords,
  canonicalTrendGroups: evidence.canonicalTrendGroups,
  typographyConflictGroups,
  officialMultiyearGroups,
  officialRankMultiyearGroups,
  officialScoreMultiyearGroups,
  guardedGroups: evidence.guardedGroups,
  rankGuardedGroups,
  scoreGuardedGroups,
  rankPotentialZoneShiftGroups,
  rankSevereVolatilityGroups,
  scoreSevereVolatilityGroups,
  discardedSingleOutlierGroups,
  mixedRankBasisGroups,
  mixedScoreBasisGroups,
  affectedProvinceCounts: evidence.affectedProvinceCounts,
}, null, 2));
