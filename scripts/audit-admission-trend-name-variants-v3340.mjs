#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const RELEASE_DIR = path.join(ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(ROOT, "data/admissions/evidence-v3340-admission-trend-name-variants-manifest.json");
const GENERATED_AT = "2026-07-30T04:18:00+08:00";

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

function routeFields(record, canonical = false) {
  const clean = canonical ? canonicalTypography : normalize;
  return {
    group: clean(record?.majorGroup),
    subtype: clean(record?.admissionSubtype),
    campus: clean(record?.campus || record?.campusName || record?.schoolCampus),
    tuition: clean(record?.tuition || record?.tuitionFee),
    elective: clean(record?.electiveRequirement),
    rankScope: clean(record?.rankInstitutionScope),
  };
}

function trendKey(record, canonical = false) {
  const clean = canonical ? canonicalTypography : normalize;
  const route = routeFields(record, canonical);
  return [
    record.province,
    record.subjectType,
    record.batch,
    record.schoolName || record.schoolCode,
    record.dataType,
    record.majorName,
    route.group,
    route.subtype,
    route.campus,
    route.tuition,
    route.elective,
    route.rankScope,
  ].map(clean).join("|");
}

function addToMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function compactRecord(record) {
  return {
    id: record.id,
    province: record.province,
    year: record.year,
    schoolName: record.schoolName,
    majorName: record.majorName,
    batch: record.batch || "",
    majorGroup: record.majorGroup || "",
    subtype: record.admissionSubtype || "",
    campus: record.campus || record.campusName || record.schoolCampus || "",
    elective: record.electiveRequirement || "",
    minScore: record.minScore || null,
    minRankEnd: record.minRankEnd || record.minRank || null,
  };
}

function fieldVariants(records, field) {
  return [...new Set(records.map((record) => String(field(record) ?? "")).filter(Boolean))];
}

function boundarySignature(record) {
  return [
    Number(record.minScore) || 0,
    Number(record.minRankEnd || record.minRank) || 0,
  ].join("|");
}

function main() {
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const manifest = readGzipJson(path.join(RELEASE_DIR, "manifest.json.gz"));
  const records = [];
  const exactMap = new Map();
  const canonicalMap = new Map();

  for (const [province, shard] of Object.entries(manifest.shards)) {
    const data = readGzipJson(path.join(RELEASE_DIR, `${shard.file}.gz`));
    assert(data.province === province, `Province mismatch for ${province}`);
    assert(data.records.length === shard.records, `Record count mismatch for ${province}`);
    for (const record of data.records) {
      if (record.dataType !== "major-admission" || !record.majorName) continue;
      records.push(record);
      const exactKey = trendKey(record);
      addToMap(exactMap, exactKey, record);
      addToMap(canonicalMap, trendKey(record, true), { record, exactKey });
    }
  }

  const recoveredGroups = [];
  const sameYearBoundaryConflictExamples = [];
  const examplesByVariantField = Object.fromEntries(
    ["schoolName", "majorName", "batch", "majorGroup", "subtype", "campus", "elective"]
      .map((field) => [field, []]),
  );
  const fieldCounts = {
    schoolName: 0,
    majorName: 0,
    batch: 0,
    majorGroup: 0,
    subtype: 0,
    campus: 0,
    elective: 0,
  };
  let mergedCanonicalGroups = 0;
  let sameYearBoundaryConflictGroups = 0;
  let recoveredMultiYearGroups = 0;
  let extendedExistingMultiYearGroups = 0;
  let addedDistinctYearLinks = 0;
  let recoveredOfficialOnlyGroups = 0;
  let recoveredRecordCount = 0;
  let exactMultiYearKeys = 0;
  for (const exactRecords of exactMap.values()) {
    if (new Set(exactRecords.map((record) => Number(record.year) || 0).filter(Boolean)).size >= 2) {
      exactMultiYearKeys += 1;
    }
  }
  let safePolicyMultiYearGroups = 0;

  for (const entries of canonicalMap.values()) {
    const exactKeys = new Set(entries.map((entry) => entry.exactKey));
    const groupRecords = entries.map((entry) => entry.record);
    const years = new Set(groupRecords.map((record) => Number(record.year) || 0).filter(Boolean));
    const exactYearCounts = [...exactKeys].map((key) => {
      const exactYears = new Set(exactMap.get(key).map((record) => Number(record.year) || 0).filter(Boolean));
      return exactYears.size;
    });
    const exactHasMultiYear = exactYearCounts.some((count) => count >= 2);
    const maxExactYears = Math.max(...exactYearCounts);
    if (exactKeys.size < 2) {
      if (years.size >= 2) safePolicyMultiYearGroups += 1;
      continue;
    }
    mergedCanonicalGroups += 1;
    const conflictsByYear = new Map();
    for (const record of groupRecords) {
      const year = Number(record.year) || 0;
      if (!conflictsByYear.has(year)) conflictsByYear.set(year, new Set());
      conflictsByYear.get(year).add(boundarySignature(record));
    }
    const hasBoundaryConflict = [...conflictsByYear.values()].some((signatures) => signatures.size > 1);
    if (hasBoundaryConflict) {
      sameYearBoundaryConflictGroups += 1;
      if (sameYearBoundaryConflictExamples.length < 20) {
        sameYearBoundaryConflictExamples.push({
          years: [...years].sort((left, right) => right - left),
          records: groupRecords
            .slice()
            .sort((left, right) => Number(right.year) - Number(left.year))
            .slice(0, 16)
            .map(compactRecord),
        });
      }
      safePolicyMultiYearGroups += exactYearCounts.filter((count) => count >= 2).length;
      continue;
    }
    if (years.size >= 2) safePolicyMultiYearGroups += 1;
    if (years.size < 2) continue;
    addedDistinctYearLinks += Math.max(0, years.size - maxExactYears);
    if (exactHasMultiYear) {
      if (years.size > maxExactYears) extendedExistingMultiYearGroups += 1;
      continue;
    }

    recoveredMultiYearGroups += 1;
    recoveredRecordCount += groupRecords.length;
    if (groupRecords.every((record) =>
      record.formalScoreScope === "school-official-only" ||
      /official/.test(String(record.sourceQuality || ""))
    )) {
      recoveredOfficialOnlyGroups += 1;
    }

    const variants = {
      schoolName: fieldVariants(groupRecords, (record) => record.schoolName),
      majorName: fieldVariants(groupRecords, (record) => record.majorName),
      batch: fieldVariants(groupRecords, (record) => record.batch),
      majorGroup: fieldVariants(groupRecords, (record) => record.majorGroup),
      subtype: fieldVariants(groupRecords, (record) => record.admissionSubtype),
      campus: fieldVariants(groupRecords, (record) => record.campus || record.campusName || record.schoolCampus),
      elective: fieldVariants(groupRecords, (record) => record.electiveRequirement),
    };
    for (const [field, values] of Object.entries(variants)) {
      if (values.length <= 1) continue;
      fieldCounts[field] += 1;
      if (examplesByVariantField[field].length < 12) {
        examplesByVariantField[field].push({
          years: [...years].sort((left, right) => right - left),
          variants,
          records: groupRecords
            .slice()
            .sort((left, right) => Number(right.year) - Number(left.year))
            .slice(0, 12)
            .map(compactRecord),
        });
      }
    }
    if (recoveredGroups.length < 100) {
      recoveredGroups.push({
        years: [...years].sort((left, right) => right - left),
        variants,
        records: groupRecords
          .sort((left, right) => Number(right.year) - Number(left.year))
          .slice(0, 12)
          .map(compactRecord),
      });
    }
  }

  assert(records.length === 475801, `Major-admission record count drifted: ${records.length}`);
  assert(exactMap.size === 301738, `Exact trend-key count drifted: ${exactMap.size}`);
  assert(exactMultiYearKeys === 106989, `Exact multi-year trend count drifted: ${exactMultiYearKeys}`);
  assert(canonicalMap.size === 296607, `Canonical trend-key count drifted: ${canonicalMap.size}`);
  assert(mergedCanonicalGroups === 5129, `Canonical merge-group count drifted: ${mergedCanonicalGroups}`);
  assert(sameYearBoundaryConflictGroups === 140, `Boundary-conflict count drifted: ${sameYearBoundaryConflictGroups}`);
  assert(safePolicyMultiYearGroups === 110770, `Safe-policy multi-year count drifted: ${safePolicyMultiYearGroups}`);
  assert(recoveredMultiYearGroups === 3834, `Recovered multi-year count drifted: ${recoveredMultiYearGroups}`);
  assert(extendedExistingMultiYearGroups === 1071, `Extended trend count drifted: ${extendedExistingMultiYearGroups}`);
  assert(addedDistinctYearLinks === 4959, `Added year-link count drifted: ${addedDistinctYearLinks}`);
  assert(recoveredOfficialOnlyGroups === 3710, `Official recovered count drifted: ${recoveredOfficialOnlyGroups}`);
  assert(recoveredRecordCount === 7669, `Recovered record count drifted: ${recoveredRecordCount}`);

  const evidence = {
    dataset: "evidence-v3340-admission-trend-name-variants",
    generatedAt: GENERATED_AT,
    sourceModelVersion: manifest.modelVersion,
    provinces: Object.keys(manifest.shards).length,
    majorAdmissionRecords: records.length,
    exactTrendKeys: exactMap.size,
    exactMultiYearKeys,
    canonicalTrendKeys: canonicalMap.size,
    mergedCanonicalGroups,
    sameYearBoundaryConflictGroups,
    safePolicyMultiYearGroups,
    recoveredMultiYearGroups,
    extendedExistingMultiYearGroups,
    addedDistinctYearLinks,
    recoveredOfficialOnlyGroups,
    recoveredRecordCount,
    recoveredVariantFields: fieldCounts,
    controls: {
      unicodeNormalization: "NFKC",
      removesInternalWhitespace: true,
      normalizesMiddleDots: true,
      normalizesDashVariants: true,
      normalizesBracketVariants: true,
      preservesBracketContents: true,
      preservesWordsDigitsAndQualifiers: true,
      rejectsSameYearBoundaryConflicts: true,
      preservesV3339RouteFields: true,
    },
    examples: recoveredGroups,
    examplesByVariantField,
    sameYearBoundaryConflictExamples,
    boundary: "Read-only audit. Only typographic Unicode and separator variants are compared; no semantic word, qualifier, campus, cooperation type, tuition, elective requirement, rank scope, or admission record is removed.",
  };
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    provinces: evidence.provinces,
    majorAdmissionRecords: evidence.majorAdmissionRecords,
    exactTrendKeys: evidence.exactTrendKeys,
    exactMultiYearKeys,
    canonicalTrendKeys: evidence.canonicalTrendKeys,
    mergedCanonicalGroups,
    sameYearBoundaryConflictGroups,
    safePolicyMultiYearGroups,
    recoveredMultiYearGroups,
    extendedExistingMultiYearGroups,
    addedDistinctYearLinks,
    recoveredOfficialOnlyGroups,
    recoveredRecordCount,
    recoveredVariantFields: fieldCounts,
  }, null, 2));
}

main();
