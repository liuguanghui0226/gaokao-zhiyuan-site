#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const styles = fs.readFileSync(path.join(projectRoot, "site/assets/styles.css"), "utf8");
const index = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");

assert.ok(app.includes("基本情况：${profile.childType}；当前策略：${profile.strategy}"));
assert.ok(app.includes("以下按成绩、位次、专业偏好与证据质量排序"));
assert.ok(app.includes("<h4>院校建议</h4>"));
assert.ok(app.includes('name: "院校专业排序规则"'));
assert.ok(app.includes('formula: "排序分 = 35%硬匹配'));
assert.ok(app.includes('item.id === "five-axis" ? "五项排序依据"'));
assert.ok(!app.includes("孩子画像为"));
assert.ok(!app.includes("模型建议院校"));
assert.ok(!app.includes("本地高考志愿可靠推荐模型"));
assert.ok(!app.includes("模型不使用"));
assert.ok(!app.includes("模型可信度"));

const tileTemplate = app.slice(app.indexOf('return `<button class="discipline-tile'), app.indexOf('  }).join("");', app.indexOf('return `<button class="discipline-tile')));
assert.ok(tileTemplate.includes('data-discipline-code="${esc(discipline.code)}"'));
assert.ok(tileTemplate.includes('aria-pressed="${active}"'));
assert.ok(tileTemplate.includes("<strong>${esc(discipline.name)}</strong>"));
assert.ok(!tileTemplate.includes("<small>"));
assert.ok(app.includes("bindDisciplineEvents(selected, selectedFamily)"));
assert.ok(app.includes("button.addEventListener(\"click\""));

assert.ok(!/font-size:\s*(?:[0-9]|1[0-3])px/.test(styles), "Visible CSS text must not be smaller than 14px");
assert.ok(styles.includes(".discipline-tile > strong"));
assert.ok(!styles.includes(".discipline-tile > small"));
assert.ok(styles.includes("grid-template-columns: repeat(6, minmax(0, 1fr))"));
assert.ok(styles.includes(".nav-btn:nth-last-child(-n + 2)"));
assert.ok(index.includes("./assets/app.js?v=3.328.0"));
assert.ok(app.includes("位次口径含政策加分"));
assert.ok(app.includes("Number((score - minScore).toFixed(3))"));

console.log(JSON.stringify({ ok: true, plainLanguage: true, clickableDisciplineTiles: true, minimumExplicitTextSizePx: 14, assetVersion: "3.327.0" }, null, 2));
