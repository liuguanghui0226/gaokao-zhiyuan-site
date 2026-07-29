#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(root, "site/data/release-v3.275");
const outputFile = path.join(
  root,
  "data/admissions/evidence-v3344-admission-current-plan-corroboration-manifest.json",
);
const generatedAt = "2026-07-30T07:30:00+08:00";
const genericMajorPattern = /^(院校投档线|院校专业组投档线|学校录取分数线|院校最低分|专业组投档线|投档线)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
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

function normalizeSubject(value) {
  const text = canonicalTypography(value);
  if (!text || /未公开|不确定/.test(text)) return "";
  if (/物理|理科|理工/.test(text)) return "物理";
  if (/历史|文科|文史/.test(text)) return "历史";
  if (/综合/.test(text)) return "综合";
  return text;
}

function subjectsCompatible(left, right) {
  const leftSubject = normalizeSubject(left);
  const rightSubject = normalizeSubject(right);
  if (!leftSubject || !rightSubject) return true;
  if (leftSubject === "综合" || rightSubject === "综合") return true;
  return leftSubject === rightSubject;
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

function isPlanRecord(record) {
  return record?.dataType === "admission-plan" || record?.planOnly === true;
}

function isVacancyPlanRecord(record) {
  return record?.planStage === "征集志愿" || record?.formalScoreScope === "vacancy-plan-only";
}

function isSpecialPathRecord(record) {
  return record?.formalScoreScope === "special-path-only";
}

function planRestrictedEligibilityReason(record) {
  if (!isPlanRecord(record)) return "";
  if (isSpecialPathRecord(record)) return record?.specialPathReason || "特殊路径";
  const batch = String(record?.batch || "");
  const text = canonicalTypography([
    batch,
    record?.schoolName,
    record?.majorName,
    record?.majorGroup,
    ...(record?.schoolTags || []),
    record?.planRemark,
    record?.planRestrictionText,
  ].join(" "));
  if (/部队生源/.test(text)) return "部队生源计划";
  if (/对口高职/.test(text)) return "对口高职计划";
  if (/国家专项|地方专项|高校专项|边境专项/.test(batch)) return "专项计划";
  if (/预科/.test(batch)) return "预科计划";
  if (/提前.*(军校|艺体)|提前艺体/.test(batch)) return "提前军警或艺体计划";
  if (/提前录取/.test(batch)) return "提前录取计划";
  if (/定向就业|定向培养|公费师范|优师计划|免费师范|军士|飞行员/.test(text)) return "定向或资格计划";
  return "";
}

function isNamedMajorAdmissionRecord(record) {
  const majorName = canonicalTypography(record?.majorName);
  return ["major-admission", "vocational-admission"].includes(record?.dataType) &&
    Boolean(majorName) &&
    !genericMajorPattern.test(majorName);
}

function schoolAliases(record) {
  return [
    record?.schoolCode ? `code:${canonicalTypography(record.schoolCode)}` : "",
    record?.schoolName ? `name:${canonicalTypography(record.schoolName)}` : "",
  ].filter(Boolean);
}

function majorAliases(record) {
  return [
    record?.majorCode ? `code:${canonicalTypography(record.majorCode)}` : "",
    record?.majorName ? `name:${canonicalTypography(record.majorName)}` : "",
  ].filter(Boolean);
}

function planLookupKeys(record) {
  const province = canonicalTypography(record?.province);
  const batch = batchRouteKey(record?.batch);
  const keys = [];
  for (const school of schoolAliases(record)) {
    for (const major of majorAliases(record)) {
      keys.push([province, school, major, batch].join("|"));
    }
  }
  return keys;
}

function routeField(record, names) {
  for (const name of names) {
    const value = canonicalTypography(record?.[name]);
    if (value) return value;
  }
  return "";
}

function sameOptionalRouteValue(left, right, names) {
  const leftValue = routeField(left, names);
  const rightValue = routeField(right, names);
  return !leftValue || !rightValue || leftValue === rightValue;
}

function planMatchesAdmission(plan, admission) {
  return subjectsCompatible(plan?.subjectType, admission?.subjectType) &&
    sameOptionalRouteValue(plan, admission, ["admissionSubtype"]) &&
    sameOptionalRouteValue(plan, admission, ["campus", "campusName", "schoolCampus"]) &&
    sameOptionalRouteValue(plan, admission, ["candidateCategory", "candidateClass"]);
}

function admissionGroupKey(record) {
  return [
    canonicalTypography(record?.province),
    normalizeSubject(record?.subjectType),
    canonicalTypography(record?.schoolCode || record?.schoolName),
    canonicalTypography(record?.majorCode || record?.majorName),
    batchRouteKey(record?.batch),
    canonicalTypography(record?.majorGroup),
    canonicalTypography(record?.admissionSubtype),
    routeField(record, ["campus", "campusName", "schoolCampus"]),
    canonicalTypography(record?.rankInstitutionScope),
  ].join("|");
}

function selectLatestRecord(records) {
  return [...records].sort((left, right) =>
    (Number(right.year) || 0) - (Number(left.year) || 0) ||
    Number(!/third-party/.test(String(right.sourceQuality || ""))) -
      Number(!/third-party/.test(String(left.sourceQuality || ""))) ||
    (Number(right.minRankEnd || right.minRank) || 0) - (Number(left.minRankEnd || left.minRank) || 0) ||
    (Number(right.minScore) || 0) - (Number(left.minScore) || 0)
  )[0];
}

function latestMatchingPlan(record, planIndex) {
  const matches = [];
  const seen = new Set();
  for (const key of planLookupKeys(record)) {
    for (const plan of planIndex.get(key) || []) {
      if (seen.has(plan.id) || !planMatchesAdmission(plan, record)) continue;
      seen.add(plan.id);
      matches.push(plan);
    }
  }
  if (!matches.length) return null;
  return [...matches].sort((left, right) =>
    (Number(right.year) || 0) - (Number(left.year) || 0) ||
    (Number(right.planCount) || 0) - (Number(left.planCount) || 0)
  )[0];
}

const shardFiles = fs.readdirSync(releaseDir)
  .filter((file) => file.endsWith(".json.gz"))
  .filter((file) => !["knowledge-core.json.gz", "knowledge-core-lite.json.gz", "manifest.json.gz"].includes(file))
  .sort();

let admissionRecords = 0;
let namedAdmissionRecords = 0;
let candidateGroups = 0;
let ordinaryPlanRecords = 0;
let eligibleRecentPlanRecords = 0;
let currentYearPlanRecords = 0;
let matchedCandidateGroups = 0;
let currentYearMatchedCandidateGroups = 0;
let nearYearMatchedCandidateGroups = 0;
let matchedWithPlanCount = 0;
let matchedWithElectiveRequirement = 0;
let admissionMissingElectiveButPlanSupplies = 0;
let matchedSchoolOfficialPlans = 0;
let matchedExamAuthorityPlans = 0;
let matchedThirdPartyAdmissions = 0;
let plansExcludedAsVacancy = 0;
let plansExcludedAsRestricted = 0;
let plansExcludedAsSpecialPath = 0;
let oldPlanRecordsExcluded = 0;
const provinceRows = [];
const sourceCounts = new Map();
const examples = [];

for (const shardFile of shardFiles) {
  const shard = readGzipJson(path.join(releaseDir, shardFile));
  const records = shard.records || [];
  const admissions = records.filter((record) =>
    isNamedMajorAdmissionRecord(record) && !isSpecialPathRecord(record)
  );
  const plans = [];
  for (const record of records) {
    if (!isPlanRecord(record)) continue;
    if (isSpecialPathRecord(record)) {
      plansExcludedAsSpecialPath += 1;
      continue;
    }
    if (isVacancyPlanRecord(record)) {
      plansExcludedAsVacancy += 1;
      continue;
    }
    if (planRestrictedEligibilityReason(record)) {
      plansExcludedAsRestricted += 1;
      continue;
    }
    if (/third-party/.test(String(record.sourceQuality || ""))) continue;
    ordinaryPlanRecords += 1;
    if (![2025, 2026].includes(Number(record.year))) {
      oldPlanRecordsExcluded += 1;
      continue;
    }
    plans.push(record);
  }

  admissionRecords += records.filter((record) =>
    !isPlanRecord(record) && !isSpecialPathRecord(record) && record.dataType !== "control-line"
  ).length;
  namedAdmissionRecords += admissions.length;
  eligibleRecentPlanRecords += plans.length;
  currentYearPlanRecords += plans.filter((record) => Number(record.year) === 2026).length;

  const admissionGroups = new Map();
  for (const record of admissions) {
    const key = admissionGroupKey(record);
    if (!admissionGroups.has(key)) admissionGroups.set(key, []);
    admissionGroups.get(key).push(record);
  }
  const candidates = [...admissionGroups.values()].map(selectLatestRecord);
  candidateGroups += candidates.length;

  const planIndex = new Map();
  for (const plan of plans) {
    for (const key of planLookupKeys(plan)) {
      if (!planIndex.has(key)) planIndex.set(key, []);
      planIndex.get(key).push(plan);
    }
  }

  let provinceMatched = 0;
  let provinceCurrent = 0;
  for (const candidate of candidates) {
    const plan = latestMatchingPlan(candidate, planIndex);
    if (!plan) continue;
    provinceMatched += 1;
    matchedCandidateGroups += 1;
    const planYear = Number(plan.year) || 0;
    if (planYear === 2026) {
      currentYearMatchedCandidateGroups += 1;
      provinceCurrent += 1;
    } else if (planYear === 2025) {
      nearYearMatchedCandidateGroups += 1;
    }
    if (Number(plan.planCount) > 0) matchedWithPlanCount += 1;
    if (canonicalTypography(plan.electiveRequirement)) matchedWithElectiveRequirement += 1;
    if (!canonicalTypography(candidate.electiveRequirement) && canonicalTypography(plan.electiveRequirement)) {
      admissionMissingElectiveButPlanSupplies += 1;
    }
    if (/school/.test(String(plan.formalScoreScope || plan.sourceQuality || ""))) {
      matchedSchoolOfficialPlans += 1;
    } else {
      matchedExamAuthorityPlans += 1;
    }
    if (/third-party/.test(String(candidate.sourceQuality || ""))) {
      matchedThirdPartyAdmissions += 1;
    }
    sourceCounts.set(plan.sourceId || "unknown", (sourceCounts.get(plan.sourceId || "unknown") || 0) + 1);
    if (examples.length < 20 && planYear === 2026 && Number(plan.planCount) > 0) {
      examples.push({
        province: candidate.province,
        schoolName: candidate.schoolName,
        majorName: candidate.majorName,
        admissionYear: candidate.year,
        admissionBatch: candidate.batch,
        planYear,
        planCount: plan.planCount,
        planSubjectType: plan.subjectType,
        planElectiveRequirement: plan.electiveRequirement || "",
        planSourceId: plan.sourceId,
      });
    }
  }

  provinceRows.push({
    province: shard.province,
    candidateGroups: candidates.length,
    ordinaryPlans: plans.length,
    matchedCandidateGroups: provinceMatched,
    currentYearMatchedCandidateGroups: provinceCurrent,
  });
}

const provincesWithPlans = provinceRows.filter((row) => row.ordinaryPlans > 0).length;
const provincesWithMatches = provinceRows.filter((row) => row.matchedCandidateGroups > 0).length;
const provincesWithCurrentYearMatches = provinceRows.filter((row) => row.currentYearMatchedCandidateGroups > 0).length;
const topSources = [...sourceCounts.entries()]
  .map(([sourceId, matchedCandidateGroupsForSource]) => ({ sourceId, matchedCandidateGroups: matchedCandidateGroupsForSource }))
  .sort((left, right) => right.matchedCandidateGroups - left.matchedCandidateGroups);

assert(shardFiles.length === 31, `Expected 31 province shards, got ${shardFiles.length}`);
assert(admissionRecords > 700000, `Admission record coverage unexpectedly low: ${admissionRecords}`);
assert(ordinaryPlanRecords > 60000, `Ordinary plan coverage unexpectedly low: ${ordinaryPlanRecords}`);
assert(currentYearPlanRecords > 20000, `Current-year plan coverage unexpectedly low: ${currentYearPlanRecords}`);
assert(eligibleRecentPlanRecords > 50000, `Recent plan coverage unexpectedly low: ${eligibleRecentPlanRecords}`);
assert(matchedCandidateGroups > 1500, `Current-plan matches unexpectedly low: ${matchedCandidateGroups}`);
assert(currentYearMatchedCandidateGroups > 1000, `2026 plan matches unexpectedly low: ${currentYearMatchedCandidateGroups}`);
assert(admissionMissingElectiveButPlanSupplies > 100, `Plan elective enrichment unexpectedly low: ${admissionMissingElectiveButPlanSupplies}`);
assert(provincesWithPlans === 31, `Plan province coverage drifted: ${provincesWithPlans}`);

const manifest = {
  version: "v3.344",
  generatedAt,
  audit: "admission-current-plan-corroboration",
  policy: {
    evidenceDirection: "positive-corroboration-only",
    currentYear: 2026,
    planYearsAccepted: [2025, 2026],
    planRecordsIncluded: "official ordinary non-vacancy plans only",
    matchFields: [
      "province",
      "school code or canonical school name",
      "major code or canonical full major name",
      "canonical batch route",
      "compatible subject",
      "compatible admission subtype, campus, and candidate category",
    ],
    missingMatchMeaning: "unknown-not-discontinued",
    matchedPlanMeaning: "official-plan-presence-not-admission-probability",
    unmatchedElectiveAction: "exclude only when an exact latest-plan match explicitly conflicts with the profile",
  },
  counts: {
    provinces: shardFiles.length,
    admissionRecords,
    namedAdmissionRecords,
    candidateGroups,
    ordinaryPlanRecords,
    eligibleRecentPlanRecords,
    currentYearPlanRecords,
    matchedCandidateGroups,
    currentYearMatchedCandidateGroups,
    nearYearMatchedCandidateGroups,
    matchedWithPlanCount,
    matchedWithElectiveRequirement,
    admissionMissingElectiveButPlanSupplies,
    matchedSchoolOfficialPlans,
    matchedExamAuthorityPlans,
    matchedThirdPartyAdmissions,
    plansExcludedAsVacancy,
    plansExcludedAsRestricted,
    plansExcludedAsSpecialPath,
    oldPlanRecordsExcluded,
    provincesWithPlans,
    provincesWithMatches,
    provincesWithCurrentYearMatches,
  },
  provinceRows,
  topSources,
  examples,
  boundaries: [
    "A missing plan match is never treated as evidence that a major stopped recruiting because local plan coverage is uneven.",
    "Vacancy, special-path, military, targeted, preparatory, advance, and other restricted plans do not corroborate ordinary admission options.",
    "Plan presence confirms only that an official plan lists the school-major route; it does not create or raise an admission-probability estimate.",
    "Current plan elective requirements may exclude an exactly matched historical option when the profile explicitly fails them.",
    "Canonical matching only normalizes typography; semantic major-name changes are not merged automatically.",
  ],
};

fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile: path.relative(root, outputFile),
  counts: manifest.counts,
  topSources: topSources.slice(0, 8),
  examples: examples.slice(0, 5),
}, null, 2));
