#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RELEASE_DIR = "site/data/release-v3.275";
const DEFAULT_MANIFEST = "data/admissions/runtime-core-lite-v3313-manifest.json";
const SOURCE_NOTE_FIELDS = [
  "id",
  "title",
  "url",
  "quality",
  "province",
  "year",
  "schedule",
  "ordinaryVocationalStatus",
  "ordinaryVocationalPending",
  "ordinaryVocationalExpectedPublicationAt",
  "ordinaryVocationalCheckedAt",
  "ordinaryVocationalReason",
  "ordinaryVocationalScheduleUrl",
  "ordinaryVocationalReview",
];

function parseArgs(argv) {
  const args = {
    releaseDir: DEFAULT_RELEASE_DIR,
    manifest: DEFAULT_MANIFEST,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--release-dir") args.releaseDir = argv[++index];
    else if (token === "--manifest") args.manifest = argv[++index];
    else if (token === "--help") {
      console.log("Usage: node scripts/build-runtime-core-lite-v3313.mjs [--release-dir PATH] [--manifest PATH]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function writeGzipJsonAtomic(file, value, { pretty = true } = {}) {
  const raw = Buffer.from(`${pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)}\n`);
  const compressed = zlib.gzipSync(raw, { level: 9, mtime: 0 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, compressed);
  fs.renameSync(temporary, file);
  return { raw, compressed };
}

function compactSourceNote(note) {
  return Object.fromEntries(
    SOURCE_NOTE_FIELDS
      .filter((field) => note?.[field] !== undefined)
      .map((field) => [field, note[field]]),
  );
}

const args = parseArgs(process.argv.slice(2));
const releaseDir = path.resolve(projectRoot, args.releaseDir);
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const auditFile = path.resolve(projectRoot, args.manifest);

const fullCore = readGzipJson(coreFile);
const runtimeManifest = readGzipJson(manifestFile);
const fullNotes = fullCore.admissionScoreLayer?.sourceNotes || [];
if (!fullNotes.length) throw new Error("Full runtime core has no source notes");
if (runtimeManifest.modelVersion !== fullCore.modelVersion) throw new Error("Core and runtime manifest model versions differ");

const compactNotes = fullNotes.map(compactSourceNote);
const liteCore = {
  ...fullCore,
  admissionScoreLayer: {
    ...fullCore.admissionScoreLayer,
    sourceNotes: compactNotes,
  },
  browserRuntime: {
    ...(fullCore.browserRuntime || {}),
    profile: "core-lite-v1",
    fullCoreFile: "knowledge-core.json.gz",
    sourceNoteFields: SOURCE_NOTE_FIELDS,
  },
};

const fullRaw = zlib.gunzipSync(fs.readFileSync(coreFile));
const liteWritten = writeGzipJsonAtomic(liteFile, liteCore, { pretty: false });
const reduction = 1 - (liteWritten.raw.byteLength / fullRaw.byteLength);
if (reduction < 0.75) throw new Error(`Core-lite raw reduction is only ${(reduction * 100).toFixed(2)}%`);

runtimeManifest.coreLite = {
  file: "../knowledge-core-lite.json",
  bytes: liteWritten.raw.byteLength,
  sha256: sha256(liteWritten.raw),
  compressedBytes: liteWritten.compressed.byteLength,
  profile: "core-lite-v1",
  sourceNotes: compactNotes.length,
};
runtimeManifest.runtimeProfile = {
  version: "v3.313",
  initialCore: "knowledge-core-lite.json.gz",
  fullEvidenceCore: "knowledge-core.json.gz",
  sourceNoteFields: SOURCE_NOTE_FIELDS,
};
const manifestWritten = writeGzipJsonAtomic(manifestFile, runtimeManifest);

const audit = {
  dataset: "runtime-core-lite-v3313",
  generatedAt: new Date().toISOString(),
  releaseDir: path.relative(projectRoot, releaseDir),
  modelVersion: fullCore.modelVersion,
  profile: "core-lite-v1",
  sourceNotes: {
    full: fullNotes.length,
    lite: compactNotes.length,
    fields: SOURCE_NOTE_FIELDS,
  },
  fullCore: {
    file: path.relative(projectRoot, coreFile),
    bytes: fullRaw.byteLength,
    compressedBytes: fs.statSync(coreFile).size,
    sha256: sha256(fullRaw),
  },
  liteCore: {
    file: path.relative(projectRoot, liteFile),
    bytes: liteWritten.raw.byteLength,
    compressedBytes: liteWritten.compressed.byteLength,
    sha256: sha256(liteWritten.raw),
    rawReductionRate: Number(reduction.toFixed(6)),
  },
  runtimeManifest: {
    file: path.relative(projectRoot, manifestFile),
    bytes: manifestWritten.raw.byteLength,
    compressedBytes: manifestWritten.compressed.byteLength,
    sha256: sha256(manifestWritten.raw),
  },
  boundary: "The full evidence core remains published and unchanged; the browser initial core retains only fields used by the UI.",
};

fs.mkdirSync(path.dirname(auditFile), { recursive: true });
fs.writeFileSync(auditFile, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  modelVersion: audit.modelVersion,
  sourceNotes: audit.sourceNotes.lite,
  fullBytes: audit.fullCore.bytes,
  liteBytes: audit.liteCore.bytes,
  rawReductionRate: audit.liteCore.rawReductionRate,
  liteCompressedBytes: audit.liteCore.compressedBytes,
}, null, 2));
