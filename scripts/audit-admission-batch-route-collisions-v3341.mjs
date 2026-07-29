#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(root, "site/data/release-v3.275");
const outputFile = path.join(root, "data/admissions/evidence-v3341-admission-batch-route-collisions-manifest.json");
const generatedAt = "2026-07-30T04:45:00+08:00";
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

function baseIdentity(record) {
  const majorIdentity = record.majorName || record.majorGroup || record.majorCode || "";
  return [
    record.province || "",
    record.subjectType || "",
    record.schoolName || record.schoolCode || "",
    majorIdentity,
    record.majorName ? "" : record.majorGroup || "",
    record.dataType || "",
  ].map(normalize).join("|");
}

function routeFields(record) {
  return {
    group: normalize(record?.majorGroup),
    subtype: normalize(record?.admissionSubtype),
    campus: normalize(record?.campus || record?.campusName || record?.schoolCampus),
    tuition: normalize(record?.tuition || record?.tuitionFee),
    elective: normalize(record?.electiveRequirement),
    majorCode: normalize(record?.majorCode),
    rankScope: normalize(record?.rankInstitutionScope),
  };
}

function isNamedMajor(record) {
  const majorName = normalize(record?.majorName);
  return ["major-admission", "vocational-admission"].includes(record?.dataType) &&
    Boolean(majorName) &&
    !genericMajorPattern.test(majorName);
}

function routeFieldsConflict(left, right) {
  const leftRoute = routeFields(left);
  const rightRoute = routeFields(right);
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

function recordsShareCurrentRoute(left, right) {
  if (baseIdentity(left) !== baseIdentity(right)) return false;
  const leftRoute = routeFields(left);
  const rightRoute = routeFields(right);
  if (!isNamedMajor(left) || !isNamedMajor(right)) {
    return leftRoute.group === rightRoute.group && !routeFieldsConflict(left, right);
  }
  if (leftRoute.group === rightRoute.group) return !routeFieldsConflict(left, right);
  if (leftRoute.group && rightRoute.group) return false;
  const namedGroup = leftRoute.group || rightRoute.group;
  if (distinctRoutePattern.test(namedGroup)) return false;
  return sameYearBoundary(left, right) && !routeFieldsConflict(left, right);
}

function canonicalTypography(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[‐‑‒–—―﹘﹣－]/g, "-");
}

function batchQualifier(text) {
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
    const round = /第?二|第二轮|2/.test(text) ? "2" : /第?三|第三轮|3/.test(text) ? "3" : "1";
    const level = /专科|高职/.test(text) ? "vocational" : /本科/.test(text) ? "undergraduate" : "ordinary";
    return append(`vacancy:${level}:${round}`);
  }
  if (/提前/.test(text)) {
    const level = /专科|高职/.test(text) ? "vocational" : "undergraduate";
    const special = /国家|贫困/.test(text) ? ":national-special" :
      /地方/.test(text) ? ":local-special" :
        /高校/.test(text) ? ":school-special" : "";
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

function recordsShareBatchSafeRoute(left, right) {
  if (!recordsShareCurrentRoute(left, right)) return false;
  const leftBatch = batchRouteKey(left.batch);
  const rightBatch = batchRouteKey(right.batch);
  if (leftBatch === rightBatch) return true;
  if (leftBatch && rightBatch) return false;
  const presentBatch = leftBatch || rightBatch;
  return presentBatch === "ordinary-initial" && sameYearBoundary(left, right);
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
    minScore: record.minScore || null,
    minRankEnd: record.minRankEnd || record.minRank || null,
    provenance: provenance(record),
  };
}

const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const records = [];
for (const shard of Object.values(manifest.shards)) {
  const payload = readGzipJson(path.join(releaseDir, `${shard.file}.gz`));
  for (const record of payload.records) {
    if (!String(record?.dataType || "").includes("admission") || record.dataType === "admission-plan") continue;
    records.push(record);
  }
}

const groups = new Map();
for (const record of records) {
  const key = baseIdentity(record);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
}

let latestCollisionGroups = 0;
let crossBatchSharedRouteGroups = 0;
let crossBatchSharedRoutePairs = 0;
let crossBatchBoundaryConflictPairs = 0;
let crossBatchMixedProvenancePairs = 0;
let crossBatchDistinctStagePairs = 0;
let preventedCrossBatchPairs = 0;
let retainedAliasPairs = 0;
let preventedCrossBatchGroups = 0;
let preventedBoundaryConflictPairs = 0;
let preventedMixedProvenancePairs = 0;
let preventedOfficialInvolvedPairs = 0;
const batchPairCounts = new Map();
const provinceCounts = new Map();
const preventedProvinceCounts = new Map();
const examples = [];
const officialExamples = [];
const preventedExamples = [];

function broadBatchStage(value) {
  const text = normalize(value).replace(/\s+/g, "");
  if (!text) return "blank";
  if (/征集/.test(text)) return "vacancy";
  if (/专科提前|高职提前/.test(text)) return "vocational-early";
  if (/本科提前|提前批/.test(text)) return "undergraduate-early";
  if (/国家专项/.test(text)) return "national-special";
  if (/地方专项/.test(text)) return "local-special";
  if (/高校专项/.test(text)) return "school-special";
  if (/专项/.test(text)) return "special";
  if (/本科一批|本一|第一批本科/.test(text)) return "undergraduate-1";
  if (/本科二批|本二|第二批本科/.test(text)) return "undergraduate-2";
  if (/本科三批|本三|第三批本科/.test(text)) return "undergraduate-3";
  if (/一段/.test(text)) return "segment-1";
  if (/二段/.test(text)) return "segment-2";
  if (/专科|高职/.test(text)) return "vocational";
  if (/本科/.test(text)) return "undergraduate";
  return `other:${text}`;
}

for (const groupRecords of groups.values()) {
  const latestYear = Math.max(...groupRecords.map((record) => Number(record.year) || 0));
  const latest = groupRecords.filter((record) => (Number(record.year) || 0) === latestYear);
  if (latest.length < 2) continue;
  latestCollisionGroups += 1;
  let groupHasCrossBatchSharedRoute = false;
  let groupHasPreventedPair = false;
  for (let leftIndex = 0; leftIndex < latest.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < latest.length; rightIndex += 1) {
      const left = latest[leftIndex];
      const right = latest[rightIndex];
      const leftBatch = normalize(left.batch);
      const rightBatch = normalize(right.batch);
      if (leftBatch === rightBatch || !recordsShareCurrentRoute(left, right)) continue;
      groupHasCrossBatchSharedRoute = true;
      crossBatchSharedRoutePairs += 1;
      provinceCounts.set(left.province, (provinceCounts.get(left.province) || 0) + 1);
      if (!sameYearBoundary(left, right)) crossBatchBoundaryConflictPairs += 1;
      if (provenance(left) !== provenance(right)) crossBatchMixedProvenancePairs += 1;
      if (broadBatchStage(left.batch) !== broadBatchStage(right.batch)) crossBatchDistinctStagePairs += 1;
      if (recordsShareBatchSafeRoute(left, right)) {
        retainedAliasPairs += 1;
      } else {
        groupHasPreventedPair = true;
        preventedCrossBatchPairs += 1;
        preventedProvinceCounts.set(left.province, (preventedProvinceCounts.get(left.province) || 0) + 1);
        if (!sameYearBoundary(left, right)) preventedBoundaryConflictPairs += 1;
        if (provenance(left) !== provenance(right)) preventedMixedProvenancePairs += 1;
        if (provenance(left) !== "third-party" || provenance(right) !== "third-party") {
          preventedOfficialInvolvedPairs += 1;
        }
        if (preventedExamples.length < 100) {
          preventedExamples.push({
            batchRouteKeys: [batchRouteKey(left.batch), batchRouteKey(right.batch)],
            sameBoundary: sameYearBoundary(left, right),
            records: [compact(left), compact(right)],
          });
        }
      }
      const pairKey = [left.batch || "(空)", right.batch || "(空)"].sort().join(" ↔ ");
      batchPairCounts.set(pairKey, (batchPairCounts.get(pairKey) || 0) + 1);
      if (examples.length < 100) {
        examples.push({
          stages: [broadBatchStage(left.batch), broadBatchStage(right.batch)],
          sameBoundary: sameYearBoundary(left, right),
          records: [compact(left), compact(right)],
        });
      }
      if (
        officialExamples.length < 100 &&
        (provenance(left) !== "third-party" || provenance(right) !== "third-party")
      ) {
        officialExamples.push({
          stages: [broadBatchStage(left.batch), broadBatchStage(right.batch)],
          sameBoundary: sameYearBoundary(left, right),
          records: [compact(left), compact(right)],
        });
      }
    }
  }
  if (groupHasCrossBatchSharedRoute) crossBatchSharedRouteGroups += 1;
  if (groupHasPreventedPair) preventedCrossBatchGroups += 1;
}

assert(records.length === 794934, `Admission record count drifted: ${records.length}`);
assert(groups.size === 428254, `Base identity count drifted: ${groups.size}`);
assert(latestCollisionGroups === 40538, `Latest collision count drifted: ${latestCollisionGroups}`);
assert(crossBatchSharedRouteGroups === 7607, `Cross-batch group count drifted: ${crossBatchSharedRouteGroups}`);
assert(crossBatchSharedRoutePairs === 13137, `Cross-batch pair count drifted: ${crossBatchSharedRoutePairs}`);
assert(crossBatchBoundaryConflictPairs === 10989, `Boundary conflict count drifted: ${crossBatchBoundaryConflictPairs}`);
assert(crossBatchMixedProvenancePairs === 3454, `Mixed provenance count drifted: ${crossBatchMixedProvenancePairs}`);
assert(crossBatchDistinctStagePairs === 11409, `Distinct stage count drifted: ${crossBatchDistinctStagePairs}`);
assert(preventedCrossBatchGroups === 4740, `Prevented group count drifted: ${preventedCrossBatchGroups}`);
assert(preventedCrossBatchPairs === 9085, `Prevented pair count drifted: ${preventedCrossBatchPairs}`);
assert(retainedAliasPairs === 4052, `Retained alias count drifted: ${retainedAliasPairs}`);
assert(preventedBoundaryConflictPairs === 8348, `Prevented boundary conflict count drifted: ${preventedBoundaryConflictPairs}`);
assert(preventedMixedProvenancePairs === 514, `Prevented mixed provenance count drifted: ${preventedMixedProvenancePairs}`);
assert(preventedOfficialInvolvedPairs === 3479, `Prevented official pair count drifted: ${preventedOfficialInvolvedPairs}`);

const evidence = {
  dataset: "evidence-v3341-admission-batch-route-collisions",
  generatedAt,
  sourceModelVersion: manifest.modelVersion,
  provinces: Object.keys(manifest.shards).length,
  admissionRecords: records.length,
  baseIdentityGroups: groups.size,
  latestCollisionGroups,
  crossBatchSharedRouteGroups,
  crossBatchSharedRoutePairs,
  crossBatchBoundaryConflictPairs,
  crossBatchMixedProvenancePairs,
  crossBatchDistinctStagePairs,
  preventedCrossBatchPairs,
  retainedAliasPairs,
  preventedCrossBatchGroups,
  preventedBoundaryConflictPairs,
  preventedMixedProvenancePairs,
  preventedOfficialInvolvedPairs,
  controls: {
    semanticBatchRouteIsolation: true,
    retainedOrdinaryInitialAliases: [
      "本科批",
      "普通类本科批",
      "综合改革（3+1+2）",
      "普通类常规批第1次志愿",
      "普通类第一段平行投档",
    ],
    preservedDistinctRoutes: [
      "提前批",
      "国家专项",
      "地方专项",
      "高校专项",
      "征集轮次",
      "本科一批/二批/三批",
      "普通类第二段/第三段",
      "A/B/C段",
      "文理预科",
    ],
    sameSemanticRouteEvidencePreferencePreserved: true,
    batchShownInCandidateTags: true,
  },
  topBatchPairs: [...batchPairCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 40)
    .map(([pair, count]) => ({ pair, count })),
  provinceCounts: [...provinceCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([province, count]) => ({ province, count })),
  preventedProvinceCounts: [...preventedProvinceCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([province, count]) => ({ province, count })),
  examples,
  officialExamples,
  preventedExamples,
  boundary: "Read-only audit of the latest year within each current candidate base identity. Semantic batch aliases for the same ordinary initial route remain mergeable; early, special, vacancy, round, segment, batch-level, A/B/C-section, and preparatory routes remain distinct.",
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  provinces: evidence.provinces,
  admissionRecords: evidence.admissionRecords,
  crossBatchSharedRouteGroups,
  crossBatchSharedRoutePairs,
  preventedCrossBatchGroups,
  preventedCrossBatchPairs,
  retainedAliasPairs,
  preventedBoundaryConflictPairs,
  preventedOfficialInvolvedPairs,
}, null, 2));
