#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume audit execution.");
const releaseDir = path.join(root, "site/data/release-v3.275");
const outputFile = path.join(
  root,
  "data/admissions/evidence-v3345-admission-plan-route-transition-manifest.json",
);
const previousAuditFile = path.join(
  root,
  "data/admissions/evidence-v3344-admission-current-plan-corroboration-manifest.json",
);
const generatedAt = "2026-07-30T10:30:00+08:00";
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
  if (/征集|补录|补充录取|剩余计划/.test(text)) {
    const round = /第三轮|第3轮|第三次|第3次/.test(text) ? "3"
      : /第二轮|第2轮|第二次|第2次/.test(text) ? "2" : "1";
    const level = /专科|高职/.test(text) ? "vocational"
      : /本科/.test(text) ? "undergraduate" : "ordinary";
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

function isOrdinaryUndergraduateRoute(route) {
  return /^(?:undergraduate-[123]|ordinary-initial)(?::|$)/.test(route);
}

function routeCompatibility(plan, admission) {
  const planRoute = batchRouteKey(plan?.batch);
  const admissionRoute = batchRouteKey(admission?.batch);
  if (planRoute === admissionRoute) return { kind: "exact-route", exact: true };
  if (!isOrdinaryUndergraduateRoute(planRoute) || !isOrdinaryUndergraduateRoute(admissionRoute)) {
    return null;
  }
  const planQualifier = batchQualifier(plan?.batch);
  const admissionQualifier = batchQualifier(admission?.batch);
  if (planQualifier && admissionQualifier && planQualifier !== admissionQualifier) return null;
  return { kind: "ordinary-undergraduate-transition", exact: false };
}

function isPlanRecord(record) {
  return record?.dataType === "admission-plan" || record?.planOnly === true;
}

function vacancyPlanText(record) {
  return canonicalTypography([
    record?.planStage,
    record?.batch,
    record?.planRemark,
    record?.sourceQuality,
    record?.sourceId,
  ].join(" "));
}

function isSupplementPlanRecord(record) {
  return /补录|补充录取/.test(vacancyPlanText(record));
}

function isVacancyPlanRecord(record) {
  return record?.planStage === "征集志愿" ||
    record?.formalScoreScope === "vacancy-plan-only" ||
    /征集|补录|补充录取|剩余计划/.test(vacancyPlanText(record));
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
  if (/定向就业|定向培养|公费师范|优师计划|免费师范|军士|飞行员/.test(text)) {
    return "定向或资格计划";
  }
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

function identityLookupKeys(record) {
  const province = canonicalTypography(record?.province);
  const keys = [];
  for (const school of schoolAliases(record)) {
    for (const major of majorAliases(record)) {
      keys.push([province, school, major].join("|"));
    }
  }
  return keys;
}

function strictLookupKeys(record) {
  const batch = batchRouteKey(record?.batch);
  return identityLookupKeys(record).map((key) => `${key}|${batch}`);
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
    sameOptionalRouteValue(plan, admission, ["admissionType"]) &&
    sameOptionalRouteValue(plan, admission, ["admissionSubtype"]) &&
    sameOptionalRouteValue(plan, admission, ["campus", "campusName", "schoolCampus"]) &&
    sameOptionalRouteValue(plan, admission, ["candidateCategory", "candidateClass"]);
}

function planEligibilitySignature(plan) {
  return [
    normalizeSubject(plan?.subjectType),
    canonicalTypography(plan?.electiveRequirement),
    routeField(plan, ["admissionType"]),
    routeField(plan, ["admissionSubtype"]),
    routeField(plan, ["campus", "campusName", "schoolCampus"]),
    routeField(plan, ["candidateCategory", "candidateClass"]),
  ].join("|");
}

function planRequirementsAmbiguous(plans) {
  const fields = [
    (plan) => normalizeSubject(plan?.subjectType),
    (plan) => canonicalTypography(plan?.electiveRequirement),
    (plan) => routeField(plan, ["admissionType"]),
    (plan) => routeField(plan, ["admissionSubtype"]),
    (plan) => routeField(plan, ["campus", "campusName", "schoolCampus"]),
    (plan) => routeField(plan, ["candidateCategory", "candidateClass"]),
  ];
  return fields.some((read) =>
    new Set(plans.map(read).filter(Boolean)).size > 1
  );
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
    (Number(right.minRankEnd || right.minRank) || 0) -
      (Number(left.minRankEnd || left.minRank) || 0) ||
    (Number(right.minScore) || 0) - (Number(left.minScore) || 0)
  )[0];
}

function addToIndex(index, keys, record) {
  for (const key of keys) {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(record);
  }
}

function collectMatches(record, index, keys, expectedKind) {
  const matches = [];
  const seen = new Set();
  for (const key of keys) {
    for (const plan of index.get(key) || []) {
      const identity = plan.id || `${key}|${plan.year}|${plan.subjectType}|${plan.electiveRequirement}`;
      const compatibility = routeCompatibility(plan, record);
      if (
        seen.has(identity) ||
        compatibility?.kind !== expectedKind ||
        !planMatchesAdmission(plan, record)
      ) continue;
      seen.add(identity);
      matches.push({ plan, compatibility });
    }
  }
  return matches;
}

function latestMatch(matches) {
  if (!matches.length) return null;
  const latestYear = Math.max(...matches.map(({ plan }) => Number(plan.year) || 0));
  const latestMatches = matches.filter(({ plan }) => Number(plan.year) === latestYear);
  const ambiguousRequirements = planRequirementsAmbiguous(
    latestMatches.map(({ plan }) => plan),
  );
  const selected = [...latestMatches].sort((left, right) =>
    (Number(right.plan.planCount) || 0) - (Number(left.plan.planCount) || 0)
  )[0];
  return { ...selected, latestMatches, ambiguousRequirements };
}

const previousAudit = JSON.parse(fs.readFileSync(previousAuditFile, "utf8"));
const shardFiles = fs.readdirSync(releaseDir)
  .filter((file) => file.endsWith(".json.gz"))
  .filter((file) => ![
    "knowledge-core.json.gz",
    "knowledge-core-lite.json.gz",
    "manifest.json.gz",
  ].includes(file))
  .sort();

const counts = {
  provinces: shardFiles.length,
  allPlanRecords: 0,
  admissionRecords: 0,
  namedAdmissionRecords: 0,
  candidateGroups: 0,
  ordinaryPlanRecords: 0,
  eligibleRecentPlanRecords: 0,
  currentYearPlanRecords: 0,
  exactRouteMatchedCandidateGroups: 0,
  routeTransitionMatchedCandidateGroups: 0,
  matchedCandidateGroups: 0,
  exactCurrentYearMatchedCandidateGroups: 0,
  transitionCurrentYearMatchedCandidateGroups: 0,
  currentYearMatchedCandidateGroups: 0,
  exactNearYearMatchedCandidateGroups: 0,
  transitionNearYearMatchedCandidateGroups: 0,
  nearYearMatchedCandidateGroups: 0,
  ambiguousPlanRequirementGroups: 0,
  transitionAmbiguousPlanRequirementGroups: 0,
  matchedWithPlanCount: 0,
  matchedWithElectiveRequirement: 0,
  admissionMissingElectiveButPlanSupplies: 0,
  plansExcludedAsVacancy: 0,
  supplementPlansExcluded: 0,
  plansExcludedAsRestricted: 0,
  plansExcludedAsSpecialPath: 0,
  oldPlanRecordsExcluded: 0,
};
const provinceRows = [];
const transitionPairs = new Map();
const sourceCounts = new Map();
const examples = [];
const ambiguousExamples = [];

for (const shardFile of shardFiles) {
  const shard = readGzipJson(path.join(releaseDir, shardFile));
  const records = shard.records || [];
  const admissions = records.filter((record) =>
    isNamedMajorAdmissionRecord(record) && !isSpecialPathRecord(record)
  );
  const plans = [];
  for (const record of records) {
    if (!isPlanRecord(record)) continue;
    counts.allPlanRecords += 1;
    if (isSpecialPathRecord(record)) {
      counts.plansExcludedAsSpecialPath += 1;
      continue;
    }
    if (isVacancyPlanRecord(record)) {
      counts.plansExcludedAsVacancy += 1;
      if (isSupplementPlanRecord(record)) counts.supplementPlansExcluded += 1;
      continue;
    }
    if (planRestrictedEligibilityReason(record)) {
      counts.plansExcludedAsRestricted += 1;
      continue;
    }
    if (/third-party/.test(String(record.sourceQuality || ""))) continue;
    counts.ordinaryPlanRecords += 1;
    if (![2025, 2026].includes(Number(record.year))) {
      counts.oldPlanRecordsExcluded += 1;
      continue;
    }
    plans.push(record);
  }

  counts.admissionRecords += records.filter((record) =>
    !isPlanRecord(record) && !isSpecialPathRecord(record) && record.dataType !== "control-line"
  ).length;
  counts.namedAdmissionRecords += admissions.length;
  counts.eligibleRecentPlanRecords += plans.length;
  counts.currentYearPlanRecords += plans.filter((record) => Number(record.year) === 2026).length;

  const admissionGroups = new Map();
  for (const record of admissions) {
    const key = admissionGroupKey(record);
    if (!admissionGroups.has(key)) admissionGroups.set(key, []);
    admissionGroups.get(key).push(record);
  }
  const candidates = [...admissionGroups.values()].map(selectLatestRecord);
  counts.candidateGroups += candidates.length;

  const strictIndex = new Map();
  const identityIndex = new Map();
  for (const plan of plans) {
    addToIndex(strictIndex, strictLookupKeys(plan), plan);
    addToIndex(identityIndex, identityLookupKeys(plan), plan);
  }

  const provinceCount = {
    exactRoute: 0,
    transition: 0,
    currentTransition: 0,
  };
  for (const candidate of candidates) {
    const exact = latestMatch(collectMatches(
      candidate,
      strictIndex,
      strictLookupKeys(candidate),
      "exact-route",
    ));
    const match = exact || latestMatch(collectMatches(
      candidate,
      identityIndex,
      identityLookupKeys(candidate),
      "ordinary-undergraduate-transition",
    ));
    if (!match) continue;
    const plan = match.plan;
    const transition = !match.compatibility.exact;
    const planYear = Number(plan.year) || 0;
    counts.matchedCandidateGroups += 1;
    if (transition) {
      counts.routeTransitionMatchedCandidateGroups += 1;
      provinceCount.transition += 1;
    } else {
      counts.exactRouteMatchedCandidateGroups += 1;
      provinceCount.exactRoute += 1;
    }
    if (planYear === 2026) {
      counts.currentYearMatchedCandidateGroups += 1;
      if (transition) {
        counts.transitionCurrentYearMatchedCandidateGroups += 1;
        provinceCount.currentTransition += 1;
      } else {
        counts.exactCurrentYearMatchedCandidateGroups += 1;
      }
    } else if (planYear === 2025) {
      counts.nearYearMatchedCandidateGroups += 1;
      if (transition) counts.transitionNearYearMatchedCandidateGroups += 1;
      else counts.exactNearYearMatchedCandidateGroups += 1;
    }
    if (match.ambiguousRequirements) {
      counts.ambiguousPlanRequirementGroups += 1;
      if (transition) counts.transitionAmbiguousPlanRequirementGroups += 1;
      if (ambiguousExamples.length < 12) {
        ambiguousExamples.push({
          province: candidate.province,
          schoolName: candidate.schoolName,
          majorName: candidate.majorName,
          admissionYear: candidate.year,
          admissionBatch: candidate.batch,
          planYear,
          planBatch: plan.batch,
          requirementSignatures: [...new Set(
            match.latestMatches.map(({ plan: item }) => planEligibilitySignature(item)),
          )],
          planIds: match.latestMatches.map(({ plan: item }) => item.id),
        });
      }
    }
    if (!match.ambiguousRequirements && Number(plan.planCount) > 0) {
      counts.matchedWithPlanCount += 1;
    }
    if (!match.ambiguousRequirements && canonicalTypography(plan.electiveRequirement)) {
      counts.matchedWithElectiveRequirement += 1;
      if (!canonicalTypography(candidate.electiveRequirement)) {
        counts.admissionMissingElectiveButPlanSupplies += 1;
      }
    }
    sourceCounts.set(plan.sourceId || "unknown", (sourceCounts.get(plan.sourceId || "unknown") || 0) + 1);

    if (transition) {
      const pair = `${candidate.batch || "未标注"} -> ${plan.batch || "未标注"}`;
      transitionPairs.set(pair, (transitionPairs.get(pair) || 0) + 1);
      if (examples.length < 24 && planYear === 2026) {
        examples.push({
          province: candidate.province,
          schoolName: candidate.schoolName,
          majorName: candidate.majorName,
          admissionYear: candidate.year,
          admissionBatch: candidate.batch,
          planYear,
          planBatch: plan.batch,
          planCount: match.ambiguousRequirements ? null : plan.planCount,
          planElectiveRequirement: match.ambiguousRequirements ? "multiple-needs-review" : plan.electiveRequirement,
          ambiguousRequirements: match.ambiguousRequirements,
          planSourceId: plan.sourceId,
        });
      }
    }
  }

  provinceRows.push({
    province: shard.province,
    candidateGroups: candidates.length,
    eligibleRecentPlans: plans.length,
    exactRouteMatchedCandidateGroups: provinceCount.exactRoute,
    routeTransitionMatchedCandidateGroups: provinceCount.transition,
    transitionCurrentYearMatchedCandidateGroups: provinceCount.currentTransition,
  });
}

counts.provincesWithPlans = provinceRows.filter((row) => row.eligibleRecentPlans > 0).length;
counts.provincesWithMatches = provinceRows.filter((row) =>
  row.exactRouteMatchedCandidateGroups + row.routeTransitionMatchedCandidateGroups > 0
).length;
counts.provincesWithRouteTransitions = provinceRows.filter((row) =>
  row.routeTransitionMatchedCandidateGroups > 0
).length;
counts.provincesWithCurrentYearMatches = provinceRows.filter((row) =>
  row.exactRouteMatchedCandidateGroups > 0 ||
  row.transitionCurrentYearMatchedCandidateGroups > 0
).length;

assert(counts.provinces === 31, `Expected 31 province shards, got ${counts.provinces}`);
assert(counts.allPlanRecords === 71894, `All plan count drifted: ${counts.allPlanRecords}`);
assert(counts.admissionRecords === previousAudit.counts.admissionRecords, "Admission count drifted");
assert(counts.namedAdmissionRecords === previousAudit.counts.namedAdmissionRecords, "Named admission count drifted");
assert(counts.candidateGroups === previousAudit.counts.candidateGroups, "Candidate group count drifted");
assert(
  counts.exactRouteMatchedCandidateGroups === previousAudit.counts.matchedCandidateGroups,
  `Exact matches changed after supplement isolation: ${counts.exactRouteMatchedCandidateGroups}`,
);
assert(counts.supplementPlansExcluded === 1902, `Supplement isolation drifted: ${counts.supplementPlansExcluded}`);
assert(counts.routeTransitionMatchedCandidateGroups > 500, "Route-transition coverage unexpectedly low");
assert(counts.transitionCurrentYearMatchedCandidateGroups > 400, "Current transition coverage unexpectedly low");
assert(counts.provincesWithPlans === 31, `Plan province coverage drifted: ${counts.provincesWithPlans}`);

const topSources = [...sourceCounts.entries()]
  .map(([sourceId, matchedCandidateGroups]) => ({ sourceId, matchedCandidateGroups }))
  .sort((left, right) => right.matchedCandidateGroups - left.matchedCandidateGroups);
const topTransitionPairs = [...transitionPairs.entries()]
  .map(([transition, matchedCandidateGroups]) => ({ transition, matchedCandidateGroups }))
  .sort((left, right) => right.matchedCandidateGroups - left.matchedCandidateGroups);

const manifest = {
  version: "v3.345",
  generatedAt,
  audit: "admission-plan-route-transition",
  previousVersion: "v3.344",
  policy: {
    evidenceDirection: "positive-corroboration-only",
    currentYear: 2026,
    planYearsAccepted: [2025, 2026],
    strictRoutePriority: true,
    allowedFallback: "ordinary-undergraduate-batch-label-transition-only",
    fallbackIdentityRequirements: [
      "same province",
      "same school code or canonical full school name",
      "same major code or canonical full major name",
      "compatible subject",
      "compatible admission type, subtype, campus, and candidate category",
      "both routes are unrestricted ordinary undergraduate routes",
      "explicit batch qualifiers do not conflict",
    ],
    fallbackCurrentYearMaximumRankingBonus: 5,
    fallbackElectiveConflictAction: "review-only-never-auto-exclude",
    ambiguousPlanRequirementAction: "review-only-zero-plan-count-and-maximum-one-point",
    supplementAndVacancyAction: "excluded-from-ordinary-plan-evidence",
    missingMatchMeaning: "unknown-not-discontinued",
  },
  counts,
  provinceRows,
  topSources,
  topTransitionPairs,
  examples,
  ambiguousExamples,
  boundaries: [
    "Exact batch-route matches always take priority over batch-label transitions.",
    "A transition match never crosses undergraduate, vocational, advance, special, preparatory, vacancy, or restricted route families.",
    "Supplement, vacancy, and remaining-plan records never corroborate an ordinary admission option.",
    "A transition match can add at most five ranking-evidence points and never changes the historical admission-fit zone.",
    "A transition elective conflict is review-only and never automatically removes the historical candidate.",
    "Conflicting current plan requirements are marked ambiguous; no individual plan count is displayed and no candidate is removed.",
    "A missing plan match remains unknown and is never treated as evidence that a major stopped recruiting.",
  ],
};

fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile: path.relative(root, outputFile),
  counts,
  topTransitionPairs: topTransitionPairs.slice(0, 10),
  examples: examples.slice(0, 6),
  ambiguousExamples,
}, null, 2));
