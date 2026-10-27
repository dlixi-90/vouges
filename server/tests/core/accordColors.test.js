import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canonicalHex, parseAccordColors, parseAccordLibrary } from "../../../tools/apaniche/accord-colors-parser.mjs";
import { getAccordColors, getAccordPercent } from "../../../client/src/utils/accordColors.js";
import palette from "../../../client/src/data/accordColors.json" with { type: "json" };

test("extracts only literal background/text colors from source accord labels", () => {
  const html = `<div class="accord-item"><a class="accord-label" href="https://apaniche.vn/mui-huong-go" style="background-color:#774414; width:66%; color:#FFF">Gỗ (66%)</a></div>
    <a class="accord-label" href="https://apaniche.vn/mui-huong-la" style="background-color:url(javascript:bad);color:#fff">Bad (44%)</a>
    <a class="accord-label" href="https://untrusted.example/" style="background-color:#fff;color:#000">Other (60%)</a>
    <a style="background-color:#000;color:#fff">Unrelated header</a>`;
  assert.deepEqual(parseAccordColors(html), [{ label: "Gỗ", url: "https://apaniche.vn/mui-huong-go", background: "#774414", foreground: "#ffffff" }]);
  assert.equal(canonicalHex("#ABC"), "#aabbcc");
  assert.equal(canonicalHex("red;position:fixed"), null);
});

test("library collection uses only actual accord cards, excluding navigation links", () => {
  const html = `<a href="https://apaniche.vn/mui-huong-ngot">Navigation</a><div class="row list-scent"><a href="https://apaniche.vn/mui-huong-go"><h3>Gỗ</h3><p>Woody</p></a></div>`;
  assert.deepEqual(parseAccordLibrary(html), [{ label: "Gỗ", english: "Woody", url: "https://apaniche.vn/mui-huong-go" }]);
});

test("all 68 library/catalog accords have exact source colors, traceable examples and no conflicts", () => {
  const report = JSON.parse(fs.readFileSync(new URL("../../../data/research/apaniche/accord-colors.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(palette).length, 68);
  assert.equal(report.libraryCount, 68);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.conflicts, []);
  const products = JSON.parse(fs.readFileSync(new URL("../../../data/research/apaniche/products.json", import.meta.url), "utf8"));
  const used = new Set(products.flatMap(product => (product.detail?.data?.accords || []).map(accord => new URL(accord.url).pathname.slice(1))));
  assert.deepEqual([...used].sort(), Object.keys(palette).sort());
  for (const accord of report.accords) {
    assert.ok(report.receipts.some(receipt => receipt.url === accord.exampleUrl && /^[a-f\d]{64}$/.test(receipt.sha256)));
    assert.equal(palette[new URL(accord.url).pathname.slice(1)].background, accord.background);
    assert.equal(palette[new URL(accord.url).pathname.slice(1)].foreground, accord.foreground);
    assert.match(accord.background, /^#[a-f\d]{6}$/);
    assert.match(accord.foreground, /^#[a-f\d]{6}$/);
  }
  assert.equal(getAccordColors({ label: "Gỗ" }).background, "#774414");
  assert.equal(getAccordColors({ label: "Ngọt" }).background, "#ee363b");
  assert.equal(getAccordColors({ label: "Trái Cây" }).background, "#fc4b29");
});

test("colors remain consistent through manual edits, Vietnamese/English names and unavailable URLs", () => {
  const woody = getAccordColors({label: "Gỗ"});
  for (const label of ["gỗ", " GO ", "Woody", "Go\u0302̃"]) assert.equal(getAccordColors({label}).background, woody.background);
  assert.equal(getAccordColors({label: "Renamed", url: "https://apaniche.vn/mui-huong-go/?ref=test"}).background, woody.background);
  assert.equal(getAccordColors({label: "Gỗ", url: "javascript:bad"}).background, woody.background);
  for (const url of [null, "https://apaniche.vn/__proto__", "https://apaniche.vn/constructor"]) assert.deepEqual(getAccordColors({label: "Custom", url}), {background: "#e7e7e7", foreground: "#171717"});
});

test("rendering does not invent percentages or normalize independent accords to add to 100", () => {
  assert.deepEqual([100,68,66,0,1.5].map(displayedPercent => getAccordPercent({displayedPercent})), [100,68,66,0,1.5]);
  for (const displayedPercent of [null,undefined,-1,101,NaN,Infinity,"50"]) assert.equal(getAccordPercent({displayedPercent}), null);
});
