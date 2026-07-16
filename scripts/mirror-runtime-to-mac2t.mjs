#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_MIRROR_ROOT = "/Volumes/mac_2T/gaokao_zhiyuan_site_runtime";
const mirrorRoot = path.resolve(process.env.GAOKAO_MIRROR_ROOT || DEFAULT_MIRROR_ROOT);
const COPY_FULL_ADMISSIONS = process.env.GAOKAO_MIRROR_FULL_ADMISSIONS === "1";
const COPY_PROVENANCE = process.env.GAOKAO_MIRROR_PROVENANCE === "1" || COPY_FULL_ADMISSIONS;
const COPY_SITE_ASSETS = process.env.GAOKAO_MIRROR_SITE_ASSETS === "1";
const COPY_TOP_DATA = process.env.GAOKAO_MIRROR_TOP_DATA === "1";
const RAW_PROVENANCE_PACKS = [
  "data/admissions/raw/shanxi-2026",
  "data/admissions/raw/qinghai-2026",
  "data/admissions/raw/ningxia-2026",
  "data/admissions/raw/liaoning-2026",
  "data/admissions/raw/jiangsu-2026",
  "data/admissions/raw/heilongjiang-2026",
  "data/admissions/raw/hainan-2026",
  "data/admissions/raw/guizhou-2026",
  "data/admissions/raw/guangxi-2026",
  "data/admissions/raw/gansu-2026",
  "data/admissions/raw/chongqing-2026",
  "data/admissions/raw/shanghai-2026",
  "tmp/official-hubei-control-lines-2026",
  "tmp/official-hubei-rank-2026",
  "data/admissions/raw/official-xizang-vacancy-plans-2025-v3272",
  "data/admissions/raw/official-beijing-rank-conversion-2025-v3271",
  "data/admissions/raw/official-xizang-three-gorges-plan-correction-2026-v3270",
  "data/admissions/raw/official-xizang-military-control-line-2026-v3269",
  "data/admissions/raw/official-xizang-current-notices-2026",
  "data/admissions/raw/official-national-school-admission-2025-v3268-bnu",
  "data/admissions/raw/official-national-school-admission-2024-2025-v3274-szu",
  "data/admissions/raw/official-national-school-admission-2024-v3275-hnu",
  "data/admissions/raw/official-bnu-xizang-2025-school-admission",
  "data/admissions/raw/official-mnnu-xizang-2025-school-admission",
  "data/admissions/raw/official-muc-xizang-2025-school-admission",
  "data/admissions/raw/official-xizang-school-admission-2025-v3157-batch",
  "data/admissions/raw/official-xizang-school-admission-2025-v3158-batch",
  "data/admissions/raw/official-xizang-school-admission-2025-v3159-batch",
  "data/admissions/raw/official-xizang-school-admission-2025-v3160-batch",
  "data/admissions/raw/official-xizang-school-admission-2025-v3161-sicau",
  "data/admissions/raw/official-xizang-school-admission-2025-v3162-tgu",
  "data/admissions/raw/official-xizang-school-admission-2026-guide-v3163-xmu",
  "data/admissions/raw/official-xizang-school-admission-2025-v3164-ncut",
  "data/admissions/raw/official-xizang-school-admission-2025-v3181-cpu",
  "data/admissions/raw/official-national-school-plan-score-2023-2026-v3187-njust",
  "data/admissions/raw/official-national-school-admission-2018-2025-v3186-whut",
  "data/admissions/raw/official-national-school-admission-2024-2025-v3185-hust",
  "data/admissions/raw/official-national-school-admission-2024-2025-v3184-zju",
  "data/admissions/raw/official-national-school-admission-2024-2025-v3183-fudan",
  "data/admissions/raw/official-national-school-admission-2024-2025-v3182-hit",
  "data/admissions/raw/official-national-school-admission-2025-v3165-ncut",
  "data/admissions/raw/official-national-school-admission-2024-v3166-ncut",
  "data/admissions/raw/official-national-school-admission-2023-v3167-ncut",
  "data/admissions/raw/official-national-school-admission-2022-v3168-ncut",
  "data/admissions/raw/official-national-school-admission-2021-v3169-ncut",
  "data/admissions/raw/official-national-school-admission-2020-v3170-ncut",
  "data/admissions/raw/official-national-school-admission-2019-v3171-ncut",
  "data/admissions/raw/official-national-school-admission-2018-v3172-ncut",
  "data/admissions/raw/official-national-school-admission-2017-v3173-ncut",
  "data/admissions/raw/official-national-school-admission-2016-v3174-ncut",
  "data/admissions/raw/official-national-school-admission-2015-v3175-ncut",
  "data/admissions/raw/official-national-school-admission-2014-v3178-ncut",
  "data/admissions/raw/official-national-school-admission-2013-v3176-ncut",
  "data/admissions/raw/official-national-school-admission-2012-v3179-ncut",
  "data/admissions/raw/official-national-school-admission-2011-v3177-ncut",
  "data/admissions/raw/official-national-school-admission-2010-v3180-ncut",
  "data/admissions/raw/eol-jilin-rank-2023",
  "data/admissions/raw/official-jilin-filing-2019",
  "data/admissions/raw/official-jilin-rank-2021",
  "data/admissions/raw/official-jilin-rank-2022",
  "data/admissions/raw/gk100-jilin-vocational-2025",
  "data/admissions/raw/gk100-xinjiang-rank-2026",
];
const IMPORT_SCRIPTS = [
  "scripts/mirror-runtime-to-mac2t.mjs",
  "scripts/build-official-shanxi-control-lines-2026-v3303.mjs",
  "scripts/apply-official-shanxi-control-lines-2026-v3303.mjs",
  "scripts/test-official-shanxi-control-lines-v3303.mjs",
  "scripts/audit-official-control-line-coverage-v3303.mjs",
  "scripts/build-official-qinghai-control-lines-2026-v3302.mjs",
  "scripts/apply-official-qinghai-control-lines-2026-v3302.mjs",
  "scripts/test-official-qinghai-control-lines-v3302.mjs",
  "scripts/audit-official-control-line-coverage-v3302.mjs",
  "scripts/build-official-ningxia-control-lines-2026-v3301.mjs",
  "scripts/apply-official-ningxia-control-lines-2026-v3301.mjs",
  "scripts/test-official-ningxia-control-lines-v3301.mjs",
  "scripts/audit-official-control-line-coverage-v3301.mjs",
  "scripts/build-official-liaoning-control-lines-2026-v3300.mjs",
  "scripts/apply-official-liaoning-control-lines-2026-v3300.mjs",
  "scripts/test-official-liaoning-control-lines-v3300.mjs",
  "scripts/audit-official-control-line-coverage-v3300.mjs",
  "scripts/build-official-jiangsu-control-lines-2026-v3299.mjs",
  "scripts/apply-official-jiangsu-control-lines-2026-v3299.mjs",
  "scripts/test-official-jiangsu-control-lines-v3299.mjs",
  "scripts/audit-official-control-line-coverage-v3299.mjs",
  "scripts/build-official-heilongjiang-control-lines-2026-v3298.mjs",
  "scripts/apply-official-heilongjiang-control-lines-2026-v3298.mjs",
  "scripts/test-official-heilongjiang-control-lines-v3298.mjs",
  "scripts/audit-official-control-line-coverage-v3298.mjs",
  "scripts/build-official-hainan-control-lines-2026-v3297.mjs",
  "scripts/apply-official-hainan-control-lines-2026-v3297.mjs",
  "scripts/test-official-hainan-control-lines-v3297.mjs",
  "scripts/audit-official-control-line-coverage-v3297.mjs",
  "scripts/build-official-guizhou-control-lines-2026-v3296.mjs",
  "scripts/apply-official-guizhou-control-lines-2026-v3296.mjs",
  "scripts/test-official-guizhou-control-lines-v3296.mjs",
  "scripts/audit-official-control-line-coverage-v3296.mjs",
  "scripts/build-official-guangxi-control-lines-2026-v3295.mjs",
  "scripts/apply-official-guangxi-control-lines-2026-v3295.mjs",
  "scripts/test-official-guangxi-control-lines-v3295.mjs",
  "scripts/audit-official-control-line-coverage-v3295.mjs",
  "scripts/build-official-gansu-control-lines-2026-v3294.mjs",
  "scripts/apply-official-gansu-control-lines-2026-v3294.mjs",
  "scripts/test-official-gansu-control-lines-v3294.mjs",
  "scripts/audit-official-control-line-coverage-v3294.mjs",
  "scripts/build-official-chongqing-control-lines-2026-v3293.mjs",
  "scripts/apply-official-chongqing-control-lines-2026-v3293.mjs",
  "scripts/test-official-chongqing-control-lines-v3293.mjs",
  "scripts/audit-official-control-line-coverage-v3293.mjs",
  "scripts/build-official-shanghai-control-lines-2026-v3292.mjs",
  "scripts/apply-official-shanghai-control-lines-2026-v3292.mjs",
  "scripts/test-official-shanghai-control-lines-v3292.mjs",
  "scripts/audit-official-control-line-coverage-v3292.mjs",
  "scripts/build-official-hubei-control-lines-2026-v3291.mjs",
  "scripts/apply-official-hubei-control-lines-2026-v3291.mjs",
  "scripts/test-official-hubei-control-lines-v3291.mjs",
  "scripts/audit-official-control-line-coverage-v3291.mjs",
  "scripts/build.mjs",
  "scripts/build-browser-runtime-shards.mjs",
  "scripts/admission-payload-records.mjs",
  "scripts/import-official-xizang-vacancy-plans-2025-v3272.mjs",
  "scripts/merge-official-xizang-vacancy-plans-2025-v3272.jq",
  "scripts/refresh-xizang-vacancy-records-v3272.mjs",
  "scripts/test-refresh-xizang-vacancy-records-v3272.mjs",
  "scripts/test-official-xizang-vacancy-import-v3272.mjs",
  "scripts/test-browser-runtime-shards-v3272.mjs",
  "scripts/test-recommendation-boundaries-v3272.mjs",
  "scripts/repair-official-beijing-rank-quality-v3271.mjs",
  "scripts/import-official-beijing-rank-conversion-2025-v3271.mjs",
  "scripts/merge-official-beijing-rank-conversion-2025-v3271.jq",
  "scripts/test-browser-runtime-shards-v3271.mjs",
  "scripts/test-recommendation-boundaries-v3271.mjs",
  "scripts/import-official-xizang-three-gorges-plan-correction-2026-v3270.mjs",
  "scripts/merge-official-xizang-three-gorges-plan-correction-2026-v3270.jq",
  "scripts/test-browser-runtime-shards-v3270.mjs",
  "scripts/test-recommendation-boundaries-v3270.mjs",
  "scripts/import-official-xizang-military-control-line-2026-v3269.mjs",
  "scripts/merge-official-xizang-military-control-line-2026-v3269.jq",
  "scripts/test-browser-runtime-shards-v3269.mjs",
  "scripts/test-recommendation-boundaries-v3269.mjs",
  "scripts/import-official-xizang-current-notices-2026.mjs",
  "scripts/test-browser-runtime-shards-v3268.mjs",
  "scripts/import-official-national-school-admission-2025-v3268-bnu.mjs",
  "scripts/import-official-national-school-admission-2024-2025-v3274-szu.mjs",
  "scripts/test-official-szu-import-v3274.mjs",
  "scripts/test-szu-recommendation-boundaries-v3274.mjs",
  "scripts/import-official-national-school-admission-2024-v3275-hnu.mjs",
  "scripts/test-official-hnu-import-v3275.mjs",
  "scripts/test-browser-runtime-shards-v3274.mjs",
  "scripts/refresh-province-readiness.jq",
  "scripts/merge-official-national-school-admission-2025-v3268-bnu.jq",
  "scripts/test-recommendation-boundaries-v3268.mjs",
  "scripts/serve.mjs",
  "scripts/import-official-bnu-xizang-2025-school-admission.mjs",
  "scripts/import-official-mnnu-xizang-2025-school-admission.mjs",
  "scripts/import-official-muc-xizang-2025-school-admission.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3157-batch.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3158-batch.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3159-batch.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3160-batch.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3161-sicau.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3162-tgu.mjs",
  "scripts/import-official-xizang-school-admission-2026-guide-v3163-xmu.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3164-ncut.mjs",
  "scripts/import-official-xizang-school-admission-2025-v3181-cpu.mjs",
  "scripts/import-official-national-school-plan-score-2023-2026-v3187-njust.mjs",
  "scripts/import-official-national-school-admission-2018-2025-v3186-whut.mjs",
  "scripts/import-official-national-school-admission-2024-2025-v3185-hust.mjs",
  "scripts/import-official-national-school-admission-2024-2025-v3184-zju.mjs",
  "scripts/import-official-national-school-admission-2024-2025-v3183-fudan.mjs",
  "scripts/import-official-national-school-admission-2024-2025-v3182-hit.mjs",
  "scripts/import-official-national-school-admission-2025-v3165-ncut.mjs",
  "scripts/import-official-national-school-admission-2024-v3166-ncut.mjs",
  "scripts/import-official-national-school-admission-2023-v3167-ncut.mjs",
  "scripts/import-official-national-school-admission-2022-v3168-ncut.mjs",
  "scripts/import-official-national-school-admission-2021-v3169-ncut.mjs",
  "scripts/import-official-national-school-admission-2020-v3170-ncut.mjs",
  "scripts/import-official-national-school-admission-2019-v3171-ncut.mjs",
  "scripts/import-official-national-school-admission-2018-v3172-ncut.mjs",
  "scripts/import-official-national-school-admission-2017-v3173-ncut.mjs",
  "scripts/import-official-national-school-admission-2016-v3174-ncut.mjs",
  "scripts/import-official-national-school-admission-2015-v3175-ncut.mjs",
  "scripts/import-official-national-school-admission-2014-v3178-ncut.mjs",
  "scripts/import-official-national-school-admission-2013-v3176-ncut.mjs",
  "scripts/import-official-national-school-admission-2012-v3179-ncut.mjs",
  "scripts/import-official-national-school-admission-2011-v3177-ncut.mjs",
  "scripts/import-official-national-school-admission-2010-v3180-ncut.mjs",
  "scripts/import-eol-jilin-rank-conversion-2023.mjs",
  "scripts/import-official-jilin-filing-2019.mjs",
  "scripts/import-official-jilin-rank-conversion-2021.mjs",
  "scripts/import-official-jilin-rank-conversion-2022.mjs",
  "scripts/import-gk100-jilin-vocational-2025.mjs",
  "scripts/import-gk100-xinjiang-rank-conversion-2026.mjs",
  "scripts/vision-grid-cell-ocr.swift",
  "scripts/vision-table-row-ocr.swift",
];
const TARGETED_ADMISSION_IMPORTS = [
  "data/admissions/evidence-v3303-shanxi-2026-manifest.json",
  "data/admissions/official-shanxi-control-lines-2026-import.json",
  "data/admissions/official-shanxi-control-lines-2026-v3303-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3303.json",
  "data/admissions/evidence-v3302-qinghai-2026-manifest.json",
  "data/admissions/official-qinghai-control-lines-2026-import.json",
  "data/admissions/official-qinghai-control-lines-2026-v3302-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3302.json",
  "data/admissions/evidence-v3301-ningxia-2026-manifest.json",
  "data/admissions/official-ningxia-control-lines-2026-import.json",
  "data/admissions/official-ningxia-control-lines-2026-v3301-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3301.json",
  "data/admissions/evidence-v3300-liaoning-2026-manifest.json",
  "data/admissions/official-liaoning-control-lines-2026-import.json",
  "data/admissions/official-liaoning-control-lines-2026-v3300-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3300.json",
  "data/admissions/evidence-v3299-jiangsu-2026-manifest.json",
  "data/admissions/official-jiangsu-control-lines-2026-import.json",
  "data/admissions/official-jiangsu-control-lines-2026-v3299-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3299.json",
  "data/admissions/evidence-v3298-heilongjiang-2026-manifest.json",
  "data/admissions/official-heilongjiang-control-lines-2026-import.json",
  "data/admissions/official-heilongjiang-control-lines-2026-v3298-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3298.json",
  "data/admissions/evidence-v3297-hainan-2026-manifest.json",
  "data/admissions/official-hainan-control-lines-2026-import.json",
  "data/admissions/official-hainan-control-lines-2026-v3297-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3297.json",
  "data/admissions/evidence-v3296-guizhou-2026-manifest.json",
  "data/admissions/official-guizhou-control-lines-2026-import.json",
  "data/admissions/official-guizhou-control-lines-2026-v3296-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3296.json",
  "data/admissions/evidence-v3295-guangxi-2026-manifest.json",
  "data/admissions/official-guangxi-control-lines-2026-import.json",
  "data/admissions/official-guangxi-control-lines-2026-v3295-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3295.json",
  "data/admissions/evidence-v3294-gansu-2026-manifest.json",
  "data/admissions/official-gansu-control-lines-2026-import.json",
  "data/admissions/official-gansu-control-lines-2026-v3294-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3294.json",
  "data/admissions/evidence-v3293-chongqing-2026-manifest.json",
  "data/admissions/official-chongqing-control-lines-2026-import.json",
  "data/admissions/official-chongqing-control-lines-2026-v3293-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3293.json",
  "data/admissions/evidence-v3292-shanghai-2026-manifest.json",
  "data/admissions/official-shanghai-control-lines-2026-import.json",
  "data/admissions/official-shanghai-control-lines-2026-v3292-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3292.json",
  "data/admissions/official-hubei-control-lines-2026-import.json",
  "data/admissions/official-hubei-control-lines-2026-v3291-runtime-manifest.json",
  "data/admissions/official-control-line-coverage-2026-v3291.json",
  "data/admissions/official-xizang-vacancy-plans-2025-v3272-runtime-manifest.json",
  "data/admissions/official-xizang-vacancy-plans-2025-v3272-import.json",
  "data/admissions/official-beijing-rank-conversion-2025-v3271-runtime-manifest.json",
  "data/admissions/official-beijing-rank-conversion-2025-v3271-import.json",
  "data/admissions/official-xizang-three-gorges-plan-correction-2026-v3270-runtime-manifest.json",
  "data/admissions/official-xizang-three-gorges-plan-correction-2026-v3270-import.json",
  "data/admissions/official-xizang-military-control-line-2026-v3269-runtime-manifest.json",
  "data/admissions/official-xizang-military-control-line-2026-v3269-import.json",
  "data/admissions/official-xizang-current-notices-2026-import.json",
  "data/admissions/official-national-school-admission-2025-v3268-bnu-runtime-manifest.json",
  "data/admissions/official-national-school-admission-2025-v3268-bnu-import.json",
  "data/admissions/official-national-school-admission-2024-2025-v3274-szu-import.json",
  "data/admissions/official-national-school-admission-2024-v3275-hnu-import.json",
  "data/admissions/official-national-school-plan-score-2023-2026-v3187-njust-import.json",
  "data/admissions/official-national-school-admission-2018-2025-v3186-whut-import.json",
  "data/admissions/official-national-school-admission-2024-2025-v3185-hust-import.json",
  "data/admissions/official-national-school-admission-2024-2025-v3184-zju-import.json",
  "data/admissions/official-national-school-admission-2024-2025-v3183-fudan-import.json",
  "data/admissions/official-national-school-admission-2024-2025-v3182-hit-import.json",
  "data/admissions/official-national-school-admission-2025-v3165-ncut-import.json",
  "data/admissions/official-national-school-admission-2024-v3166-ncut-import.json",
  "data/admissions/official-national-school-admission-2023-v3167-ncut-import.json",
  "data/admissions/official-national-school-admission-2022-v3168-ncut-import.json",
  "data/admissions/official-national-school-admission-2021-v3169-ncut-import.json",
  "data/admissions/official-national-school-admission-2020-v3170-ncut-import.json",
  "data/admissions/official-national-school-admission-2019-v3171-ncut-import.json",
  "data/admissions/official-national-school-admission-2018-v3172-ncut-import.json",
  "data/admissions/official-national-school-admission-2017-v3173-ncut-import.json",
  "data/admissions/official-national-school-admission-2016-v3174-ncut-import.json",
  "data/admissions/official-national-school-admission-2015-v3175-ncut-import.json",
  "data/admissions/official-national-school-admission-2014-v3178-ncut-import.json",
  "data/admissions/official-national-school-admission-2013-v3176-ncut-import.json",
  "data/admissions/official-national-school-admission-2012-v3179-ncut-import.json",
  "data/admissions/official-national-school-admission-2011-v3177-ncut-import.json",
  "data/admissions/official-national-school-admission-2010-v3180-ncut-import.json",
  "data/admissions/official-xizang-school-admission-2025-v3164-ncut-import.json",
  "data/admissions/official-xizang-school-admission-2025-v3181-cpu-import.json",
];

function copyFile(src, dest, options = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!options.force && fs.existsSync(dest)) {
    const sourceStat = fs.statSync(src);
    const destStat = fs.statSync(dest);
    if (destStat.isFile() && sourceStat.size === destStat.size && destStat.mtimeMs >= sourceStat.mtimeMs) {
      return false;
    }
  }
  const temp = `${dest}.tmp-${process.pid}`;
  fs.rmSync(temp, { force: true });
  try {
    fs.copyFileSync(src, temp);
    fs.renameSync(temp, dest);
  } finally {
    fs.rmSync(temp, { force: true });
  }
  return true;
}

function copyDir(src, dest, options = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (options.skip?.(entry)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to, options);
    else if (entry.isFile()) copyFile(from, to);
  }
}

function removeAppleDouble(root) {
  if (!fs.existsSync(root)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.name.startsWith("._")) {
      fs.rmSync(target, { recursive: entry.isDirectory(), force: true });
      removed += 1;
    } else if (entry.isDirectory()) {
      removed += removeAppleDouble(target);
    }
  }
  return removed;
}

function removeStaleDoubleJson(root) {
  if (!fs.existsSync(root)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json.json")) continue;
    fs.rmSync(path.join(root, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

function readKnowledgeSummary(file) {
  const query = [
    "{",
    "modelVersion:.modelPolicy.version,",
    "rounds:(.rounds // [] | length),",
    "structuredRecords:.admissionScoreLayer.structuredRecords,",
    "coverage:{",
    "provinces:.admissionScoreLayer.coverage.provinces,",
    "years:.admissionScoreLayer.coverage.years,",
    "schools:.admissionScoreLayer.coverage.schools,",
    "formalScoreMissingProvinces:.admissionScoreLayer.coverage.formalScoreMissingProvinces",
    "}",
    "}",
  ].join("");
  const result = spawnSync("jq", ["-c", query, file], {
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([
      `jq failed to summarize ${file} with status ${result.status}`,
      result.stderr?.trim(),
    ].filter(Boolean).join("\n"));
  }
  return JSON.parse(result.stdout);
}

function readGzipKnowledgeSummary(file) {
  const knowledge = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  return {
    modelVersion: knowledge.modelVersion || knowledge.modelPolicy?.version || "",
    rounds: Array.isArray(knowledge.rounds) ? knowledge.rounds.length : 0,
    structuredRecords: Number(knowledge.admissionScoreLayer?.structuredRecords || 0),
    coverage: {
      provinces: knowledge.admissionScoreLayer?.coverage?.provinces || [],
      years: knowledge.admissionScoreLayer?.coverage?.years || [],
      schools: knowledge.admissionScoreLayer?.coverage?.schools || [],
      formalScoreMissingProvinces: knowledge.admissionScoreLayer?.coverage?.formalScoreMissingProvinces || [],
    },
  };
}

function main() {
  if (!fs.existsSync("/Volumes/mac_2T")) {
    throw new Error("/Volumes/mac_2T is not mounted; refusing to create an alternate mirror path.");
  }
  fs.mkdirSync(mirrorRoot, { recursive: true });

  const fullKnowledgeFile = path.join(PROJECT_ROOT, "site", "data", "knowledge.json");
  const browserCoreFile = path.join(PROJECT_ROOT, "site", "data", "knowledge-core.json");
  const browserProvinceDir = path.join(PROJECT_ROOT, "site", "data", "provinces");
  const runtimeReleaseDir = path.join(PROJECT_ROOT, "site", "data", "release-v3.275");
  const runtimeReleaseCoreFile = path.join(runtimeReleaseDir, "knowledge-core.json.gz");
  const runtimeReleaseManifestFile = path.join(runtimeReleaseDir, "manifest.json.gz");
  if (!fs.existsSync(runtimeReleaseCoreFile) || !fs.existsSync(runtimeReleaseManifestFile)) {
    throw new Error("The authoritative gzip runtime release is incomplete.");
  }
  const summaryFile = fs.existsSync(fullKnowledgeFile)
    ? fullKnowledgeFile
    : fs.existsSync(browserCoreFile)
      ? browserCoreFile
      : runtimeReleaseCoreFile;
  const knowledge = summaryFile.endsWith(".gz") ? readGzipKnowledgeSummary(summaryFile) : readKnowledgeSummary(summaryFile);
  const copied = [];
  const copy = (relative, options = {}) => {
    const didCopy = copyFile(path.join(PROJECT_ROOT, relative), path.join(mirrorRoot, relative), options);
    copied.push(didCopy ? relative : `${relative} (unchanged, skipped)`);
  };

  copy("site/index.html");
  copyDir(runtimeReleaseDir, path.join(mirrorRoot, "site", "data", "release-v3.275"));
  copied.push("site/data/release-v3.275/ (gzip core, manifest and 31 province shards)");
  if (fs.existsSync(fullKnowledgeFile)) copy("site/data/knowledge.json");
  else {
    const staleMirrorMaster = path.join(mirrorRoot, "site/data/knowledge.json");
    if (fs.existsSync(staleMirrorMaster)) fs.rmSync(staleMirrorMaster, { force: true });
    copied.push("site/data/knowledge.json absent and stale mirror removed; browser runtime uses the lighter core plus 31 province shards");
  }
  if (fs.existsSync(browserCoreFile)) copy("site/data/knowledge-core.json");
  else {
    const staleMirrorCore = path.join(mirrorRoot, "site/data/knowledge-core.json");
    if (fs.existsSync(staleMirrorCore)) fs.rmSync(staleMirrorCore, { force: true });
    copied.push("site/data/knowledge-core.json absent and stale mirror removed; gzip runtime core is authoritative");
  }
  const mirrorProvinceDir = path.join(mirrorRoot, "site/data/provinces");
  let removedStaleDoubleJson = 0;
  if (fs.existsSync(browserProvinceDir)) {
    copyDir(browserProvinceDir, mirrorProvinceDir);
    removedStaleDoubleJson = removeStaleDoubleJson(mirrorProvinceDir);
    copied.push("site/data/provinces/ (decompressed compatibility shards)");
    copied.push(`stale duplicate shard cleanup: removed ${removedStaleDoubleJson} *.json.json files`);
  } else {
    if (fs.existsSync(mirrorProvinceDir)) fs.rmSync(mirrorProvinceDir, { recursive: true, force: true });
    copied.push("site/data/provinces absent and stale mirror removed; gzip runtime shards are authoritative");
  }
  if (COPY_SITE_ASSETS) {
    copyDir(path.join(PROJECT_ROOT, "site", "assets"), path.join(mirrorRoot, "site", "assets"));
    copied.push("site/assets/");
  } else {
    copied.push("site/assets/ skipped by default; scripts/serve.mjs serves assets from the internal APFS site/ directory");
  }
  if (COPY_TOP_DATA) {
    copy("data/knowledge.json");
  } else {
    const staleMirrorTopData = path.join(mirrorRoot, "data/knowledge.json");
    if (fs.existsSync(staleMirrorTopData)) fs.rmSync(staleMirrorTopData, { force: true });
    copied.push("data/knowledge.json skipped by default and stale mirror removed; runtime uses the lighter core plus 31 province shards");
  }
  copy("data/manifest.json");
  copy("README.md");
  copy("docs/extraction-report.md");
  copy("docs/github-storage.md");
  copy("docs/references/admission-data-layer.md");
  copy("docs/references/national-data-roadmap.md");
  copy("ROADMAP.md");
  copy("docs/changes/v3272-xizang-vacancy-plans-2025.md");
  copy("docs/change-manifests/v3272-xizang-vacancy-plans-2025.yaml");
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/completion-reports/v3272-xizang-vacancy-plans-2025.md"))) {
    copy("docs/completion-reports/v3272-xizang-vacancy-plans-2025.md");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3273-xizang-full-plan-2026.md"))) {
    copy("docs/changes/v3273-xizang-full-plan-2026.md");
    copy("docs/change-manifests/v3273-xizang-full-plan-2026.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/completion-reports/v3273-xizang-plan-path-safety.md"))) {
    copy("docs/completion-reports/v3273-xizang-plan-path-safety.md");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3274-szu-national-admission-2024-2025.md"))) {
    copy("docs/changes/v3274-szu-national-admission-2024-2025.md");
    copy("docs/change-manifests/v3274-szu-national-admission-2024-2025.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/completion-reports/v3274-szu-national-admission-2024-2025.md"))) {
    copy("docs/completion-reports/v3274-szu-national-admission-2024-2025.md");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.292-shanghai-control-lines-2026.md"))) {
    copy("docs/changes/v3.292-shanghai-control-lines-2026.md");
    copy("docs/change-manifests/v3292-shanghai-control-lines-2026-pending-vocational.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.293-chongqing-control-lines-2026.md"))) {
    copy("docs/changes/v3.293-chongqing-control-lines-2026.md");
    copy("docs/change-manifests/v3293-chongqing-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.294-gansu-control-lines-2026.md"))) {
    copy("docs/changes/v3.294-gansu-control-lines-2026.md");
    copy("docs/change-manifests/v3294-gansu-control-lines-2026-rank-boundary.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.295-guangxi-control-lines-2026.md"))) {
    copy("docs/changes/v3.295-guangxi-control-lines-2026.md");
    copy("docs/change-manifests/v3295-guangxi-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.296-guizhou-control-lines-2026.md"))) {
    copy("docs/changes/v3.296-guizhou-control-lines-2026.md");
    copy("docs/change-manifests/v3296-guizhou-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.297-hainan-control-lines-2026.md"))) {
    copy("docs/changes/v3.297-hainan-control-lines-2026.md");
    copy("docs/change-manifests/v3297-hainan-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.298-heilongjiang-control-lines-2026.md"))) {
    copy("docs/changes/v3.298-heilongjiang-control-lines-2026.md");
    copy("docs/change-manifests/v3298-heilongjiang-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.299-jiangsu-control-lines-2026.md"))) {
    copy("docs/changes/v3.299-jiangsu-control-lines-2026.md");
    copy("docs/change-manifests/v3299-jiangsu-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.300-liaoning-control-lines-2026.md"))) {
    copy("docs/changes/v3.300-liaoning-control-lines-2026.md");
    copy("docs/change-manifests/v3300-liaoning-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.301-ningxia-control-lines-2026.md"))) {
    copy("docs/changes/v3.301-ningxia-control-lines-2026.md");
    copy("docs/change-manifests/v3301-ningxia-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.302-qinghai-control-lines-2026.md"))) {
    copy("docs/changes/v3.302-qinghai-control-lines-2026.md");
    copy("docs/change-manifests/v3302-qinghai-control-lines-2026-rank-provenance.yaml");
  }
  if (fs.existsSync(path.join(PROJECT_ROOT, "docs/changes/v3.303-shanxi-control-lines-2026.md"))) {
    copy("docs/changes/v3.303-shanxi-control-lines-2026.md");
    copy("docs/change-manifests/v3303-shanxi-control-lines-2026-rank-provenance.yaml");
  }
  copy("docs/changes/v3271-beijing-rank-conversion-2025.md");
  copy("docs/change-manifests/v3271-beijing-rank-conversion-2025.yaml");
  copy("docs/completion-reports/v3271-beijing-rank-conversion-2025.md");
  if (COPY_FULL_ADMISSIONS) {
    const admissionMirrorDir = path.join(mirrorRoot, "data", "admissions");
    fs.rmSync(admissionMirrorDir, { recursive: true, force: true });
    copyDir(path.join(PROJECT_ROOT, "data", "admissions"), admissionMirrorDir, {
      skip: (entry) => entry.name.startsWith("._") || entry.name === "raw",
    });
    copied.push("data/admissions/ (full json/source packs; raw HTML cache skipped)");
  } else if (COPY_PROVENANCE) {
    for (const relative of TARGETED_ADMISSION_IMPORTS) {
      if (!fs.existsSync(path.join(PROJECT_ROOT, relative))) continue;
      copy(relative);
    }
    copied.push("data/admissions/ (targeted provenance import JSONs; set GAOKAO_MIRROR_FULL_ADMISSIONS=1 for full copy)");
  } else {
    copied.push("data/admissions/ skipped by default; set GAOKAO_MIRROR_PROVENANCE=1 for targeted provenance copy or GAOKAO_MIRROR_FULL_ADMISSIONS=1 for full copy");
  }
  if (COPY_PROVENANCE) {
    for (const relative of RAW_PROVENANCE_PACKS) {
      const source = path.join(PROJECT_ROOT, relative);
      if (!fs.existsSync(source)) continue;
      copyDir(source, path.join(mirrorRoot, relative), {
        skip: (entry) => entry.name.startsWith("._"),
      });
      copied.push(`${relative}/ (selected raw provenance pack)`);
    }
    for (const relative of IMPORT_SCRIPTS) {
      if (!fs.existsSync(path.join(PROJECT_ROOT, relative))) continue;
      copy(relative);
    }
  } else {
    copied.push("raw provenance packs and import scripts skipped by default to avoid external data/admissions write stalls");
  }

  const removedAppleDouble = removeAppleDouble(mirrorRoot);
  copied.push(`AppleDouble cleanup: removed ${removedAppleDouble} ._* metadata entries`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    mirrorRoot,
    projectRoot: PROJECT_ROOT,
    purpose: "Runtime mirror for the authoritative gzip browser core and 31 on-demand province shards; Node-only targeted copy, no external-disk Python/lxml processing.",
    runtimeMirrorPolicy: COPY_FULL_ADMISSIONS
      ? "Copies site knowledge JSON, docs, full admission JSON/source packs, and explicitly whitelisted raw provenance packs/import scripts. Site assets and top-level data/knowledge.json are opt-in because scripts/serve.mjs reads assets from the internal APFS site/ directory and runtime HTTP data from site/data/knowledge.json. Skips the broad raw HTML cache and removes source-side or ExFAT-created AppleDouble metadata entries."
      : COPY_PROVENANCE
        ? "Copies site knowledge JSON, docs, targeted provenance import JSONs, and explicitly whitelisted raw provenance packs/import scripts only. Site assets and top-level data/knowledge.json are opt-in because scripts/serve.mjs reads assets from the internal APFS site/ directory and runtime HTTP data from site/data/knowledge.json. Full data/admissions copying is disabled by default because external ExFAT/fskit writes can stall; set GAOKAO_MIRROR_FULL_ADMISSIONS=1 for a controlled full copy."
        : "Copies site knowledge JSON and docs only. Site assets and top-level data/knowledge.json are opt-in because scripts/serve.mjs reads assets from the internal APFS site/ directory and runtime HTTP data from site/data/knowledge.json. data/admissions provenance copying is skipped by default because external ExFAT/fskit writes can stall; set GAOKAO_MIRROR_PROVENANCE=1 for targeted provenance copy or GAOKAO_MIRROR_FULL_ADMISSIONS=1 for a controlled full copy.",
    siteData: "site/data/release-v3.275/knowledge-core.json.gz + manifest.json.gz + 31 province gzip shards",
    browserCore: "site/data/release-v3.275/knowledge-core.json.gz",
    browserProvinceShards: "site/data/release-v3.275/*.json.gz",
    admissionData: COPY_FULL_ADMISSIONS ? "data/admissions/ (full copy)" : COPY_PROVENANCE ? "data/admissions/ (targeted provenance copy)" : "skipped by default",
    modelVersion: knowledge.modelVersion || "",
    rounds: knowledge.rounds || 0,
    structuredRecords: knowledge.structuredRecords || 0,
    coverage: knowledge.coverage || {},
    copied,
    removedAppleDouble,
    removedStaleDoubleJson,
  };
  fs.writeFileSync(path.join(mirrorRoot, "mirror-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  const postManifestAppleDouble = removeAppleDouble(mirrorRoot);
  console.log(JSON.stringify({
    ok: true,
    mirrorRoot,
    modelVersion: manifest.modelVersion,
    rounds: manifest.rounds,
    structuredRecords: manifest.structuredRecords,
    provinces: manifest.coverage.provinces?.length || 0,
    schools: manifest.coverage.schools?.length || 0,
    removedAppleDouble: removedAppleDouble + postManifestAppleDouble,
    removedStaleDoubleJson,
    postManifestAppleDouble,
  }, null, 2));
}

main();
