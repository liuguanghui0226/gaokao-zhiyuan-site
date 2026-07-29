#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(root, "site/data/release-v3.275");
const outputFile = path.join(root, "data/admissions/evidence-v3342-admission-option-name-variants-manifest.json");
const generatedAt = "2026-07-30T05:30:00+08:00";
const genericMajorPattern = /^(院校投档线|院校专业组投档线|学校录取分数线|院校最低分|专业组投档线|投档线)$/;
const distinctRoutePattern = /中外|合作|国际|联合培养|境外|校区|医学院|专项|民族|预科|定向|单列|较高收费|高收费|护理|公费|优师/;

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

function batchQualifier(value) {
  const text = canonicalTypography(value);
  const sectionMatch = text.match(/[a-z](?:段|组|类)/)?.[0] || "";
  const bareSection = text.match(/批([a-z])(?:[（(]|$)/)?.[1] || "";
  const section = sectionMatch || (bareSection ? `${bareSection}段` : "");
  const subject = /(?:^|[（(])(文|理)(?:[）)]|$)/.exec(text)?.[1] || "";
  return [section, subject].filter(Boolean).join(":");
}

function batchRouteKey(value) {
  const text = canonicalTypography(value);
  if (!text) return "";
  const qualifier = batchQualifier(text);
  const append = (base) => qualifier ? `${base}:${qualifier}` : base;
  if (/征集/.test(text)) {
    const round = /第三轮|第3轮|第三次|第3次/.test(text) ? "3"
      : /第二轮|第2轮|第二次|第2次/.test(text) ? "2" : "1";
    const level = /专科|高职/.test(text) ? "vocational" : /本科/.test(text) ? "undergraduate" : "ordinary";
    return append(`vacancy:${level}:${round}`);
  }
  if (/提前/.test(text)) {
    const level = /专科|高职/.test(text) ? "vocational" : "undergraduate";
    const special = /国家|贫困/.test(text) ? ":national-special"
      : /地方/.test(text) ? ":local-special"
        : /高校/.test(text) ? ":school-special" : "";
    return append(`${level}-early${special}`);
  }
  if (/国家专项|贫困专项/.test(text)) return append("national-special");
  if (/地方专项/.test(text)) return append("local-special");
  if (/高校专项/.test(text)) return append("school-special");
  if (/农村专项/.test(text)) return append("rural-special");
  if (/专项/.test(text)) return append(`special:${text}`);
  if (/预科/.test(text)) return append(`preparatory:${text.replace(/[（(][文理][）)]/g, "")}`);
  if (/第三次志愿|第3次志愿/.test(text)) return append("ordinary-round-3");
  if (/第二次志愿|第2次志愿/.test(text)) return append("ordinary-round-2");
  if (/第二段|二段/.test(text)) return append("ordinary-segment-2");
  if (/第三段|三段/.test(text)) return append("ordinary-segment-3");
  if (/本科一批|本一|第一批本科/.test(text)) return append("undergraduate-1");
  if (/本科二批|本二|第二批本科/.test(text)) return append("undergraduate-2");
  if (/本科三批|本三|第三批本科/.test(text)) return append("undergraduate-3");
  if (/专科|高职/.test(text)) return append("vocational-regular");
  if (/第一段|一段|第一次志愿|第1次志愿|第一志愿|本科|普通类|常规批|综合改革/.test(text)) {
    return append("ordinary-initial");
  }
  return `other:${text}`;
}

function baseIdentity(record, canonical = false) {
  const clean = canonical ? canonicalTypography : normalize;
  const majorIdentity = record.majorName || record.majorGroup || record.majorCode || "";
  return [
    record.province || "",
    record.subjectType || "",
    record.schoolName || record.schoolCode || "",
    majorIdentity,
    record.majorName ? "" : record.majorGroup || "",
    record.dataType || "",
  ].map(clean).join("|");
}

function routeFields(record, canonical = false) {
  const clean = canonical ? canonicalTypography : normalize;
  return {
    batch: batchRouteKey(record?.batch),
    group: clean(record?.majorGroup),
    subtype: clean(record?.admissionSubtype),
    campus: clean(record?.campus || record?.campusName || record?.schoolCampus),
    tuition: clean(record?.tuition || record?.tuitionFee),
    elective: clean(record?.electiveRequirement),
    majorCode: clean(record?.majorCode),
    rankScope: clean(record?.rankInstitutionScope),
  };
}

function routeIdentity(record, canonical = false) {
  const route = routeFields(record, canonical);
  return [
    baseIdentity(record, canonical),
    route.batch,
    route.group,
    route.subtype,
    route.campus,
    route.tuition,
    route.elective,
    route.majorCode,
    route.rankScope,
  ].join("|");
}

function isNamedMajor(record) {
  const majorName = normalize(record?.majorName);
  return ["major-admission", "vocational-admission"].includes(record?.dataType) &&
    Boolean(majorName) &&
    !genericMajorPattern.test(majorName);
}

function sameYearBoundary(left, right) {
  if ((Number(left?.year) || 0) !== (Number(right?.year) || 0)) return false;
  const leftScore = Number(left?.minScore) || 0;
  const rightScore = Number(right?.minScore) || 0;
  const leftRank = Number(left?.minRankEnd || left?.minRank) || 0;
  const rightRank = Number(right?.minRankEnd || right?.minRank) || 0;
  if (leftScore && rightScore && leftScore !== rightScore) return false;
  if (leftRank && rightRank && leftRank !== rightRank) return false;
  return Boolean((leftScore && rightScore) || (leftRank && rightRank));
}

function routeFieldsConflict(left, right, canonical = false) {
  const leftRoute = routeFields(left, canonical);
  const rightRoute = routeFields(right, canonical);
  if (leftRoute.batch !== rightRoute.batch) {
    if (leftRoute.batch && rightRoute.batch) return true;
    const presentBatch = leftRoute.batch || rightRoute.batch;
    if (presentBatch !== "ordinary-initial" || !sameYearBoundary(left, right)) return true;
  }
  for (const field of ["subtype", "campus", "tuition", "elective", "majorCode", "rankScope"]) {
    const leftValue = leftRoute[field];
    const rightValue = rightRoute[field];
    if (leftValue && rightValue && leftValue !== rightValue) return true;
    if (!leftValue !== !rightValue) {
      const presentValue = leftValue || rightValue;
      if (
        ["campus", "tuition", "elective", "rankScope"].includes(field) ||
        distinctRoutePattern.test(presentValue)
      ) return true;
    }
  }
  return false;
}

function recordsShareRoute(left, right, canonical = false, enforceSameYearTypographyBoundary = false) {
  if (baseIdentity(left, canonical) !== baseIdentity(right, canonical)) return false;
  const leftRoute = routeFields(left, canonical);
  const rightRoute = routeFields(right, canonical);
  let share = false;
  if (!isNamedMajor(left) || !isNamedMajor(right)) {
    share = leftRoute.group === rightRoute.group && !routeFieldsConflict(left, right, canonical);
  } else if (leftRoute.group === rightRoute.group) {
    share = !routeFieldsConflict(left, right, canonical);
  } else if (!leftRoute.group || !rightRoute.group) {
    const namedGroup = leftRoute.group || rightRoute.group;
    share = !distinctRoutePattern.test(namedGroup) &&
      sameYearBoundary(left, right) &&
      !routeFieldsConflict(left, right, canonical);
  }
  if (!share || !enforceSameYearTypographyBoundary) return share;
  const sameYear = (Number(left?.year) || 0) === (Number(right?.year) || 0);
  if (!sameYear || recordsShareRoute(left, right, false, false)) return true;
  return sameYearBoundary(left, right);
}

function evidencePriority(record) {
  if (/third-party/.test(String(record?.sourceQuality || ""))) return 0;
  if (record?.formalScoreScope === "school-official-only") return 2;
  if (/official/.test(String(record?.sourceQuality || ""))) return 3;
  return 1;
}

function preferredRecord(existing, candidate) {
  const candidateYear = Number(candidate.year) || 0;
  const existingYear = Number(existing.year) || 0;
  const candidatePriority = evidencePriority(candidate);
  const existingPriority = evidencePriority(existing);
  if (
    candidateYear > existingYear ||
    (candidateYear === existingYear && candidatePriority > existingPriority) ||
    (candidateYear === existingYear && candidatePriority === existingPriority &&
      candidate.minRankEnd && !existing.minRankEnd)
  ) {
    return candidate;
  }
  return existing;
}

function dedupe(records, canonical = false) {
  const selected = [];
  for (const record of records) {
    const index = selected.findIndex((item) =>
      recordsShareRoute(item, record, canonical, canonical));
    if (index === -1) selected.push(record);
    else selected[index] = preferredRecord(selected[index], record);
  }
  return selected;
}

function provenance(record) {
  if (/third-party/.test(String(record?.sourceQuality || ""))) return "third-party";
  if (record?.formalScoreScope === "school-official-only") return "school-official";
  if (/official/.test(String(record?.sourceQuality || ""))) return "official-exam-authority";
  return "other";
}

function compact(record) {
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
    provenance: provenance(record),
  };
}

function variants(records, field) {
  return [...new Set(records.map((record) => String(field(record) ?? "")).filter(Boolean))];
}

const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const records = [];
for (const [province, shard] of Object.entries(manifest.shards)) {
  const payload = readGzipJson(path.join(releaseDir, `${shard.file}.gz`));
  assert(payload.province === province, `Province mismatch for ${province}`);
  assert(payload.records.length === shard.records, `Record count mismatch for ${province}`);
  for (const record of payload.records) {
    if (!String(record?.dataType || "").includes("admission") || record.dataType === "admission-plan") continue;
    records.push(record);
  }
}

const canonicalGroups = new Map();
for (const record of records) {
  const key = baseIdentity(record, true);
  if (!canonicalGroups.has(key)) canonicalGroups.set(key, []);
  canonicalGroups.get(key).push(record);
}

let exactBaseGroups = new Set(records.map((record) => baseIdentity(record))).size;
let canonicalNameVariantGroups = 0;
let routeTypographyVariantGroups = 0;
let canonicalVariantGroups = 0;
let affectedCandidateGroups = 0;
let currentSelectedOptions = 0;
let safeSelectedOptions = 0;
let safelyRemovedDuplicateOptions = 0;
let sameYearSafeMergePairs = 0;
let crossYearSafeMergePairs = 0;
let preservedSameYearBoundaryConflictPairs = 0;
let officialInvolvedSafeMergePairs = 0;
let thirdPartyOnlySafeMergePairs = 0;
const fieldCounts = {
  schoolName: 0,
  majorName: 0,
  majorGroup: 0,
  subtype: 0,
  campus: 0,
  elective: 0,
};
const safeExamples = [];
const conflictExamples = [];
const provinceAffectedCounts = new Map();

for (const groupRecords of canonicalGroups.values()) {
  const exactBases = new Set(groupRecords.map((record) => baseIdentity(record)));
  const exactRoutes = new Set(groupRecords.map((record) => routeIdentity(record)));
  const canonicalRoutes = new Set(groupRecords.map((record) => routeIdentity(record, true)));
  const hasNameVariant = exactBases.size > 1;
  const hasRouteTypographyVariant = canonicalRoutes.size < exactRoutes.size;
  if (hasNameVariant) canonicalNameVariantGroups += 1;
  if (hasRouteTypographyVariant) routeTypographyVariantGroups += 1;
  if (hasNameVariant || hasRouteTypographyVariant) canonicalVariantGroups += 1;

  const current = [];
  const safe = [];
  for (const record of groupRecords) {
    const currentIndex = current.findIndex((item) => recordsShareRoute(item, record));
    if (currentIndex === -1) current.push(record);
    else current[currentIndex] = preferredRecord(current[currentIndex], record);

    const canonicalIndex = safe.findIndex((item) => recordsShareRoute(item, record, true, true));
    if (canonicalIndex === -1) {
      safe.push(record);
      continue;
    }
    const existing = safe[canonicalIndex];
    if (!recordsShareRoute(existing, record)) {
      const sameYear = (Number(existing.year) || 0) === (Number(record.year) || 0);
      if (sameYear) sameYearSafeMergePairs += 1;
      else crossYearSafeMergePairs += 1;
      if (provenance(existing) === "third-party" && provenance(record) === "third-party") {
        thirdPartyOnlySafeMergePairs += 1;
      } else {
        officialInvolvedSafeMergePairs += 1;
      }
      if (safeExamples.length < 120) {
        safeExamples.push({
          sameYear,
          sameBoundary: sameYearBoundary(existing, record),
          exactRouteKeysDiffer: routeIdentity(existing) !== routeIdentity(record),
          records: [compact(existing), compact(record)],
        });
      }
    }
    safe[canonicalIndex] = preferredRecord(existing, record);
  }

  for (let leftIndex = 0; leftIndex < groupRecords.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < groupRecords.length; rightIndex += 1) {
      const left = groupRecords[leftIndex];
      const right = groupRecords[rightIndex];
      const sameYear = (Number(left.year) || 0) === (Number(right.year) || 0);
      if (
        sameYear &&
        !recordsShareRoute(left, right) &&
        recordsShareRoute(left, right, true, false) &&
        !sameYearBoundary(left, right)
      ) {
        preservedSameYearBoundaryConflictPairs += 1;
        if (conflictExamples.length < 80) {
          conflictExamples.push({
            records: [compact(left), compact(right)],
          });
        }
      }
    }
  }

  currentSelectedOptions += current.length;
  safeSelectedOptions += safe.length;
  if (safe.length >= current.length) continue;
  affectedCandidateGroups += 1;
  safelyRemovedDuplicateOptions += current.length - safe.length;
  const province = groupRecords[0]?.province || "";
  provinceAffectedCounts.set(province, (provinceAffectedCounts.get(province) || 0) + 1);

  const groupVariants = {
    schoolName: variants(groupRecords, (record) => record.schoolName),
    majorName: variants(groupRecords, (record) => record.majorName),
    majorGroup: variants(groupRecords, (record) => record.majorGroup),
    subtype: variants(groupRecords, (record) => record.admissionSubtype),
    campus: variants(groupRecords, (record) => record.campus || record.campusName || record.schoolCampus),
    elective: variants(groupRecords, (record) => record.electiveRequirement),
  };
  for (const [field, values] of Object.entries(groupVariants)) {
    if (values.length > 1) fieldCounts[field] += 1;
  }
}

assert(records.length === 794934, `Admission record count drifted: ${records.length}`);
assert(exactBaseGroups === 428254, `Exact base-group count drifted: ${exactBaseGroups}`);
assert(canonicalGroups.size === 421393, `Canonical base-group count drifted: ${canonicalGroups.size}`);
assert(canonicalNameVariantGroups === 6838, `Name-variant group count drifted: ${canonicalNameVariantGroups}`);
assert(routeTypographyVariantGroups === 2689, `Route typography group count drifted: ${routeTypographyVariantGroups}`);
assert(canonicalVariantGroups === 6987, `Canonical variant group count drifted: ${canonicalVariantGroups}`);
assert(currentSelectedOptions === 613436, `Current selected-option count drifted: ${currentSelectedOptions}`);
assert(safeSelectedOptions === 610421, `Safe selected-option count drifted: ${safeSelectedOptions}`);
assert(affectedCandidateGroups === 2881, `Affected candidate-group count drifted: ${affectedCandidateGroups}`);
assert(safelyRemovedDuplicateOptions === 3015, `Removed duplicate-option count drifted: ${safelyRemovedDuplicateOptions}`);
assert(sameYearSafeMergePairs === 389, `Same-year merge count drifted: ${sameYearSafeMergePairs}`);
assert(crossYearSafeMergePairs === 3468, `Cross-year merge count drifted: ${crossYearSafeMergePairs}`);
assert(officialInvolvedSafeMergePairs === 3371, `Official-involved merge count drifted: ${officialInvolvedSafeMergePairs}`);
assert(thirdPartyOnlySafeMergePairs === 486, `Third-party-only merge count drifted: ${thirdPartyOnlySafeMergePairs}`);
assert(
  preservedSameYearBoundaryConflictPairs === 537,
  `Preserved boundary-conflict count drifted: ${preservedSameYearBoundaryConflictPairs}`,
);

const evidence = {
  dataset: "evidence-v3342-admission-option-name-variants",
  generatedAt,
  sourceModelVersion: manifest.modelVersion,
  provinces: Object.keys(manifest.shards).length,
  admissionRecords: records.length,
  exactBaseGroups,
  canonicalBaseGroups: canonicalGroups.size,
  canonicalNameVariantGroups,
  routeTypographyVariantGroups,
  canonicalVariantGroups,
  currentSelectedOptions,
  safeSelectedOptions,
  affectedCandidateGroups,
  safelyRemovedDuplicateOptions,
  sameYearSafeMergePairs,
  crossYearSafeMergePairs,
  officialInvolvedSafeMergePairs,
  thirdPartyOnlySafeMergePairs,
  preservedSameYearBoundaryConflictPairs,
  affectedVariantFields: fieldCounts,
  affectedProvinceCounts: [...provinceAffectedCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([province, count]) => ({ province, count })),
  controls: {
    unicodeNormalization: "NFKC",
    removesInternalWhitespace: true,
    normalizesMiddleDots: true,
    normalizesDashVariants: true,
    normalizesBracketVariants: true,
    preservesWordsDigitsAndQualifiers: true,
    preservesSemanticBatchRoutes: true,
    preservesDistinctRouteFields: true,
    requiresSameBoundaryForSameYearTypographyMerge: true,
    preservesSameYearBoundaryConflicts: true,
    sameRouteEvidencePreferencePreserved: true,
  },
  safeExamples,
  conflictExamples,
  boundary: "Read-only simulation of candidate-option deduplication. Only Unicode compatibility, whitespace, middle-dot, dash, and bracket typography variants are canonicalized. Same-year variants merge only when their score/rank boundary is identical; semantic batch, group, subtype, campus, tuition, elective, major-code, and rank-scope differences remain isolated.",
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  provinces: evidence.provinces,
  admissionRecords: evidence.admissionRecords,
  exactBaseGroups,
  canonicalBaseGroups: evidence.canonicalBaseGroups,
  canonicalNameVariantGroups,
  routeTypographyVariantGroups,
  canonicalVariantGroups,
  currentSelectedOptions,
  safeSelectedOptions,
  affectedCandidateGroups,
  safelyRemovedDuplicateOptions,
  sameYearSafeMergePairs,
  crossYearSafeMergePairs,
  officialInvolvedSafeMergePairs,
  thirdPartyOnlySafeMergePairs,
  preservedSameYearBoundaryConflictPairs,
  affectedVariantFields: fieldCounts,
}, null, 2));
