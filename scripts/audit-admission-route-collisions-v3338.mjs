#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const RELEASE_DIR = path.join(ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(ROOT, "data/admissions/evidence-v3338-admission-route-collision-manifest.json");
const GENERATED_AT = "2026-07-30T20:30:00+08:00";
const GENERIC_MAJOR_PATTERN = /^(院校投档线|院校专业组投档线|学校录取分数线|院校最低分|专业组投档线|投档线)$/;
const DISTINCT_ROUTE_PATTERN = /中外|合作|国际|联合培养|境外|校区|医学院|专项|民族|预科|定向|单列|较高收费|高收费|护理|公费|优师/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isAdmissionRecord(record) {
  return String(record?.dataType || "").includes("admission") && record.dataType !== "admission-plan";
}

function provenance(record) {
  if (/third-party/.test(String(record?.sourceQuality || ""))) return "third-party";
  if (record?.formalScoreScope === "school-official-only") return "school-official";
  return "official-exam-authority";
}

function evidencePriority(record) {
  return provenance(record) === "official-exam-authority" ? 3 :
    provenance(record) === "school-official" ? 2 :
      provenance(record) === "third-party" ? 0 : 1;
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
    !GENERIC_MAJOR_PATTERN.test(majorName);
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
        DISTINCT_ROUTE_PATTERN.test(presentValue)
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

function recordsShareRoute(left, right) {
  if (baseIdentity(left) !== baseIdentity(right)) return false;
  const leftRoute = routeFields(left);
  const rightRoute = routeFields(right);
  if (!isNamedMajor(left) || !isNamedMajor(right)) {
    return leftRoute.group === rightRoute.group && !routeFieldsConflict(left, right);
  }
  if (leftRoute.group === rightRoute.group) return !routeFieldsConflict(left, right);
  if (leftRoute.group && rightRoute.group) return false;
  const namedGroup = leftRoute.group || rightRoute.group;
  if (DISTINCT_ROUTE_PATTERN.test(namedGroup)) return false;
  return sameYearBoundary(left, right) && !routeFieldsConflict(left, right);
}

function dedupeRouteRecords(records) {
  const selected = [];
  let officialReplacements = 0;
  for (const record of records) {
    const index = selected.findIndex((current) => recordsShareRoute(current, record));
    if (index < 0) {
      selected.push(record);
      continue;
    }
    const current = selected[index];
    if (evidencePriority(record) > evidencePriority(current)) {
      if (provenance(record) !== provenance(current)) officialReplacements += 1;
      selected[index] = record;
    }
  }
  return { selected, officialReplacements };
}

function compactRecord(record) {
  return {
    id: record.id,
    province: record.province,
    schoolName: record.schoolName,
    dataType: record.dataType,
    majorName: record.majorName,
    majorGroup: record.majorGroup || "",
    batch: record.batch || "",
    admissionSubtype: record.admissionSubtype || "",
    campus: record.campus || record.campusName || record.schoolCampus || "",
    electiveRequirement: record.electiveRequirement || "",
    minScore: record.minScore || null,
    minRankEnd: record.minRankEnd || record.minRank || null,
    provenance: provenance(record),
  };
}

function namedExample(records, schoolName, majorName = "") {
  return records
    .filter((record) => record.year === 2025 && record.schoolName === schoolName)
    .filter((record) => !majorName || record.majorName === majorName)
    .map(compactRecord);
}

function main() {
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const manifest = readGzipJson(path.join(RELEASE_DIR, "manifest.json.gz"));
  const allRecords = [];
  const provinceProvenance = {};
  const provenanceCounts = {
    "official-exam-authority": 0,
    "school-official": 0,
    "third-party": 0,
  };

  for (const [province, shard] of Object.entries(manifest.shards)) {
    const data = readGzipJson(path.join(RELEASE_DIR, `${shard.file}.gz`));
    assert(data.province === province, `Province mismatch for ${province}`);
    assert(data.records.length === shard.records, `Record count mismatch for ${province}`);
    const counts = { total: 0, official: 0, schoolOfficial: 0, thirdParty: 0 };
    for (const record of data.records) {
      if (!isAdmissionRecord(record)) continue;
      allRecords.push(record);
      counts.total += 1;
      const kind = provenance(record);
      provenanceCounts[kind] += 1;
      if (kind === "third-party") counts.thirdParty += 1;
      else if (kind === "school-official") counts.schoolOfficial += 1;
      else counts.official += 1;
    }
    counts.thirdPartyRate = Number((counts.thirdParty / counts.total).toFixed(6));
    provinceProvenance[province] = counts;
  }

  assert(allRecords.length === 794934, `Admission-record count drifted: ${allRecords.length}`);
  assert(provenanceCounts["official-exam-authority"] === 528948, "Official provenance count drifted");
  assert(provenanceCounts["school-official"] === 163808, "School-official provenance count drifted");
  assert(provenanceCounts["third-party"] === 102178, "Third-party provenance count drifted");

  const broadGroups = new Map();
  for (const record of allRecords) {
    const key = baseIdentity(record);
    if (!broadGroups.has(key)) broadGroups.set(key, []);
    broadGroups.get(key).push(record);
  }

  const collisions = {
    broadIdentityGroups: broadGroups.size,
    latestYearCollisionGroups: 0,
    differingMajorGroup: 0,
    differingScore: 0,
    mixedProvenance: 0,
    routeSafeDistinctGroups: 0,
    clearDuplicatesCollapsed: 0,
    officialReplacementsSelected: 0,
  };
  for (const records of broadGroups.values()) {
    const latestYear = Math.max(...records.map((record) => Number(record.year) || 0));
    const latest = records.filter((record) => (Number(record.year) || 0) === latestYear);
    if (latest.length < 2) continue;
    collisions.latestYearCollisionGroups += 1;
    if (new Set(latest.map((record) => normalize(record.majorGroup)).filter(Boolean)).size > 1) {
      collisions.differingMajorGroup += 1;
    }
    if (new Set(latest.map((record) => Number(record.minScore) || 0).filter(Boolean)).size > 1) {
      collisions.differingScore += 1;
    }
    if (new Set(latest.map(provenance)).size > 1) collisions.mixedProvenance += 1;
    const deduped = dedupeRouteRecords(latest);
    if (deduped.selected.length > 1) collisions.routeSafeDistinctGroups += 1;
    collisions.clearDuplicatesCollapsed += latest.length - deduped.selected.length;
    collisions.officialReplacementsSelected += deduped.officialReplacements;
  }

  const beijing = allRecords.filter((record) => record.province === "北京");
  const jiangxi = allRecords.filter((record) => record.province === "江西");
  const examples = {
    beijingSportUniversity: namedExample(beijing, "北京体育大学", "院校专业组投档线"),
    centralAcademyOfFineArts: namedExample(beijing, "中央美术学院", "院校专业组投档线"),
    shenyangAgriculturalUniversity: namedExample(beijing, "沈阳农业大学", "院校投档线"),
    minzuUniversityElectronicInformation: namedExample(beijing, "中央民族大学", "电子信息类"),
    jiangxiFinanceSoftware: namedExample(jiangxi, "江西财经大学", "软件工程(VR软件开发）"),
  };
  assert(examples.beijingSportUniversity.length === 8, "Beijing Sport University route sample drifted");
  assert(examples.centralAcademyOfFineArts.length === 4, "Central Academy of Fine Arts route sample drifted");
  assert(examples.shenyangAgriculturalUniversity.length === 2, "Shenyang Agricultural University route sample drifted");
  assert(examples.minzuUniversityElectronicInformation.length === 2, "Minzu University provenance sample drifted");
  assert(examples.jiangxiFinanceSoftware.length === 2, "Jiangxi Finance duplicate sample drifted");

  const highestThirdPartyRates = Object.entries(provinceProvenance)
    .sort((left, right) => right[1].thirdPartyRate - left[1].thirdPartyRate)
    .slice(0, 6)
    .map(([province, counts]) => ({ province, ...counts }));
  const evidence = {
    dataset: "evidence-v3338-admission-route-collision",
    generatedAt: GENERATED_AT,
    sourceModelVersion: manifest.modelVersion,
    provinces: Object.keys(manifest.shards).length,
    admissionRecords: allRecords.length,
    provenanceCounts,
    highestThirdPartyRates,
    collisionDefinition: "按v3.337同省、同科类、同校、同专业、同数据类型宽键分组，再检查各组最新年份内的重复记录。",
    collisions,
    controls: {
      preserveDifferentNonblankMajorGroups: true,
      preserveGenericInstitutionAndMajorGroupRoutes: true,
      preserveRouteFields: ["majorGroup", "admissionSubtype", "campus", "tuition", "electiveRequirement", "majorCode", "rankInstitutionScope"],
      blankGroupMergeRequiresExactSameYearBoundary: true,
      sameRouteEvidencePreference: ["official-exam-authority", "school-official", "other", "third-party"],
    },
    examples,
    boundary: "This is a read-only collision audit. No admission, rank, plan, or source-note record was added, deleted, or rewritten.",
  };
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    provinces: evidence.provinces,
    admissionRecords: evidence.admissionRecords,
    provenanceCounts,
    collisions,
    highestThirdPartyRates: highestThirdPartyRates.map(({ province, thirdPartyRate }) => ({ province, thirdPartyRate })),
  }, null, 2));
}

main();
