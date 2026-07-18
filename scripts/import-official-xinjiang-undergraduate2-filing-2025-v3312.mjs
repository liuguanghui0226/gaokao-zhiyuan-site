#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TMP_ROOT = path.join(os.homedir(), ".codex", "tmp", "gaokao-xinjiang-undergraduate2-2025-v3312");
const DEFAULT_URL = "https://www.xjzk.gov.cn/c/2025-08-06/494702.shtml";
const DEFAULT_OUT = "data/admissions/official-xinjiang-undergraduate2-filing-2025-v3312-import.json";
const DEFAULT_RAW_REL = "data/admissions/raw/official-xinjiang-undergraduate2-filing-2025-v3312";
const CORRECTIONS_FILE = path.join(PROJECT_ROOT, "data", "admissions", "official-xinjiang-undergraduate2-filing-2025-v3312-corrections.json");
const VISION_HELPER = path.join(PROJECT_ROOT, "scripts", "vision-table-row-ocr.swift");
const YEAR = 2025;
const PROVINCE = "新疆";
const BATCH = "本科二批";
const SOURCE_ID = "official-xinjiang-undergraduate2-filing-2025-v3312";
const IMAGE_SUBJECTS = new Map([
  ["29671", { subjectType: "历史类", originalSubject: "文史" }],
  ["29672", { subjectType: "历史类", originalSubject: "文史" }],
  ["29677", { subjectType: "历史类", originalSubject: "文史" }],
  ["29678", { subjectType: "物理类", originalSubject: "理工" }],
  ["29679", { subjectType: "物理类", originalSubject: "理工" }],
  ["29681", { subjectType: "物理类", originalSubject: "理工" }],
  ["29685", { subjectType: "物理类", originalSubject: "理工" }],
]);
const EXPECTED_IMAGE_AUDIT = new Map([
  ["29671", { width: 1051, height: 8926, rows: 189, sha256: "b720316c91b38318caec0385d9acd5d01f15ba9ca2a559a33efe117b09678999" }],
  ["29672", { width: 1051, height: 8834, rows: 190, sha256: "16785ef782ff2ec5f5282dfef4016a13d3933178c6f95e1c59a3ac382e8f41df" }],
  ["29677", { width: 1051, height: 4462, rows: 93, sha256: "ae82a1929a14fb634de8ef01d8aa853b2ad04df2111db0cfc6f170ecd1c21023" }],
  ["29678", { width: 1051, height: 8926, rows: 189, sha256: "e9f83fc3a5cc04636415026daad5cc5b9243009b32f3b2ace386ad8210abda44" }],
  ["29679", { width: 1051, height: 8834, rows: 190, sha256: "509fffdc895f436d1413cfab16adf180da06a8b322b719f0301565a8ab067c4b" }],
  ["29681", { width: 1051, height: 8834, rows: 190, sha256: "eded465b6a63c6deb352f9757f12fd73f878f3285aae259bdab7c5c6a78cde30" }],
  ["29685", { width: 1051, height: 1792, rows: 35, sha256: "8748c3fd27d14bb1fe45c44abaa2569b510bc19785e4472d9ce454fb08565d6b" }],
]);
const LEGACY_UNDERGRADUATE1_ROW_CORRECTIONS = new Map([
  ["29619|1077", { schoolName: "北京交通大学", planCount: 8, filingCount: 8, maxScore: 555, minScore: 547, avgScore: 550.25, tieBreakScores: { totalScore: 547, chinese: 124, comprehensive: 215, math: 97 } }],
  ["29619|1196", { schoolName: "北京理工大学", planCount: 4, filingCount: 4, maxScore: 582, minScore: 573, avgScore: 577.25, tieBreakScores: { totalScore: 573, chinese: 122, comprehensive: 225, math: 104 } }],
  ["29619|4198", { schoolName: "天津师范大学", planCount: 35, filingCount: 35, maxScore: 524, minScore: 453, avgScore: 476.37, tieBreakScores: { totalScore: 453, chinese: 115, comprehensive: 169, math: 64 } }],
  ["29619|7892", { schoolName: "华东师范大学", planCount: 7, filingCount: 7, maxScore: 578, minScore: 561, avgScore: 568.71, tieBreakScores: { totalScore: 561, chinese: 125, comprehensive: 198, math: 97 } }],
  ["29619|15168", { schoolName: "广州中医药大学", planCount: 4, filingCount: 4, maxScore: 576, minScore: 512, avgScore: 545.25, tieBreakScores: { totalScore: 512, chinese: 121, comprehensive: 204, math: 84 } }],
  ["29619|15284", { schoolName: "华南师范大学", planCount: 17, filingCount: 17, maxScore: 537, minScore: 497, avgScore: 518.82, tieBreakScores: { totalScore: 497, chinese: 108, comprehensive: 235, math: 93 } }],
  ["29619|15400", { schoolName: "海南大学", planCount: 33, filingCount: 33, maxScore: 525, minScore: 500, avgScore: 508.61, tieBreakScores: { totalScore: 500, chinese: 110, comprehensive: 197, math: 80 } }],
  ["29619|15516", { schoolName: "深圳大学", planCount: 3, filingCount: 3, maxScore: 552, minScore: 538, avgScore: 545.67, tieBreakScores: { totalScore: 538, chinese: 114, comprehensive: 216, math: 96 } }],
  ["29619|19211", { schoolName: "上海立信会计金融学院", planCount: 8, filingCount: 8, maxScore: 515, minScore: 507, avgScore: 511.38, tieBreakScores: { totalScore: 507, chinese: 122, comprehensive: 192, math: 89 } }],
  ["29619|19327", { schoolName: "青岛大学", planCount: 10, filingCount: 9, maxScore: 519, minScore: 452, avgScore: 495, tieBreakScores: { totalScore: 452, chinese: 114, comprehensive: 196, math: 63 } }],
  ["29619|2924", { schoolName: "北京体育大学", planCount: 1, filingCount: 1, maxScore: 494, minScore: 494, avgScore: 494, tieBreakScores: { totalScore: 494, chinese: 114, comprehensive: 195, math: 84 } }],
  ["29619|4314", { schoolName: "天津外国语大学", planCount: 28, filingCount: 28, maxScore: 501, minScore: 464, avgScore: 476.18, tieBreakScores: { totalScore: 464, chinese: 112, comprehensive: 157, math: 86 } }],
  ["29619|5584", { schoolName: "大连海事大学", planCount: 7, filingCount: 7, maxScore: 523, minScore: 518, avgScore: 520.71, tieBreakScores: { totalScore: 518, chinese: 125, comprehensive: 210, math: 94 } }],
  ["29619|11010", { schoolName: "浙江师范大学", planCount: 7, filingCount: 7, maxScore: 508, minScore: 476, avgScore: 491.57, tieBreakScores: { totalScore: 476, chinese: 116, comprehensive: 199, math: 68 } }],
  ["29619|11931", { schoolName: "南昌大学", planCount: 16, filingCount: 17, maxScore: 526, minScore: 509, avgScore: 514.65, tieBreakScores: { totalScore: 509, chinese: 121, comprehensive: 220, math: 70 } }],
  ["29619|1657", { schoolName: "中国农业大学", planCount: 7, filingCount: 7, maxScore: 559, minScore: 550, avgScore: 554.43, tieBreakScores: { totalScore: 550, chinese: 129, comprehensive: 211, math: 90 } }],
  ["29619|3043", { schoolName: "中央美术学院", planCount: 1, filingCount: 1, maxScore: 521, minScore: 521, avgScore: 521, tieBreakScores: { totalScore: 521, chinese: 110, comprehensive: 208, math: 78 } }],
  ["29619|9856", { schoolName: "江苏大学", planCount: 5, filingCount: 5, maxScore: 524, minScore: 517, avgScore: 520, tieBreakScores: { totalScore: 517, chinese: 117, comprehensive: 218, math: 88 } }],
  ["29619|11241", { schoolName: "中国美术学院", planCount: 2, filingCount: 2, maxScore: 497, minScore: 497, avgScore: 497, tieBreakScores: { totalScore: 497, chinese: 109, comprehensive: 203, math: 84 } }],
  ["29619|14939", { schoolName: "中山大学", planCount: 6, filingCount: 6, maxScore: 584, minScore: 580, avgScore: 582.67, tieBreakScores: { totalScore: 580, chinese: 130, comprehensive: 226, math: 107 } }],
  ["29619|17480", { schoolName: "西安交通大学", planCount: 5, filingCount: 5, maxScore: 587, minScore: 579, avgScore: 583.8, tieBreakScores: { totalScore: 579, chinese: 127, comprehensive: 224, math: 102 } }],
  ["29619|19559", { schoolName: "三峡大学", planCount: 1, filingCount: 1, maxScore: 486, minScore: 486, avgScore: 486, tieBreakScores: { totalScore: 486, chinese: 115, comprehensive: 216, math: 69 } }],
  ["29619|19672", { schoolName: "广州大学", planCount: 1, filingCount: 1, maxScore: 516, minScore: 516, avgScore: 516, tieBreakScores: { totalScore: 516, chinese: 123, comprehensive: 204, math: 81 } }],
  ["29619|20253", { schoolName: "北京联合大学", planCount: 4, filingCount: 4, maxScore: 505, minScore: 501, avgScore: 503.5, tieBreakScores: { totalScore: 501, chinese: 119, comprehensive: 205, math: 76 } }],
  ["29619|21639", { schoolName: "宁波诺丁汉大学", planCount: 5, filingCount: 1, maxScore: 508, minScore: 508, avgScore: 508, tieBreakScores: { totalScore: 508, chinese: 117, comprehensive: 190, math: 73 } }],
  ["29619|7776", { schoolName: "上海海洋大学", planCount: 28, filingCount: 28, maxScore: 504, minScore: 481, avgScore: 489.04, tieBreakScores: { totalScore: 481, chinese: 111, comprehensive: 204, math: 75 } }],
  ["29619|11821", { schoolName: "福建农林大学", planCount: 9, filingCount: 9, maxScore: 478, minScore: 452, avgScore: 464.11, tieBreakScores: { totalScore: 452, chinese: 114, comprehensive: 181, math: 74 } }],
  ["29619|23137", { schoolName: "东北财经大学", planCount: 2, filingCount: 1, maxScore: 467, minScore: 467, avgScore: 467, tieBreakScores: { totalScore: 467, chinese: 107, comprehensive: 165, math: 72 } }],
  ["29619|8008", { schoolName: "上海师范大学", planCount: 23, filingCount: 23, maxScore: 507, minScore: 475, avgScore: 489.57, tieBreakScores: { totalScore: 475, chinese: 113, comprehensive: 205, math: 83 } }],
  ["29620|1078", { schoolName: "北京交通大学", planCount: 52, filingCount: 52, maxScore: 602, minScore: 585, avgScore: 589.96, tieBreakScores: { totalScore: 585, chinese: 112, comprehensive: 237, math: 115 } }],
  ["29620|3620", { schoolName: "北京体育大学", planCount: 5, filingCount: 5, maxScore: 527, minScore: 502, avgScore: 509.6, tieBreakScores: { totalScore: 502, chinese: 115, comprehensive: 193, math: 95 } }],
  ["29620|5468", { schoolName: "天津财经大学", planCount: 63, filingCount: 63, maxScore: 515, minScore: 453, avgScore: 469.57, tieBreakScores: { totalScore: 453, chinese: 108, comprehensive: 175, math: 95 } }],
  ["29620|15172", { schoolName: "浙江农林大学", planCount: 15, filingCount: 15, maxScore: 482, minScore: 437, avgScore: 448.33, tieBreakScores: { totalScore: 437, chinese: 105, comprehensive: 171, math: 91 } }],
  ["29620|15284", { schoolName: "温州医科大学", planCount: 3, filingCount: 3, maxScore: 536, minScore: 523, avgScore: 528, tieBreakScores: { totalScore: 523, chinese: 110, comprehensive: 231, math: 86 } }],
  ["29620|3736", { schoolName: "中央美术学院", planCount: 1, filingCount: 1, maxScore: 452, minScore: 452, avgScore: 452, tieBreakScores: { totalScore: 452, chinese: 107, comprehensive: 135, math: 85 } }],
  ["29620|9856", { schoolName: "上海交通大学", planCount: 5, filingCount: 5, maxScore: 666, minScore: 663, avgScore: 663.8, tieBreakScores: { totalScore: 663, chinese: 119, comprehensive: 287, math: 124 } }],
  ["29620|11590", { schoolName: "华东政法大学", planCount: 10, filingCount: 10, maxScore: 581, minScore: 543, avgScore: 554.2, tieBreakScores: { totalScore: 543, chinese: 108, comprehensive: 213, math: 119 } }],
  ["29620|8702", { schoolName: "黑龙江大学", planCount: 5, filingCount: 5, maxScore: 444, minScore: 440, avgScore: 441.6, tieBreakScores: { totalScore: 440, chinese: 102, comprehensive: 153, math: 81 } }],
  ["29620|11010", { schoolName: "华东师范大学", planCount: 7, filingCount: 7, maxScore: 604, minScore: 590, avgScore: 597, tieBreakScores: { totalScore: 590, chinese: 128, comprehensive: 221, math: 105 } }],
  ["29620|11702", { schoolName: "上海音乐学院", planCount: 2, filingCount: 2, maxScore: 463, minScore: 454, avgScore: 458.5, tieBreakScores: { totalScore: 454, chinese: 109, comprehensive: 161, math: 93 } }],
  ["29620|11818", { schoolName: "上海戏剧学院", planCount: 1, filingCount: 1, maxScore: 514, minScore: 514, avgScore: 514, tieBreakScores: { totalScore: 514, chinese: 125, comprehensive: 175, math: 97 } }],
  ["29620|15516", { schoolName: "浙江师范大学", planCount: 6, filingCount: 1, maxScore: 473, minScore: 473, avgScore: 473, tieBreakScores: { totalScore: 473, chinese: 115, comprehensive: 179, math: 113 } }],
  ["29620|15865", { schoolName: "中国美术学院", planCount: 1, filingCount: 1, maxScore: 559, minScore: 559, avgScore: 559, tieBreakScores: { totalScore: 559, chinese: 115, comprehensive: 212, math: 100 } }],
  ["29620|852", { schoolName: "中国人民大学", planCount: 11, filingCount: 12, maxScore: 658, minScore: 648, avgScore: 652.92, tieBreakScores: { totalScore: 648, chinese: 127, comprehensive: 273, math: 121 } }],
  ["29620|3391", { schoolName: "北京物资学院", planCount: 14, filingCount: 14, maxScore: 480, minScore: 435, avgScore: 451.43, tieBreakScores: { totalScore: 435, chinese: 111, comprehensive: 136, math: 94 } }],
  ["29620|13322", { schoolName: "江南大学", planCount: 37, filingCount: 38, maxScore: 559, minScore: 540, avgScore: 546.29, tieBreakScores: { totalScore: 540, chinese: 117, comprehensive: 234, math: 108 } }],
  ["29620|13438", { schoolName: "南京林业大学", planCount: 97, filingCount: 99, maxScore: 531, minScore: 473, avgScore: 494.05, tieBreakScores: { totalScore: 473, chinese: 108, comprehensive: 162, math: 95 } }],
  ["29620|18174", { schoolName: "青岛科技大学", planCount: 36, filingCount: 36, maxScore: 503, minScore: 457, avgScore: 468.86, tieBreakScores: { totalScore: 457, chinese: 117, comprehensive: 155, math: 80 } }],
  ["29623|1969", { schoolName: "广东医科大学", planCount: 20, filingCount: 21, maxScore: 525, minScore: 457, avgScore: 483.48, tieBreakScores: { totalScore: 457, chinese: 109, comprehensive: 191, math: 86 } }],
  ["29623|5203", { schoolName: "云南大学", planCount: 25, filingCount: 25, maxScore: 534, minScore: 486, avgScore: 506.6, tieBreakScores: { totalScore: 486, chinese: 109, comprehensive: 179, math: 113 } }],
  ["29623|11556", { schoolName: "宁波诺丁汉大学", planCount: 10, filingCount: 7, maxScore: 528, minScore: 430, avgScore: 467.43, tieBreakScores: { totalScore: 430, chinese: 109, comprehensive: 126, math: 84 } }],
  ["29623|15367", { schoolName: "兰州大学", planCount: 5, filingCount: 5, maxScore: 501, minScore: 467, avgScore: 483.6, tieBreakScores: { totalScore: 467, chinese: 113, comprehensive: 168, math: 100 } }],
  ["29623|12482", { schoolName: "复旦大学医学院", planCount: 1, filingCount: 1, maxScore: 666, minScore: 666, avgScore: 666, tieBreakScores: { totalScore: 666, chinese: 140, comprehensive: 270, math: 121 } }],
  ["29623|12598", { schoolName: "上海交通大学医学院", planCount: 1, filingCount: 1, maxScore: 660, minScore: 660, avgScore: 660, tieBreakScores: { totalScore: 660, chinese: 125, comprehensive: 268, math: 132 } }],
  ["29623|12830", { schoolName: "合肥工业大学（宣城校区）", planCount: 1, filingCount: 1, maxScore: 518, minScore: 518, avgScore: 518, tieBreakScores: { totalScore: 518, chinese: 105, comprehensive: 192, math: 108 } }],
  ["29623|15251", { schoolName: "陕西科技大学", planCount: 2, filingCount: 2, maxScore: 490, minScore: 465, avgScore: 477.5, tieBreakScores: { totalScore: 465, chinese: 108, comprehensive: 182, math: 104 } }],
  ["29623|4623", { schoolName: "四川师范大学", planCount: 5, filingCount: 5, maxScore: 441, minScore: 437, avgScore: 439.2, tieBreakScores: { totalScore: 437, chinese: 110, comprehensive: 152, math: 79 } }],
  ["29623|11324", { schoolName: "南方医科大学", planCount: 9, filingCount: 9, maxScore: 626, minScore: 518, avgScore: 559.22, tieBreakScores: { totalScore: 518, chinese: 115, comprehensive: 190, math: 91 } }],
  ["29623|11443", { schoolName: "成都医学院", planCount: 19, filingCount: 19, maxScore: 527, minScore: 489, avgScore: 505.95, tieBreakScores: { totalScore: 489, chinese: 103, comprehensive: 173, math: 105 } }],
  ["29623|11904", { schoolName: "北京大学医学部", planCount: 1, filingCount: 2, maxScore: 676, minScore: 673, avgScore: 674.5, tieBreakScores: { totalScore: 673, chinese: 124, comprehensive: 279, math: 121 } }],
  ["29623|12366", { schoolName: "哈尔滨工业大学（威海）", planCount: 8, filingCount: 8, maxScore: 633, minScore: 624, avgScore: 626.75, tieBreakScores: { totalScore: 624, chinese: 123, comprehensive: 239, math: 123 } }],
  ["29623|14097", { schoolName: "天津中医药大学", planCount: 2, filingCount: 1, maxScore: 423, minScore: 423, avgScore: 423, tieBreakScores: { totalScore: 423, chinese: 106, comprehensive: 138, math: 68 } }],
  ["29623|14213", { schoolName: "天津商业大学", planCount: 3, filingCount: 3, maxScore: 466, minScore: 461, avgScore: 463, tieBreakScores: { totalScore: 461, chinese: 116, comprehensive: 157, math: 76 } }],
  ["29623|14558", { schoolName: "上海应用技术大学", planCount: 5, filingCount: 5, maxScore: 474, minScore: 457, avgScore: 467.6, tieBreakScores: { totalScore: 457, chinese: 110, comprehensive: 151, math: 84 } }],
  ["29623|15483", { schoolName: "浙江大学", planCount: 9, filingCount: 9, maxScore: 656, minScore: 640, avgScore: 647.44, tieBreakScores: { totalScore: 640, chinese: 136, comprehensive: 265, math: 98 } }],
  ["29623|8207", { schoolName: "新疆师范大学", planCount: 323, filingCount: 323, maxScore: 497, minScore: 423, avgScore: 433.46, tieBreakScores: { totalScore: 423, chinese: 106, comprehensive: 149, math: 82 } }],
]);
const ROW_CORRECTIONS = new Map(Object.entries(JSON.parse(fs.readFileSync(CORRECTIONS_FILE, "utf8"))));
const NAME_CORRECTIONS = new Map([
  ["天泮农学院", "天津农学院"],
  ["咯尔滨医科大学", "哈尔滨医科大学"],
  ["柒美大学", "集美大学"],
  ["潮南理工学院", "湖南理工学院"],
  ["新骝医科大学", "新疆医科大学"],
  ["賁岛滨海学院", "青岛滨海学院"],
  ["新躽工程学院", "新疆工程学院"],
  ["西安航室学院", "西安航空学院"],
  ["武品理工学院", "武昌理工学院"],
  ["肯岛工学院", "青岛工学院"],
  ["天泮仁愛学院", "天津仁爱学院"],
  ["潮北三峽航空学院", "湖北三峡航空学院"],
  ["塔里水理工学院", "塔里木理工学院"],
  ["长森中医药大学", "长春中医药大学"],
  ["黒龙江八一农垦大学", "黑龙江八一农垦大学"],
  ["福殚师范大学福建师范大学", "福建师范大学"],
  ["才立干好外经贸学院", "辽宁对外经贸学院"],
  ["产州戴海学院", "广州航海学院"],
  ["齐齐咯尔医学院", "齐齐哈尔医学院"],
  ["武汉生牧工程学院", "武汉生物工程学院"],
  ["新骝棽寥学院", "新疆警察学院"],
  ["东英才学院", "山东英才学院"],
  ["兰州信息科校学院", "兰州信息科技学院"],
  ["长森财经学院", "长春财经学院"],
  ["吉沝殏筑科校学院", "吉林建筑科技学院"],
  ["天泮外国语大学滨海外事学院", "天津外国语大学滨海外事学院"],
  ["产东理工学院", "广东理工学院"],
  ["西安浅车职业大学", "西安汽车职业大学"],
  ["天泮仁爱学院", "天津仁爱学院"],
  ["中国民用航空飞飞行学院", "中国民用航空飞行学院"],
  ["新多学院", "新乡学院"],
  ["翠枝花学院", "攀枝花学院"],
  ["出新华学院", "安徽新华学院"],
  ["北京交通大学2", "北京交通大学"],
  ["长春理工大学口", "长春理工大学"],
  ["上海音乐学院维", "上海音乐学院"],
  ["郑州大学田维", "郑州大学"],
]);

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-xinjiang-undergraduate2-filing-2025-v3312.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-xinjiang-undergraduate2-filing-2025-v3312.mjs --use-cache",
    "  node scripts/import-official-xinjiang-undergraduate2-filing-2025-v3312.mjs --use-cache --relaxed-audit",
    "",
    "Imports Xinjiang 2025 ordinary undergraduate second-batch official image filing scores.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, out: DEFAULT_OUT, rawDir: DEFAULT_RAW_REL };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--url") args.url = argv[++i];
    else if (item === "--html") args.html = argv[++i];
    else if (item === "--image-dir") args.imageDir = argv[++i];
    else if (item === "--raw-dir") args.rawDir = argv[++i];
    else if (item === "--out") args.out = argv[++i];
    else if (item === "--use-cache") args.useCache = true;
    else if (item === "--relaxed-audit") args.relaxedAudit = true;
    else if (item === "--help" || item === "-h") args.help = true;
  }
  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(" ")} failed with status ${result.status}`,
      result.stderr?.trim(),
      result.stdout?.trim(),
    ].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function invariant(condition, message) {
  if (!condition) throw new Error(`Xinjiang undergraduate2 v3.312 audit failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function relativeProjectPath(file) {
  return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
}

function listFilesRecursive(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(file));
    else if (entry.isFile()) files.push(file);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function hash(value, length = 18) {
  return sha256(String(value)).slice(0, length);
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHtmlText(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]+>/g, " "));
}

async function downloadText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 gaokao-xinjiang-undergraduate2-v3312-importer/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function downloadBinary(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 gaokao-xinjiang-undergraduate2-v3312-importer/1.0",
      accept: "image/png,image/*",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function extractPageMeta(html, pageUrl) {
  const title = cleanHtmlText(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
  const publishedAt = decodeEntities(/发布时间[:：]\s*([^<]+)/.exec(html)?.[1] || "");
  if (!/新疆维吾尔自治区2025年普通高校招生普通类本科二批次投档情况/.test(title)) {
    throw new Error(`Unexpected Xinjiang undergraduate2 page title: ${title}`);
  }
  const imageMeta = [];
  const regex = /<a\s+href=["']([^"']*\/upload\/resources\/image\/2025\/08\/06\/(\d+)\.png)["'][^>]*>\s*<img\b([^>]*)>/gi;
  for (const match of html.matchAll(regex)) {
    const imageId = match[2];
    if (!IMAGE_SUBJECTS.has(imageId)) continue;
    const attrs = match[3] || "";
    const label = decodeEntities(/(?:title|alt)=["']([^"']+)["']/i.exec(attrs)?.[1] || "");
    imageMeta.push({
      imageId,
      url: new URL(match[1], pageUrl).href,
      label,
      ...IMAGE_SUBJECTS.get(imageId),
    });
  }
  const unique = [...new Map(imageMeta.map((item) => [item.imageId, item])).values()];
  if (unique.length !== IMAGE_SUBJECTS.size) {
    throw new Error(`Expected ${IMAGE_SUBJECTS.size} Xinjiang official PNG links, got ${unique.length}`);
  }
  return { title, publishedAt, imageMeta: unique };
}

function imageDimensions(file) {
  const output = run("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  const width = Number(/pixelWidth:\s*(\d+)/.exec(output)?.[1]);
  const height = Number(/pixelHeight:\s*(\d+)/.exec(output)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Could not read image dimensions for ${file}`);
  }
  return { width, height };
}

function prepareOcrImage(file, imageId) {
  const ocrDir = path.join(TMP_ROOT, "ocr-images-2829");
  fs.mkdirSync(ocrDir, { recursive: true });
  const output = path.join(ocrDir, `${imageId}.png`);
  if (!fs.existsSync(output) || fs.statSync(output).mtimeMs < fs.statSync(file).mtimeMs) {
    run("/usr/bin/sips", ["--resampleWidth", "2829", file, "--out", output]);
  }
  return output;
}

function ensureVisionBinary() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const binary = path.join(TMP_ROOT, "vision-table-row-ocr");
  if (!fs.existsSync(binary) || fs.statSync(binary).mtimeMs < fs.statSync(VISION_HELPER).mtimeMs) {
    run("/usr/bin/swiftc", [VISION_HELPER, "-o", binary]);
  }
  return binary;
}

function visionItemsForImage(file, cacheDir, dimensions, visionBinary) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const imageId = path.basename(file, path.extname(file));
  const chunkHeight = 4200;
  const chunkStep = 4000;
  const items = [];
  for (let y = 0; y < dimensions.height; y += chunkStep) {
    const height = Math.min(chunkHeight, dimensions.height - y);
    const cache = path.join(cacheDir, `${imageId}-${y}.json`);
    if (!fs.existsSync(cache) || fs.statSync(cache).size === 0) {
      const stdout = run(visionBinary, [
        file,
        "--raw",
        "0",
        String(y),
        String(dimensions.width),
        String(height),
      ]);
      fs.writeFileSync(cache, stdout, "utf8");
    }
    const parsed = JSON.parse(fs.readFileSync(cache, "utf8"));
    for (const observation of parsed.observations || []) {
      items.push({
        text: observation.text,
        confidence: Number(observation.confidence) || 0,
        x: observation.x * parsed.width,
        y: y + (1 - observation.y - observation.height / 2) * parsed.height,
        width: observation.width * parsed.width,
        height: observation.height * parsed.height,
      });
    }
    if (y + height >= dimensions.height) break;
  }
  return items;
}

function visionItemsForRow(file, cacheDir, dimensions, visionBinary, imageId, centerY) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const rowTop = Math.round(centerY);
  const cropY = Math.max(0, rowTop - 62);
  const cropHeight = Math.min(124, dimensions.height - cropY);
  const cache = path.join(cacheDir, `${imageId}-${rowTop}.json`);
  if (!fs.existsSync(cache) || fs.statSync(cache).size === 0) {
    const stdout = run(visionBinary, [
      file,
      "--raw",
      "0",
      String(cropY),
      String(dimensions.width),
      String(cropHeight),
    ]);
    fs.writeFileSync(cache, stdout, "utf8");
  }
  const parsed = JSON.parse(fs.readFileSync(cache, "utf8"));
  return (parsed.observations || []).map((observation) => ({
    text: observation.text,
    confidence: Number(observation.confidence) || 0,
    x: observation.x * parsed.width,
    y: cropY + (1 - observation.y - observation.height / 2) * parsed.height,
    width: observation.width * parsed.width,
    height: observation.height * parsed.height,
  }));
}

function cleanDigits(value) {
  return String(value ?? "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss$]/g, "5")
    .replace(/[^0-9.]/g, "");
}

function numberFrom(value, { decimal = false } = {}) {
  const text = cleanDigits(value);
  const pattern = decimal ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
  return pattern.test(text) ? Number(text) : null;
}

function joinedText(items, range) {
  return items
    .filter((item) => item.x + item.width / 2 >= range[0] && item.x + item.width / 2 < range[1])
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join("");
}

function bestNumber(items, range, options = {}) {
  return items
    .filter((item) => item.x + item.width / 2 >= range[0] && item.x + item.width / 2 < range[1])
    .sort((a, b) => b.confidence - a.confidence || b.width - a.width)
    .map((item) => numberFrom(item.text, options))
    .find(Number.isFinite) ?? null;
}

function cleanSchoolName(value) {
  let text = String(value ?? "")
    .replace(/[【】「」『』\[\]—_]/g, "")
    .replace(/[|/\\。；;，,：:]+$/g, "")
    .replace(/^[^\u4e00-\u9fa5]+/, "")
    .replace(/\s+/g, "")
    .trim();
  if (text.length % 2 === 0) {
    const half = text.slice(0, text.length / 2);
    if (half.length >= 4 && half === text.slice(text.length / 2)) text = half;
  }
  text = text
    .replace(/^[-一二小艺百主到正]+/, "")
    .replace(/(.{4,}职业技术大学)\1$/g, "$1")
    .replace(/(.{4,}职业技术学院)\1$/g, "$1")
    .replace(/(.{4,}职业学院)\1$/g, "$1")
    .replace(/(.{4,}师范学院)\1$/g, "$1")
    .replace(/(.{4,}学院)\1$/g, "$1")
    .replace(/(.{4,}大学)\1$/g, "$1");
  const corrections = new Map([
    ["天津职业技术师范大学天津职业技术师范大学", "天津职业技术师范大学"],
    ["新疆天山职业技术大学新疆天山职业技术大学", "新疆天山职业技术大学"],
  ]);
  text = corrections.get(text) || text;
  return NAME_CORRECTIONS.get(text) || text;
}

function boundedInteger(value, min, max) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

function boundedAverage(value, minScore, maxScore) {
  if (!Number.isFinite(value)) return null;
  const candidates = [value];
  if (value > 750) candidates.push(value / 100);
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue;
    if (candidate >= minScore && (!Number.isFinite(maxScore) || candidate <= maxScore)) {
      return Number(candidate.toFixed(2));
    }
  }
  return null;
}

function disciplineCodes(textValue) {
  const text = String(textValue || "");
  const out = new Set();
  if (/财经|金融|会计|审计|经济|商务|管理|贸易|统计/.test(text)) out.add("12");
  if (/理工|工程|电力|机电|电子|信息|科技|交通|航空|航天|智能|软件|计算机|数据|自动化|机械|材料|化学|建筑|土木/.test(text)) out.add("08");
  if (/医学|医科|中医|药|护理|卫生|口腔|临床|生物医学/.test(text)) out.add("10");
  if (/师范|教育/.test(text)) out.add("04");
  if (/外语|语言|新闻|传媒|艺术|音乐|戏剧|电影|体育|旅游/.test(text)) out.add("05");
  if (/政法|公安|警察|军|国防/.test(text)) out.add("03");
  if (/农业|农林|林业|园林|水产/.test(text)) out.add("09");
  return [...out];
}

function schoolTags(record) {
  const text = record.schoolName;
  const tags = ["新疆官方本科二批投档线", record.subjectType];
  if (/新疆|乌鲁木齐|昌吉|石河子|塔里木|喀什|伊犁|和田/.test(text)) tags.push("新疆本地");
  if (/师范|教育/.test(text)) tags.push("师范教育");
  if (/医学|医科|中医|药|护理|卫生|口腔|临床/.test(text)) tags.push("医卫");
  if (/信息|软件|计算机|数据|智能|电子|电气|自动化|工程|技术|理工/.test(text)) tags.push("信息技术/工程");
  if (/财经|金融|会计|经济|商务|管理|贸易/.test(text)) tags.push("财经商科");
  if (Number(record.minScore) < 400) tags.push("本科二批低分边界");
  return [...new Set(tags)];
}

function columnsFor(width) {
  const scale = width / 1051;
  const s = (value) => value * scale;
  return {
    code: [0, s(85)],
    name: [s(85), s(370)],
    plan: [s(370), s(455)],
    filed: [s(455), s(540)],
    high: [s(540), s(625)],
    minTotal: [s(625), s(710)],
    tie1: [s(710), s(795)],
    comprehensive: [s(795), s(880)],
    tie3: [s(880), s(965)],
    avg: [s(965), width + 10],
  };
}

function validSchoolName(name) {
  return /[\u4e00-\u9fa5]{2,}/.test(name) && /((大学|学院|学校)(（[^（）]{1,30}）)?|分校|校区|医学部)$/.test(name);
}

function parseImageRows({ image, items, dimensions, ocrFile, rowCacheDir, visionBinary }) {
  const ranges = columnsFor(dimensions.width);
  const codeItems = items
    .filter((item) => {
      const centerX = item.x + item.width / 2;
      return item.y > 220 && centerX >= ranges.code[0] && centerX < ranges.code[1];
    })
    .map((item) => ({ ...item, code: cleanDigits(item.text).slice(0, 4) }))
    .filter((item) => /^\d{4}$/.test(item.code))
    .sort((a, b) => a.y - b.y || b.confidence - a.confidence);

  const anchors = [];
  for (const item of codeItems) {
    if (anchors.some((anchor) => Math.abs(anchor.y - item.y) < 20)) continue;
    anchors.push(item);
  }

  const records = [];
  const skippedRows = [];
  const qualityRows = [];
  const skipped = {
    missingSchool: 0,
    invalidSchool: 0,
    missingScore: 0,
    invalidScore: 0,
  };
  const quality = {
    overlappingOcrAnchors: codeItems.length - anchors.length,
    rejectedHighestScore: 0,
    missingPlanAndFiling: 0,
  };

  for (const anchor of anchors) {
    const initialRowItems = items.filter((item) => Math.abs(item.y - anchor.y) < 26);
    const initialSchool = cleanSchoolName(joinedText(initialRowItems, ranges.name));
    const initialValues = [
      bestNumber(initialRowItems, ranges.plan),
      bestNumber(initialRowItems, ranges.filed),
      bestNumber(initialRowItems, ranges.high),
      bestNumber(initialRowItems, ranges.minTotal),
      bestNumber(initialRowItems, ranges.tie1),
      bestNumber(initialRowItems, ranges.comprehensive),
      bestNumber(initialRowItems, ranges.tie3),
      bestNumber(initialRowItems, ranges.avg, { decimal: true }),
    ];
    const needsRowPass = !validSchoolName(initialSchool) || initialValues.some((value) => !Number.isFinite(value));
    const targetedRowItems = needsRowPass
      ? visionItemsForRow(ocrFile, rowCacheDir, dimensions, visionBinary, image.imageId, anchor.y)
          .filter((item) => Math.abs(item.y - anchor.y) < 48)
      : [];
    const rowItemSets = targetedRowItems.length ? [initialRowItems, targetedRowItems] : [initialRowItems];
    const rowItems = targetedRowItems.length > initialRowItems.length ? targetedRowItems : initialRowItems;
    const numberFromRows = (range, options = {}) => rowItemSets
      .map((rowSet) => bestNumber(rowSet, range, options))
      .find(Number.isFinite) ?? null;
    const schoolCandidates = rowItemSets
      .map((rowSet) => cleanSchoolName(joinedText(rowSet, ranges.name)))
      .filter(Boolean);
    const correctionKey = `${image.imageId}|${anchor.code}`;
    const correction = ROW_CORRECTIONS.get(correctionKey) || {};
    const diagnostic = (reason, extra = {}) => skippedRows.push({
      imageId: image.imageId,
      subjectType: image.subjectType,
      correctionKey,
      rowTop: Math.round(anchor.y),
      schoolCodeOcr: anchor.code,
      reason,
      rowText: rowItems.sort((left, right) => left.x - right.x).map((item) => item.text).join(" | "),
      ...extra,
    });
    const qualityDiagnostic = (reason, extra = {}) => qualityRows.push({
      imageId: image.imageId,
      subjectType: image.subjectType,
      correctionKey,
      rowTop: Math.round(anchor.y),
      schoolCodeOcr: anchor.code,
      reason,
      ...extra,
    });
    const schoolName = correction.schoolName || schoolCandidates.find(validSchoolName) || schoolCandidates[0] || "";
    if (!schoolName) {
      skipped.missingSchool += 1;
      diagnostic("missing-school");
      continue;
    }
    if (!validSchoolName(schoolName)) {
      skipped.invalidSchool += 1;
      diagnostic("invalid-school", { schoolNameOcr: schoolName });
      continue;
    }
    const planCount = Number.isFinite(correction.planCount) ? correction.planCount : numberFromRows(ranges.plan);
    const filingCount = Number.isFinite(correction.filingCount) ? correction.filingCount : numberFromRows(ranges.filed);
    if (!Number.isFinite(planCount) && !Number.isFinite(filingCount)) {
      quality.missingPlanAndFiling += 1;
      qualityDiagnostic("missing-plan-and-filing", { schoolName });
    }
    const noFiling = correction.noFiling === true;
    let cleanMinScore = null;
    let cleanMaxScore = null;
    let cleanAvgScore = null;
    let tieBreakScores = null;
    if (!noFiling) {
      const minScore = Number.isFinite(correction.minScore) ? correction.minScore : numberFromRows(ranges.minTotal);
      if (!Number.isFinite(minScore)) {
        skipped.missingScore += 1;
        diagnostic("missing-score", { schoolNameOcr: schoolName });
        continue;
      }
      if (minScore < 100 || minScore > 750) {
        skipped.invalidScore += 1;
        diagnostic("invalid-score", { schoolNameOcr: schoolName, minScoreOcr: minScore });
        continue;
      }
      const highestScoreOcr = numberFromRows(ranges.high);
      let highestScore = Number.isFinite(correction.maxScore) ? correction.maxScore : highestScoreOcr;
      if (Number.isFinite(highestScore) && (highestScore < minScore || highestScore > 750)) {
        quality.rejectedHighestScore += 1;
        qualityDiagnostic("rejected-highest-score", { schoolName, highestScoreOcr, minScore });
        highestScore = null;
      }
      const tie1 = numberFromRows(ranges.tie1);
      const comprehensive = numberFromRows(ranges.comprehensive);
      const tie3 = numberFromRows(ranges.tie3);
      const chinese = image.subjectType === "历史类" ? tie1 : tie3;
      const math = image.subjectType === "历史类" ? tie3 : tie1;
      const avgScore = numberFromRows(ranges.avg, { decimal: true });
      cleanMinScore = Math.round(correction.minScore ?? minScore);
      cleanMaxScore = Number.isFinite(correction.maxScore) ? Math.round(correction.maxScore) : (Number.isFinite(highestScore) ? Math.round(highestScore) : null);
      cleanAvgScore = Number.isFinite(correction.avgScore) ? Number(correction.avgScore.toFixed(2)) : boundedAverage(avgScore, cleanMinScore, cleanMaxScore);
      tieBreakScores = correction.tieBreakScores || {
        totalScore: cleanMinScore,
        chinese: boundedInteger(chinese, 0, 150),
        comprehensive: boundedInteger(comprehensive, 0, 300),
        math: boundedInteger(math, 0, 150),
      };
    }
    const base = {
      province: PROVINCE,
      year: YEAR,
      subjectType: image.subjectType,
      batch: BATCH,
      schoolName,
      schoolCode: correction.schoolCode || anchor.code,
      schoolTags: [],
      dataType: noFiling ? "admission-plan" : "institution-admission",
      majorName: noFiling ? "普通类本科二批次院校招生计划（未投档）" : "普通类本科二批次院校投档线",
      majorCode: "",
      majorGroup: "",
      disciplineCodes: disciplineCodes(schoolName),
      planCount: Number.isFinite(planCount) ? Math.round(planCount) : null,
      filingCount: Number.isFinite(filingCount) ? Math.round(filingCount) : null,
      minScore: cleanMinScore,
      maxScore: cleanMaxScore,
      avgScore: cleanAvgScore,
      minRankStart: null,
      minRankEnd: null,
      rankRangeText: "",
      scoreOnly: !noFiling,
      noFiling,
      rankUnavailable: true,
      nativeAdmissionRankUnavailable: true,
      rankDerivedFromScore: false,
      rankEvidenceScope: "rank-unavailable",
      scoreMetric: noFiling ? "官方表显示投档人数为 0，未形成投档分数" : "新疆教育考试院普通本科二批院校最低投档排序分",
      rankMetric: noFiling ? "未投档，无最低分与最低位次" : "官方投档表未公开最低位次",
      tieBreakScores,
      sourceId: SOURCE_ID,
      sourceQuality: "official-xinjiang-2025-undergraduate2-institution-filing-image-ocr-score-only-v3312",
      sourceUrl: DEFAULT_URL,
      sourcePageUrl: DEFAULT_URL,
      sourceImageUrl: image.url,
      sourceFile: image.rawFile,
      officialEvidencePath: image.rawFile,
      imageId: image.imageId,
      originalSubject: image.originalSubject,
      ocrRowTop: Math.round(anchor.y),
      ocrCorrection: Object.keys(correction).length ? correction : undefined,
      cautions: [
        "本记录来自新疆教育考试院官网公开图片表，经 macOS Vision OCR 抽取；正式填报前必须回官方原图复核。",
        noFiling
          ? "原表显示该院校有招生计划但投档人数为 0；本记录不生成假分数、假位次，也不进入分数预测。"
          : "原表为普通类本科二批次院校投档分数情况，只公开投档分和同分排序项，不含最低位次；本导入不生成假位次。",
        "新疆 2025 文史/理工口径在本地推荐中映射为历史类/物理类；跨年份或新高考口径比较需人工复核。",
        "院校投档线只能判断进档边界，不等同于最终专业录取结果；仍需核对当年计划、专业和招生章程。",
      ],
    };
    const idBase = [YEAR, PROVINCE, BATCH, image.subjectType, base.schoolCode, schoolName, base.minScore, image.imageId, Math.round(anchor.y)].join("|");
    base.id = `${YEAR}-xinjiang-undergrad2-v3312-filing-${hash(idBase, 18)}`;
    base.schoolTags = schoolTags(base);
    records.push(base);
  }
  return { records, skipped, skippedRows, quality, qualityRows, candidates: anchors.length };
}

function dedupe(records) {
  const map = new Map();
  for (const record of records) {
    const key = [record.subjectType, record.schoolCode, record.schoolName, record.minScore, record.imageId, record.ocrRowTop].join("|");
    map.set(key, record);
  }
  return [...map.values()].sort((a, b) =>
    String(a.subjectType).localeCompare(String(b.subjectType), "zh-Hans-CN") ||
    Number(a.imageId) - Number(b.imageId) ||
    a.ocrRowTop - b.ocrRowTop
  );
}

function summarize(records) {
  return Object.entries(Object.groupBy(records, (record) => record.subjectType))
    .map(([subjectType, subjectRecords]) => {
      const scoreRecords = subjectRecords.filter((record) => !record.noFiling && Number.isFinite(record.minScore));
      return {
        subjectType,
        records: subjectRecords.length,
        filingScoreRecords: scoreRecords.length,
        noFilingPlanRecords: subjectRecords.filter((record) => record.noFiling).length,
        scoreRange: {
          min: Math.min(...scoreRecords.map((record) => record.minScore)),
          max: Math.max(...scoreRecords.map((record) => record.minScore)),
        },
        schools: new Set(subjectRecords.map((record) => record.schoolName)).size,
        recordsWithPlanCount: subjectRecords.filter((record) => Number.isFinite(record.planCount)).length,
        recordsWithFilingCount: subjectRecords.filter((record) => Number.isFinite(record.filingCount)).length,
        recordsWithTieBreak: scoreRecords.filter((record) =>
          record.tieBreakScores && Object.values(record.tieBreakScores).every(Number.isFinite)
        ).length,
      };
    })
    .sort((a, b) => a.subjectType.localeCompare(b.subjectType, "zh-Hans-CN"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  if (rawDir.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing direct mac_2T evidence writes; use internal APFS staging.");
  fs.mkdirSync(rawDir, { recursive: true });
  const html = args.html
    ? fs.readFileSync(path.resolve(args.html), "utf8")
    : await downloadText(args.url);
  const htmlPath = path.join(rawDir, "xinjiang-2025-undergraduate2.html");
  fs.writeFileSync(htmlPath, html, "utf8");
  const pageMeta = extractPageMeta(html, args.url);
  const imageDir = path.resolve(args.imageDir || path.join(rawDir, "images"));
  const visionDir = path.join(rawDir, "vision-chunks-upscaled-2829");
  fs.mkdirSync(imageDir, { recursive: true });
  const visionBinary = ensureVisionBinary();

  const imageFiles = [];
  for (const image of pageMeta.imageMeta) {
    const file = path.join(imageDir, `${image.imageId}.png`);
    if (!args.useCache || !fs.existsSync(file) || fs.statSync(file).size === 0) {
      fs.writeFileSync(file, await downloadBinary(image.url));
    }
    imageFiles.push({ ...image, file, rawFile: relativeProjectPath(file) });
  }

  const imageNotes = [];
  const allRecords = [];
  const skippedRows = [];
  const qualityRows = [];
  const skippedTotals = {};
  const qualityTotals = {};
  for (const image of imageFiles) {
    const dimensions = imageDimensions(image.file);
    const ocrFile = prepareOcrImage(image.file, image.imageId);
    const ocrDimensions = imageDimensions(ocrFile);
    const items = visionItemsForImage(ocrFile, path.join(visionDir, image.imageId), ocrDimensions, visionBinary);
    const parsed = parseImageRows({
      image,
      items,
      dimensions: ocrDimensions,
      ocrFile,
      rowCacheDir: path.join(rawDir, "vision-rows-upscaled-2829", image.imageId),
      visionBinary,
    });
    allRecords.push(...parsed.records);
    skippedRows.push(...parsed.skippedRows);
    qualityRows.push(...parsed.qualityRows);
    for (const [key, value] of Object.entries(parsed.skipped)) {
      skippedTotals[key] = (skippedTotals[key] || 0) + value;
    }
    for (const [key, value] of Object.entries(parsed.quality)) {
      qualityTotals[key] = (qualityTotals[key] || 0) + value;
    }
    imageNotes.push({
      imageId: image.imageId,
      label: image.label,
      subjectType: image.subjectType,
      originalSubject: image.originalSubject,
      url: image.url,
      width: dimensions.width,
      height: dimensions.height,
      ocrWidth: ocrDimensions.width,
      ocrHeight: ocrDimensions.height,
      sha256: sha256File(image.file),
      ocrObservations: items.length,
      rowCandidates: parsed.candidates,
      records: parsed.records.length,
      skipped: parsed.skipped,
      quality: parsed.quality,
    });
  }

  const records = dedupe(allRecords);
  const subjectSummaries = summarize(records);
  for (const note of imageNotes) {
    const expected = EXPECTED_IMAGE_AUDIT.get(note.imageId);
    invariant(expected, `unexpected image ${note.imageId}`);
    invariant(note.width === expected.width && note.height === expected.height, `${note.imageId} dimensions changed`);
    invariant(note.sha256 === expected.sha256, `${note.imageId} official image hash changed`);
    if (Number.isInteger(expected.rows)) {
      invariant(note.rowCandidates === expected.rows, `${note.imageId} expected ${expected.rows} row candidates, got ${note.rowCandidates}`);
      invariant(note.records === expected.rows, `${note.imageId} expected ${expected.rows} parsed rows, got ${note.records}`);
    }
  }
  invariant(records.length === new Set(records.map((record) => record.id)).size, "duplicate record IDs detected");
  invariant(records.every((record) => validSchoolName(record.schoolName)), "invalid school name survived final audit");
  invariant(records.every((record) => record.rankUnavailable && record.nativeAdmissionRankUnavailable && !record.rankDerivedFromScore && record.minRankStart === null && record.minRankEnd === null), "rank-unavailable boundary violated");
  const filingScoreRecords = records.filter((record) => !record.noFiling);
  const noFilingPlanRecords = records.filter((record) => record.noFiling);
  const appliedCorrectionKeys = new Set(records
    .filter((record) => record.ocrCorrection)
    .map((record) => `${record.imageId}|${record.schoolCode}`));
  if (!args.relaxedAudit) {
    invariant(skippedRows.length === 0, `expected zero skipped rows, got ${skippedRows.length}`);
    invariant(records.length === 1076, `expected 1076 official rows, got ${records.length}`);
    invariant(filingScoreRecords.length === 1060, `expected 1060 filing-score rows, got ${filingScoreRecords.length}`);
    invariant(noFilingPlanRecords.length === 16, `expected 16 no-filing plan rows, got ${noFilingPlanRecords.length}`);
    invariant([...ROW_CORRECTIONS.keys()].every((key) => appliedCorrectionKeys.has(key)), "one or more manual correction keys were not applied");
    invariant(records.every((record) => Number.isInteger(record.planCount) && record.planCount >= 0 && record.planCount <= 2000), "invalid or missing plan count");
    invariant(records.every((record) => Number.isInteger(record.filingCount) && record.filingCount >= 0 && record.filingCount <= 2000), "invalid or missing filing count");
    invariant(filingScoreRecords.every((record) => record.dataType === "institution-admission" && record.scoreOnly), "filing-score record type boundary violated");
    invariant(filingScoreRecords.every((record) => Number.isFinite(record.minScore) && record.minScore >= 100 && record.minScore <= 750), "invalid minimum score");
    invariant(filingScoreRecords.every((record) => Number.isFinite(record.maxScore) && record.maxScore >= record.minScore && record.maxScore <= 750), "invalid maximum score");
    invariant(filingScoreRecords.every((record) => Number.isFinite(record.avgScore) && record.avgScore >= record.minScore && record.avgScore <= record.maxScore), "invalid average score");
    invariant(filingScoreRecords.every((record) => record.tieBreakScores?.totalScore === record.minScore), "tie-break total does not equal minimum score");
    invariant(filingScoreRecords.every((record) => Number.isFinite(record.tieBreakScores?.chinese) && record.tieBreakScores.chinese >= 0 && record.tieBreakScores.chinese <= 150), "invalid Chinese tie-break score");
    invariant(filingScoreRecords.every((record) => Number.isFinite(record.tieBreakScores?.math) && record.tieBreakScores.math >= 0 && record.tieBreakScores.math <= 150), "invalid math tie-break score");
    invariant(filingScoreRecords.every((record) => Number.isFinite(record.tieBreakScores?.comprehensive) && record.tieBreakScores.comprehensive >= 0 && record.tieBreakScores.comprehensive <= 300), "invalid comprehensive tie-break score");
    invariant(noFilingPlanRecords.every((record) => record.dataType === "admission-plan" && !record.scoreOnly && record.planCount > 0 && record.filingCount === 0), "no-filing plan boundary violated");
    invariant(noFilingPlanRecords.every((record) => record.minScore === null && record.maxScore === null && record.avgScore === null && record.tieBreakScores === null), "no-filing plan contains fabricated score data");
  }
  const generatedAt = new Date().toISOString();
  const evidenceFiles = listFilesRecursive(rawDir).filter((file) => path.basename(file) !== "raw-manifest.json").map((file) => ({
    path: relativeProjectPath(file),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  }));
  const rawManifestPath = path.join(rawDir, "raw-manifest.json");
  const rawManifest = {
    dataset: "official-xinjiang-undergraduate2-filing-2025-v3312-raw",
    generatedAt,
    sourceUrl: args.url,
    page: { path: relativeProjectPath(htmlPath), bytes: Buffer.byteLength(html), sha256: sha256(html) },
    images: imageNotes.map((item) => ({
      imageId: item.imageId,
      url: item.url,
      path: imageFiles.find((image) => image.imageId === item.imageId).rawFile,
      bytes: fs.statSync(imageFiles.find((image) => image.imageId === item.imageId).file).size,
      sha256: item.sha256,
      width: item.width,
      height: item.height,
      rowCandidates: item.rowCandidates,
      parsedRecords: item.records,
    })),
    evidenceFiles,
    totals: {
      filesBeforeManifest: evidenceFiles.length,
      bytesBeforeManifest: evidenceFiles.reduce((sum, item) => sum + item.bytes, 0),
      rowCandidates: imageNotes.reduce((sum, item) => sum + item.rowCandidates, 0),
      parsedRecords: records.length,
    },
  };
  fs.writeFileSync(rawManifestPath, `${JSON.stringify(rawManifest, null, 2)}\n`, "utf8");
  const rawFiles = [...evidenceFiles.map((item) => item.path), relativeProjectPath(rawManifestPath)];
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    dataset: path.basename(args.out, ".json"),
    generatedAt,
    scope: "新疆 2025 普通类本科二批次官方图片投档线",
    notes: [
      "Official Xinjiang Education Examination Authority image tables are OCR-parsed on internal APFS.",
      "This is an institution filing-line layer, not a one-score-one-rank conversion table.",
      "The official table has filing scores and same-score sorting items but no minimum rank; this import does not invent rank.",
      "The source is an ordinary provincial examination-authority filing table and remains separate from special, single-category and targeted pathways.",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      title: pageMeta.title,
      publisher: "新疆教育考试院",
      url: args.url,
      publishedAt: pageMeta.publishedAt,
      quality: "official-xinjiang-2025-undergraduate2-institution-filing-image-ocr-score-only-v3312",
      usage: `官方普通类本科二批次院校投档图片表，经本地 OCR 抽取 ${filingScoreRecords.length} 条院校投档线和 ${noFilingPlanRecords.length} 条投档人数为 0 的计划记录；无最低位次，未投档记录不参与分数预测。`,
      evidenceBoundary: "province-official ordinary undergraduate second-batch institution filing score, plan/filing count and tie-break components; no major result, minimum rank, elective requirement or admission probability",
      rawDir: relativeProjectPath(rawDir),
      rawFiles,
      parsedRecords: records.length,
      imageCount: imageFiles.length,
      htmlSha256: sha256(html),
      htmlBytes: Buffer.byteLength(html),
      imageNotes,
      subjectSummaries,
      skippedTotals,
      skippedRows,
      qualityTotals,
      qualityRows,
      rankUnavailableRecords: records.length,
      scoreDerivedRankRecords: 0,
      filingScoreRecords: filingScoreRecords.length,
      noFilingPlanRecords: noFilingPlanRecords.length,
    }],
    records,
    audit: {
      imageCount: imageFiles.length,
      rowCandidates: imageNotes.reduce((sum, item) => sum + item.rowCandidates, 0),
      parsedRecords: records.length,
      duplicateIds: records.length - new Set(records.map((record) => record.id)).size,
      skippedTotals,
      skippedRows,
      qualityTotals,
      qualityRows,
      rankUnavailableRecords: records.filter((record) => record.rankUnavailable).length,
      scoreDerivedRankRecords: records.filter((record) => record.rankDerivedFromScore).length,
      recordsWithPlanCount: records.filter((record) => Number.isFinite(record.planCount)).length,
      recordsWithFilingCount: records.filter((record) => Number.isFinite(record.filingCount)).length,
      recordsWithTieBreak: records.filter((record) => Object.values(record.tieBreakScores || {}).some((value) => value !== null)).length,
      filingScoreRecords: filingScoreRecords.length,
      noFilingPlanRecords: noFilingPlanRecords.length,
      manualCorrectionRows: appliedCorrectionKeys.size,
      minScore: Math.min(...filingScoreRecords.map((record) => record.minScore)),
      maxScore: Math.max(...filingScoreRecords.map((record) => record.maxScore)),
    },
  }, null, 2), "utf8");

  console.log(JSON.stringify({
    ok: true,
    out: path.relative(PROJECT_ROOT, outPath),
    records: records.length,
    subjects: subjectSummaries,
    skippedTotals,
    qualityTotals,
    imageNotes: imageNotes.map((item) => ({
      imageId: item.imageId,
      subjectType: item.subjectType,
      records: item.records,
      rowCandidates: item.rowCandidates,
      skipped: item.skipped,
      quality: item.quality,
      sha256: item.sha256,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
