#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const RELEASE_DIR = path.join(ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(ROOT, "data/admissions/evidence-v3339-admission-trend-provenance-manifest.json");
const GENERATED_AT = "2026-07-30T03:35:00+08:00";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function provenance(record) {
  if (/third-party/.test(String(record?.sourceQuality || ""))) return "third-party";
  if (record?.formalScoreScope === "school-official-only") return "school-official";
  if (/official/.test(String(record?.sourceQuality || ""))) return "official-exam-authority";
  return "other";
}

function evidencePriority(record) {
  return provenance(record) === "official-exam-authority" ? 3 :
    provenance(record) === "school-official" ? 2 :
      provenance(record) === "third-party" ? 0 : 1;
}

function routeFields(record) {
  return {
    group: normalize(record?.majorGroup),
    subtype: normalize(record?.admissionSubtype),
    campus: normalize(record?.campus || record?.campusName || record?.schoolCampus),
    tuition: normalize(record?.tuition || record?.tuitionFee),
    elective: normalize(record?.electiveRequirement),
    rankScope: normalize(record?.rankInstitutionScope),
  };
}

function oldTrendKey(record) {
  return [
    record.province,
    record.subjectType,
    record.batch,
    record.schoolName,
    record.majorName,
    record.majorGroup,
  ].map(normalize).join("|");
}

function routeSafeTrendKey(record) {
  const route = routeFields(record);
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
  ].map(normalize).join("|");
}

function addToMap(map, key, record) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(record);
}

function preferredRecord(records) {
  return records.reduce((selected, record) => {
    const selectedPriority = evidencePriority(selected);
    const recordPriority = evidencePriority(record);
    if (recordPriority !== selectedPriority) return recordPriority > selectedPriority ? record : selected;
    const selectedHasRank = Number(selected.minRankEnd || selected.minRank) > 0;
    const recordHasRank = Number(record.minRankEnd || record.minRank) > 0;
    return recordHasRank && !selectedHasRank ? record : selected;
  }, records[0]);
}

function auditTrendMap(map) {
  const result = {
    keys: map.size,
    multiYearKeys: 0,
    sameYearDuplicateGroups: 0,
    mixedProvenanceGroups: 0,
    officialReplacements: 0,
    trendEvidence: {
      officialOrSchoolOfficial: 0,
      containsThirdParty: 0,
      containsUnclassified: 0,
    },
  };
  for (const records of map.values()) {
    const years = new Set(records.map((record) => Number(record.year) || 0).filter(Boolean));
    if (years.size < 2) continue;
    result.multiYearKeys += 1;
    const recordsByYear = new Map();
    for (const record of records) {
      const year = Number(record.year) || 0;
      if (!recordsByYear.has(year)) recordsByYear.set(year, []);
      recordsByYear.get(year).push(record);
    }
    const selected = [];
    for (const sameYearRecords of recordsByYear.values()) {
      if (sameYearRecords.length > 1) {
        result.sameYearDuplicateGroups += 1;
        if (new Set(sameYearRecords.map(provenance)).size > 1) {
          result.mixedProvenanceGroups += 1;
        }
        if (
          evidencePriority(sameYearRecords[0]) <
          Math.max(...sameYearRecords.map(evidencePriority))
        ) {
          result.officialReplacements += 1;
        }
      }
      selected.push(preferredRecord(sameYearRecords));
    }
    if (selected.some((record) => provenance(record) === "third-party")) {
      result.trendEvidence.containsThirdParty += 1;
    } else if (selected.some((record) => provenance(record) === "other")) {
      result.trendEvidence.containsUnclassified += 1;
    } else {
      result.trendEvidence.officialOrSchoolOfficial += 1;
    }
  }
  return result;
}

function routeConflictStats(map) {
  const counts = {
    semanticRouteConflictGroups: 0,
    campus: 0,
    subtype: 0,
    tuition: 0,
    elective: 0,
    rankScope: 0,
    majorCode: 0,
  };
  for (const records of map.values()) {
    if (new Set(records.map((record) => Number(record.year) || 0)).size < 2) continue;
    let semanticConflict = false;
    const fields = {
      campus: (record) => record.campus || record.campusName || record.schoolCampus || "",
      subtype: (record) => record.admissionSubtype || "",
      tuition: (record) => record.tuition || record.tuitionFee || "",
      elective: (record) => record.electiveRequirement || "",
      rankScope: (record) => record.rankInstitutionScope || "",
      majorCode: (record) => record.majorCode || "",
    };
    for (const [field, getter] of Object.entries(fields)) {
      const values = new Set(records.map(getter).map(normalize).filter(Boolean));
      if (values.size < 2) continue;
      counts[field] += 1;
      if (field !== "majorCode") semanticConflict = true;
    }
    if (semanticConflict) counts.semanticRouteConflictGroups += 1;
  }
  return counts;
}

function compactRecord(record) {
  return {
    id: record.id,
    province: record.province,
    schoolName: record.schoolName,
    majorName: record.majorName,
    year: record.year,
    minScore: record.minScore || null,
    minRankEnd: record.minRankEnd || record.minRank || null,
    majorGroup: record.majorGroup || "",
    subtype: record.admissionSubtype || "",
    campus: record.campus || record.campusName || record.schoolCampus || "",
    elective: record.electiveRequirement || "",
    provenance: provenance(record),
  };
}

function sample(records, province, schoolName, majorName) {
  return records
    .filter((record) =>
      record.province === province &&
      record.schoolName === schoolName &&
      record.majorName === majorName
    )
    .sort((left, right) => Number(right.year) - Number(left.year))
    .map(compactRecord);
}

function main() {
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const manifest = readGzipJson(path.join(RELEASE_DIR, "manifest.json.gz"));
  const records = [];
  const oldTrendMap = new Map();
  const routeSafeTrendMap = new Map();
  for (const [province, shard] of Object.entries(manifest.shards)) {
    const data = readGzipJson(path.join(RELEASE_DIR, `${shard.file}.gz`));
    assert(data.province === province, `Province mismatch for ${province}`);
    assert(data.records.length === shard.records, `Record count mismatch for ${province}`);
    for (const record of data.records) {
      if (record.dataType !== "major-admission" || !record.majorName) continue;
      records.push(record);
      addToMap(oldTrendMap, oldTrendKey(record), record);
      addToMap(routeSafeTrendMap, routeSafeTrendKey(record), record);
    }
  }

  const oldTrend = auditTrendMap(oldTrendMap);
  const routeSafeTrend = auditTrendMap(routeSafeTrendMap);
  const routeConflicts = routeConflictStats(oldTrendMap);
  assert(records.length === 475801, `Major-admission record count drifted: ${records.length}`);
  assert(oldTrend.keys === 288627, "Old trend-key count drifted");
  assert(oldTrend.multiYearKeys === 107621, "Old multi-year trend count drifted");
  assert(oldTrend.sameYearDuplicateGroups === 6145, "Old same-year duplicate count drifted");
  assert(oldTrend.mixedProvenanceGroups === 5189, "Old mixed-provenance count drifted");
  assert(oldTrend.officialReplacements === 4523, "Old lower-priority-first count drifted");
  assert(routeConflicts.semanticRouteConflictGroups === 4384, "Old route-conflict count drifted");
  assert(routeSafeTrend.keys === 301738, "Route-safe trend-key count drifted");
  assert(routeSafeTrend.multiYearKeys === 106989, "Route-safe multi-year trend count drifted");
  assert(routeSafeTrend.officialReplacements === 726, "Route-safe official replacement count drifted");

  const examples = {
    officialFirst: sample(records, "北京", "中央民族大学", "电子信息类"),
    electiveAndCampusIsolation: sample(records, "北京", "西安电子科技大学", "计算机类"),
    campusIsolation: sample(records, "北京", "湖南中医药大学", "针灸推拿学"),
  };
  assert(examples.officialFirst.length >= 6, "Central Minzu trend sample drifted");
  assert(examples.electiveAndCampusIsolation.length === 4, "Xidian trend sample drifted");
  assert(examples.campusIsolation.length === 2, "Hunan TCM trend sample drifted");

  const evidence = {
    dataset: "evidence-v3339-admission-trend-provenance",
    generatedAt: GENERATED_AT,
    sourceModelVersion: manifest.modelVersion,
    provinces: Object.keys(manifest.shards).length,
    majorAdmissionRecords: records.length,
    before: {
      ...oldTrend,
      routeConflicts,
    },
    afterPolicySimulation: {
      ...routeSafeTrend,
      multiYearKeysRemovedForRouteSafety: oldTrend.multiYearKeys - routeSafeTrend.multiYearKeys,
    },
    controls: {
      routeKeyFields: [
        "province",
        "subjectType",
        "batch",
        "school",
        "dataType",
        "majorName",
        "majorGroup",
        "admissionSubtype",
        "campus",
        "tuition",
        "electiveRequirement",
        "rankInstitutionScope",
      ],
      sameYearPreference: ["official-exam-authority", "school-official", "other", "third-party"],
      samePriorityRankPreference: true,
      thirdPartyTrendBonus: 2,
      officialTrendBonus: 5,
      thirdPartyTrendWarningRequired: true,
      majorCodeExcludedFromCrossYearIdentity: "专业代码可能逐年变化；同校同专业仍须由专业组、校区、类型、学费、选科和位次适用范围约束。",
    },
    examples,
    timestampCorrection: {
      previousGeneratedAt: "2026-07-30T20:30:00+08:00",
      correctedGeneratedAt: GENERATED_AT,
      reason: "上一版生成时间晚于机器实际时间，本轮恢复为实际本地时间。",
    },
    boundary: "This is a read-only trend audit. No admission, rank, plan, or source-note record was added, deleted, or rewritten.",
  };
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    provinces: evidence.provinces,
    majorAdmissionRecords: evidence.majorAdmissionRecords,
    before: {
      multiYearKeys: oldTrend.multiYearKeys,
      lowerPriorityFirst: oldTrend.officialReplacements,
      semanticRouteConflictGroups: routeConflicts.semanticRouteConflictGroups,
    },
    after: {
      multiYearKeys: routeSafeTrend.multiYearKeys,
      officialReplacements: routeSafeTrend.officialReplacements,
      containsThirdParty: routeSafeTrend.trendEvidence.containsThirdParty,
    },
  }, null, 2));
}

main();
