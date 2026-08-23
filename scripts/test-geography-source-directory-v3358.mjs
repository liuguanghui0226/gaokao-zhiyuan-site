#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const source = fs.readFileSync(appFile, "utf8");
const geographyData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(source, /geography-source-directory/);
assert.match(source, /geography-directory-link/);
assert.match(source, /访问/);

const view = { innerHTML: "" };
const emptyTemplate = { innerHTML: "<div>empty</div>" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderSources, state };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#view-sources") return view;
      if (selector === "#emptyTemplate") return emptyTemplate;
      throw new Error(`Unexpected selector in geography source-directory test: ${selector}`);
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.state.data = {
  sourceFiles: [{
    id: "core-source",
    title: "核心资料",
    relativePath: "docs/core.md",
    excerpt: "核心资料摘要",
    domains: [],
    disciplines: [],
    processingStatus: "text-extracted",
    textLength: 100,
    kind: "markdown",
    bytes: 100,
  }],
};
context.__gaokaoTest.state.geographyData = geographyData;
context.__gaokaoTest.state.query = "";
context.__gaokaoTest.state.discipline = "";
context.__gaokaoTest.state.domain = "";
context.__gaokaoTest.renderSources();

assert.match(view.innerHTML, /class="band geography-source-directory"/);
assert.match(view.innerHTML, /高中地理来源目录/);
assert.match(view.innerHTML, /168 个公开链接/);
assert.match(view.innerHTML, /22 个本地\/教材/);
assert.match(view.innerHTML, /class="geography-directory-link" href="https:\/\/oceanservice\.noaa\.gov\/education\/tutorial_tides\/tides01_intro\.html"/);
assert.match(view.innerHTML, /访问 2026-08-23/);
assert.match(view.innerHTML, /https:\/\/www\.mee\.gov\.cn\/hjzl\/sthjzk\/zghjzkgb\/202606\/P020260604583244574595\.pdf/);
assert.match(view.innerHTML, /github\.com\/felixyu9722\/high-school-geography/);
assert.match(view.innerHTML, /https:\/\/www\.tianditu\.gov\.cn\//);
assert.match(view.innerHTML, /https:\/\/www\.stats\.gov\.cn\/sj\/ndsj\//);
assert.match(view.innerHTML, /https:\/\/data\.earthquake\.cn\//);
assert.match(view.innerHTML, /github\.com\/Eason455\/global-circulation-simulator/);
assert.match(view.innerHTML, /https:\/\/www\.moa\.gov\.cn\//);
assert.match(view.innerHTML, /https:\/\/wmo\.int\/themes\/weather/);
assert.match(view.innerHTML, /github\.com\/Thanhson1674\/SEMSsimulator/);
assert.match(view.innerHTML, /https:\/\/www\.cgs\.gov\.cn\//);
assert.match(view.innerHTML, /https:\/\/www\.mot\.gov\.cn\//);
assert.match(view.innerHTML, /https:\/\/www\.nea\.gov\.cn\//);
assert.match(view.innerHTML, /https:\/\/www\.nmdis\.org\.cn\//);
assert.match(view.innerHTML, /https:\/\/www\.geodata\.cn\//);
assert.match(view.innerHTML, /github\.com\/boston-library\/lmec_collections/);
assert.match(view.innerHTML, /github\.com\/sagesteppe\/QGIS_Lesson/);
assert.match(view.innerHTML, /github\.com\/jesse-flores\/Tactile-Map-Generator/);
assert.match(view.innerHTML, /中国地质调查局：地质调查与地学信息入口/);
assert.match(view.innerHTML, /交通运输部：综合交通运输信息入口/);
assert.match(view.innerHTML, /国家能源局：能源信息与能源安全入口/);
assert.match(view.innerHTML, /中国海洋信息网：海洋信息与观测入口/);
assert.match(view.innerHTML, /国家地球系统科学数据中心：地球系统数据入口/);
assert.match(view.innerHTML, /commit 1d2f104a2a5a8b186bfd06a45dde7fd1af25279f/);
assert.match(view.innerHTML, /commit baccacf5893cf02d545258c0d3ceacab35430a62/);
assert.match(view.innerHTML, /commit 623966ce1963b41472ea667fbae62dc24b97f90a/);
assert.match(view.innerHTML, /https:\/\/docs\.qgis\.org\/latest\/en\/docs\/training_manual\//);
assert.match(view.innerHTML, /https:\/\/learn\.arcgis\.com\/en\//);
assert.match(view.innerHTML, /https:\/\/worldview\.earthdata\.nasa\.gov\//);
assert.match(view.innerHTML, /https:\/\/www\.protectedplanet\.net\/en/);
assert.match(view.innerHTML, /github\.com\/qgis\/QGIS-Training-Data/);
assert.match(view.innerHTML, /github\.com\/qgis\/QGIS-Documentation/);
assert.match(view.innerHTML, /github\.com\/spatialthoughts\/courses/);
assert.match(view.innerHTML, /github\.com\/geo-dan\/Geography_teaching_tools/);
assert.match(view.innerHTML, /github\.com\/1Mengjin\/GeographyTeachingPlugin/);
assert.match(view.innerHTML, /QGIS Training Manual：GIS 图层、栅格与空间分析/);
assert.match(view.innerHTML, /NASA Worldview：动态地球遥感观测/);
assert.match(view.innerHTML, /commit fd26dd88e39b9aec550eea450cec18d02b1de3b5/);
assert.match(view.innerHTML, /commit a33d48826a2673b58a66adc12b0aa1895cecaec6/);
assert.match(view.innerHTML, /commit a627b988b54b9dd0fe879d3a4b0c8148564c42be/);
assert.match(view.innerHTML, /commit c6721a440e4f1dcb2dc8c2c87115d5af1fd15285/);
assert.match(view.innerHTML, /commit 0ea592460b04452e7e761343113f1092968b1b2b/);
assert.match(view.innerHTML, /广西贵港市部分高中 2025—2026 学年高二上学期期末地理试卷/);
assert.match(view.innerHTML, /commit 0198f84c3552bf20df90124e1c18dc412f0cf0fd/);
assert.match(view.innerHTML, /github\.com\/giswqs\/geog-510/);
assert.match(view.innerHTML, /github\.com\/YutaOzawaTU\/edu-3d-terrain/);
assert.match(view.innerHTML, /github\.com\/vrautenbach\/isprs_catalogue/);
assert.match(view.innerHTML, /github\.com\/yujinnee\/WorldHunter/);
assert.match(view.innerHTML, /github\.com\/mukombradon\/GlobeGuesser/);
assert.match(view.innerHTML, /github\.com\/GIS-Info\/GISphereKG-ChatBot/);
assert.match(view.innerHTML, /https:\/\/www\.noaa\.gov\/education\/resource-collections/);
assert.match(view.innerHTML, /github\.com\/lurea-git\/geography-teaching-lecture/);
assert.match(view.innerHTML, /github\.com\/swingboat\/geography-study-react/);
assert.match(view.innerHTML, /github\.com\/7tigersniffstherose7\/Geographical-Education-Multi-round-QA-Dataset/);
assert.match(view.innerHTML, /github\.com\/mizmay\/web-map-quickstart/);
assert.match(view.innerHTML, /https:\/\/www\.rgs\.org\/schools/);
assert.match(view.innerHTML, /https:\/\/geography\.org\.uk\/online-teaching-resources\//);
assert.match(view.innerHTML, /github\.com\/1195214305\/GeoLab/);
assert.match(view.innerHTML, /github\.com\/laiyukai910-star\/geolab-128/);
assert.match(view.innerHTML, /github\.com\/a15355447898\/Geography_Note/);
assert.match(view.innerHTML, /https:\/\/www\.epa\.gov\/heatislands/);
assert.match(view.innerHTML, /https:\/\/education\.nationalgeographic\.org\/resource\/urban-heat-island\//);
assert.match(view.innerHTML, /https:\/\/www\.metoffice\.gov\.uk\/weather\/learn-about\/weather/);
assert.match(view.innerHTML, /class="geography-directory-local"/);
assert.doesNotMatch(view.innerHTML, /class="geography-directory-link"[^>]*>普通高中教科书/);

context.__gaokaoTest.state.query = "NOAA";
context.__gaokaoTest.renderSources();
assert.match(view.innerHTML, /高中地理来源目录/);
assert.match(view.innerHTML, /NOAA Tides and Water Levels Education/);
assert.doesNotMatch(view.innerHTML, /普通高中教科书 地理 必修 第一册/);

context.__gaokaoTest.state.query = "没有此来源";
context.__gaokaoTest.renderSources();
assert.match(view.innerHTML, /高中地理来源目录/);
assert.match(view.innerHTML, /当前检索“没有此来源”没有匹配的地理来源/);
assert.match(view.innerHTML, /0 条来源 · 0 个公开链接 · 0 个本地\/教材/);
assert.doesNotMatch(view.innerHTML, /class="empty-state"><h2>没有匹配结果<\/h2>/);

console.log(JSON.stringify({
  ok: true,
  geographySourcesVisible: geographyData.sources.length,
  publicSourcesLinked: true,
  localSourcesRemainUnlinked: true,
  queryEmptyStateRetained: true,
}, null, 2));
