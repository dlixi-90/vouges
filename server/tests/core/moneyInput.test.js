import test from "node:test";
import assert from "node:assert/strict";
import { formatVndInput, parseVndInput, vndCaretPosition } from "../../../client/src/utils/moneyInput.js";

test("VND input groups thousands and keeps exact integer values for storage", () => {
  for (const amount of [0,1,349000,499000,2000000,123456789,Number.MAX_SAFE_INTEGER]) {
    assert.equal(parseVndInput(formatVndInput(amount)), amount);
  }
  assert.equal(formatVndInput(349000), "349.000 ₫");
  assert.equal(formatVndInput(1000000), "1.000.000 ₫");
  assert.equal(formatVndInput(2000000), "2.000.000 ₫");
});

test("cleared input differs from zero and formatted currency can be pasted", () => {
  assert.equal(parseVndInput(""), "");
  assert.equal(formatVndInput(""), "");
  assert.equal(formatVndInput(null), "");
  assert.equal(parseVndInput("0"), 0);
  assert.equal(parseVndInput("000349000"), 349000);
  for (const text of ["349000", "349.000", "349.000 ₫", "349.000 VND", "349.000 đ", "349\u00a0000"]) assert.equal(parseVndInput(text), 349000);
});

test("invalid signs/exponents/fractional commas and unsafe amounts cannot silently become another price", () => {
  for (const text of ["-349000", "+349000", "1e6", "2,5", "1,000", "abc", "9007199254740992", "9.007.199.254.740.992"]) assert.equal(parseVndInput(text), null);
  for (const value of [-1,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1]) assert.equal(formatVndInput(value), "");
});

test("caret follows the digit being edited when grouping separators move", () => {
  assert.equal(vndCaretPosition("1.234.567", 0), 0);
  assert.equal(vndCaretPosition("1.234.567", 1), 1);
  assert.equal(vndCaretPosition("1.234.567", 2), 3);
  assert.equal(vndCaretPosition("1.234.567", 4), 5);
  assert.equal(vndCaretPosition("1.234.567", 7), 9);
  assert.equal(vndCaretPosition("12.934.567", 3), 4);
  assert.equal(vndCaretPosition("0", 10), 1);
  assert.equal(vndCaretPosition("", 0), 0);
  assert.equal(vndCaretPosition("1.000.000 ₫", 7), 9);
  assert.equal(vndCaretPosition("1.000.000 ₫", 20), 9);
  assert.equal(vndCaretPosition("0 ₫", 10), 1);
});
