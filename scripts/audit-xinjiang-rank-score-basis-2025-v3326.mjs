#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "sohu-xinjiang-rank-2025-cb85600e32";
const EVIDENCE_ID = "verified-xinjiang-rank-score-basis-2025-v3326";
const PROVINCE = "新疆";
const YEAR = 2025;
const SUBJECTS = ["历史类", "物理类"];
const OFFICIAL_FILING_SOURCE_IDS = new Set([
  "official-xinjiang-undergraduate1-filing-2025-v3311",
  "official-xinjiang-undergraduate2-filing-2025-v3312",
  "official-xinjiang-undergraduate2-filing-2025",
]);

function parseArgs(argv) {
  const args = {
    gk100Html: "",
    policyHtml: "",
    controlLinesHtml: "",
    controlLinesImage: "",
    releaseDir: "site/data/release-v3.275",
    out: "data/admissions/xinjiang-rank-score-basis-audit-2025-v3326.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--gk100-html") args.gk100Html = argv[++index];
    else if (item === "--policy-html") args.policyHtml = argv[++index];
    else if (item === "--control-lines-html") args.controlLinesHtml = argv[++index];
    else if (item === "--control-lines-image") args.controlLinesImage = argv[++index];
    else if (item === "--release-dir") args.releaseDir = argv[++index];
    else if (item === "--out") args.out = argv[++index];
    else throw new Error(`Unknown argument: ${item}`);
  }
  for (const key of ["gk100Html", "policyHtml", "controlLinesHtml", "controlLinesImage"]) {
    if (!args[key]) throw new Error(`Missing required argument --${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function cleanHtmlText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "")
    .trim();
}

function stripCell(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGk100Rows(html) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => stripCell(match[1]));
    if (cells.length < 6 || !["文科", "理科"].includes(cells[3]) || cells[4] !== PROVINCE || cells[5] !== String(YEAR)) continue;
    const top = /^(\d+)及以上$/.exec(cells[0]);
    const score = Number(top ? top[1] : cells[0]);
    const people = Number(cells[1]);
    const cumulative = Number(cells[2]);
    if (![score, people, cumulative].every(Number.isInteger)) continue;
    rows.push({
      score,
      people,
      cumulative,
      sourceSubjectRaw: cells[3],
      subjectType: cells[3] === "文科" ? "历史类" : "物理类",
      topMerged: Boolean(top),
    });
  }
  return rows;
}

function rankKey(row) {
  return `${row.subjectType}|${row.score}`;
}

function summarize(rows, subjectType) {
  const scoped = rows.filter((row) => row.subjectType === subjectType);
  return {
    subjectType,
    sourceSubjectRaw: subjectType === "历史类" ? "文科" : "理科",
    rows: scoped.length,
    positiveRows: scoped.filter((row) => row.people > 0).length,
    zeroRows: scoped.filter((row) => row.people === 0).length,
    scoreRange: {
      min: Math.min(...scoped.map((row) => row.score)),
      max: Math.max(...scoped.map((row) => row.score)),
    },
    finalCumulative: scoped.at(-1)?.cumulative,
    topMerged: scoped[0],
  };
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
  const item = manifest.shards[PROVINCE];
  assert(item, "Xinjiang runtime shard is missing");
  const shard = readGzipJson(path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`));
  const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));

  const gk100Bytes = fs.readFileSync(path.resolve(args.gk100Html));
  const policyBytes = fs.readFileSync(path.resolve(args.policyHtml));
  const controlHtmlBytes = fs.readFileSync(path.resolve(args.controlLinesHtml));
  const controlImageBytes = fs.readFileSync(path.resolve(args.controlLinesImage));
  const gk100Rows = parseGk100Rows(gk100Bytes.toString("utf8"));
  const positiveRows = gk100Rows.filter((row) => row.people > 0);
  assert(gk100Rows.length === 1033, `Expected 1033 independent mirror rows, got ${gk100Rows.length}`);
  assert(positiveRows.length === 996, `Expected 996 positive mirror rows, got ${positiveRows.length}`);
  assert(gk100Rows.filter((row) => row.people === 0).length === 37, "Independent mirror zero-row count drifted");

  const existingRows = shard.rankConversions.filter((row) => row.year === YEAR && row.sourceId === SOURCE_ID);
  assert(existingRows.length === 996, `Expected 996 existing Xinjiang 2025 rank rows, got ${existingRows.length}`);
  const existingByKey = new Map(existingRows.map((row) => [rankKey(row), row]));
  const comparisonDiffs = [];
  for (const row of positiveRows) {
    const existing = existingByKey.get(rankKey(row));
    if (!existing
      || Number(existing.sameRankScore) !== row.people
      || Number(existing.rankEnd) !== row.cumulative
      || Number(existing.rankStart) !== row.cumulative - row.people + 1) {
      comparisonDiffs.push({ row, existing: existing || null });
    }
  }
  const positiveKeys = new Set(positiveRows.map(rankKey));
  const extraExisting = existingRows.filter((row) => !positiveKeys.has(rankKey(row)));
  assert(comparisonDiffs.length === 0 && extraExisting.length === 0, "Existing Sohu rows differ from independent GK100 table");

  const policyText = cleanHtmlText(policyBytes.toString("utf8"));
  const controlText = cleanHtmlText(controlHtmlBytes.toString("utf8"));
  assert(policyText.includes("同一科类考生按高考总分（含政策加分）从高分到低分排序"), "Official policy-bonus filing rule is missing");
  assert(policyText.includes("文史类按语文、文科综合、数学、外语排序"), "Official liberal-arts tie-break rule is missing");
  assert(policyText.includes("理工类按数学、理科综合、语文、外语排序"), "Official science tie-break rule is missing");
  assert(controlText.includes("新疆2025年普通高校招生各批次最低投档控制分数线确定"), "Official control-line title is missing");
  assert(controlHtmlBytes.toString("utf8").includes("/upload/resources/image/2025/06/25/29511.jpg"), "Official control-line image URL is missing");

  const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === SOURCE_ID);
  assert(sourceNote?.htmlSha256 === "9cfad1b8cdba04cab2eea6c7a6659a478e4682bc683f2c7cb13763228cdeba48", "Existing Sohu evidence hash drifted");
  const topBySubject = new Map(SUBJECTS.map((subjectType) => [
    subjectType,
    Math.max(...existingRows.filter((row) => row.subjectType === subjectType).map((row) => Number(row.score))),
  ]));
  const isUnrankedOrdinarySubject = (record) => (
    Number(record.year) === YEAR
    && SUBJECTS.includes(record.subjectType)
    && Number.isInteger(Number(record.minScore))
    && !Number(record.minRankEnd || record.minRank)
  );
  const unrankedOrdinarySubjectRecords = shard.records.filter(isUnrankedOrdinarySubject);
  assert(unrankedOrdinarySubjectRecords.length === 4234, "Unranked Xinjiang 2025 ordinary-subject count drifted");

  const officialFilingRows = unrankedOrdinarySubjectRecords.filter((row) => OFFICIAL_FILING_SOURCE_IDS.has(row.sourceId));
  assert(officialFilingRows.length === 2302, "Official Xinjiang 2025 filing-row count drifted");
  const zeroCandidateConflicts = officialFilingRows.filter((row) => (
    Number(row.minScore) <= topBySubject.get(row.subjectType)
    && !positiveKeys.has(rankKey({ subjectType: row.subjectType, score: Number(row.minScore) }))
  ));
  assert(zeroCandidateConflicts.length === 9, `Expected 9 official filing conflicts, got ${zeroCandidateConflicts.length}`);
  assert(zeroCandidateConflicts.every((row) => row.tieBreakScores?.totalScore === row.minScore), "Conflict rows do not preserve official total-score tie breakers");

  const allNonSpecialZeroCandidateRecords = unrankedOrdinarySubjectRecords.filter((row) => (
    row.formalScoreScope !== "special-path-only"
    && Number(row.minScore) <= topBySubject.get(row.subjectType)
    && !positiveKeys.has(rankKey({ subjectType: row.subjectType, score: Number(row.minScore) }))
  ));
  assert(allNonSpecialZeroCandidateRecords.length === 19, "All-source zero-candidate conflict count drifted");

  const generatedAt = new Date().toISOString();
  const audit = {
    dataset: "xinjiang-rank-score-basis-audit-2025-v3326",
    generatedAt,
    province: PROVINCE,
    year: YEAR,
    sourceId: SOURCE_ID,
    evidenceId: EVIDENCE_ID,
    modelVersion: core.modelVersion,
    evidence: {
      existingSohu: {
        url: sourceNote.url,
        htmlBytes: sourceNote.htmlBytes,
        htmlSha256: sourceNote.htmlSha256,
      },
      independentGk100: {
        url: "https://www.gk100.com/read_58631558.htm",
        htmlBytes: gk100Bytes.byteLength,
        htmlSha256: sha256(gk100Bytes),
      },
      officialPolicy: {
        url: "https://www.xjzk.gov.cn/c/2025-05-16/494130.shtml",
        htmlBytes: policyBytes.byteLength,
        htmlSha256: sha256(policyBytes),
      },
      officialControlLines: {
        url: "https://www.xjzk.gov.cn/c/2025-06-25/494441.shtml",
        imageUrl: "https://www.xjzk.gov.cn/upload/resources/image/2025/06/25/29511.jpg",
        htmlBytes: controlHtmlBytes.byteLength,
        htmlSha256: sha256(controlHtmlBytes),
        imageBytes: controlImageBytes.byteLength,
        imageSha256: sha256(controlImageBytes),
      },
    },
    mirrorComparison: {
      gk100Rows: gk100Rows.length,
      positiveRows: positiveRows.length,
      zeroRows: gk100Rows.length - positiveRows.length,
      existingRows: existingRows.length,
      exactPositiveMatches: positiveRows.length,
      valueDiffs: comparisonDiffs.length,
      missingFromExisting: 0,
      extraExisting: extraExisting.length,
      subjects: SUBJECTS.map((subjectType) => summarize(gk100Rows, subjectType)),
    },
    scoreBasisAudit: {
      rankTableScoreBasis: "gaokao-cultural-total-policy-bonus-unspecified",
      officialFilingScoreBasis: "gaokao-filing-total-including-policy-bonus",
      rankPolicyBonusIncluded: null,
      officialFilingPolicyBonusIncluded: true,
      automaticAdmissionScoreAlignmentAllowed: false,
      unrankedOrdinarySubjectRecords: unrankedOrdinarySubjectRecords.length,
      officialFilingRecords: officialFilingRows.length,
      officialZeroCandidateConflicts: zeroCandidateConflicts.length,
      allSourceZeroCandidateConflicts: allNonSpecialZeroCandidateRecords.length,
      conflictRecords: zeroCandidateConflicts.map((row) => ({
        id: row.id,
        subjectType: row.subjectType,
        schoolName: row.schoolName,
        minScore: row.minScore,
        scoreMetric: row.scoreMetric,
        tieBreakTotalScore: row.tieBreakScores.totalScore,
        sourceId: row.sourceId,
      })),
      conclusion: "The 996 published rank values are independently reproduced, but the mirror does not state the policy-bonus basis and nine official policy-bonus-inclusive filing rows land on scores with zero candidates in that distribution. Automatic score-to-admission-rank alignment is blocked.",
    },
    sourceNotes: [{
      id: EVIDENCE_ID,
      title: "新疆2025普通文理一分一段独立复核与投档分口径冲突审计",
      publisher: "新疆教育考试院（政策与投档口径）/高考100与搜狐（两份完整分段镜像）",
      url: "https://www.xjzk.gov.cn/c/2025-05-16/494130.shtml",
      relatedUrls: [
        "https://www.xjzk.gov.cn/c/2025-06-25/494441.shtml",
        "https://www.gk100.com/read_58631558.htm",
        sourceNote.url,
      ],
      quality: "official-policy-plus-two-independent-complete-rank-mirrors-score-basis-conflict-audited",
      usage: "996个正人数分数档在两份完整镜像间逐行零差异；官方规定平行志愿按含政策加分总分投档，但9条官方本科一批最低投档排序分落在镜像表0人分数档，因此保留分段表供考生位次查询，不把它自动套到院校投档/录取最低分。",
      province: PROVINCE,
      year: YEAR,
      parsedRecords: positiveRows.length,
      scoreBasis: "gaokao-cultural-total-policy-bonus-unspecified",
      rankPolicyBonusIncluded: null,
      automaticAdmissionScoreAlignmentAllowed: false,
      alignmentBlockReason: "官方含政策加分投档排序分与镜像分段表存在9个0人分数冲突，政策加分口径未闭合。",
      audit: {
        exactPositiveMatches: positiveRows.length,
        zeroRows: gk100Rows.length - positiveRows.length,
        officialZeroCandidateConflicts: zeroCandidateConflicts.length,
        blockedAdmissionRecords: unrankedOrdinarySubjectRecords.length,
      },
    }],
  };

  const out = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    output: path.relative(PROJECT_ROOT, out),
    positiveRows: positiveRows.length,
    exactPositiveMatches: positiveRows.length,
    officialZeroCandidateConflicts: zeroCandidateConflicts.length,
    blockedAdmissionRecords: unrankedOrdinarySubjectRecords.length,
  }, null, 2));
}

main();
