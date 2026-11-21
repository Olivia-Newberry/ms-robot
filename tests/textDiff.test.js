import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeToken, lineDiff, renderDiff, tokenize } from "../modules/textDiff.js";

test("marks a replaced word and an added phrase in place", () => {
  const { text, complete, changed } = renderDiff("the meeting is on tuesday, bring snacks", "the meeting is on thursday, bring snacks and drinks");
  assert.equal(text, "the meeting is on ~~tuesday~~ __**thursday**__, bring snacks __**and drinks**__");
  assert.equal(complete, true);
  assert.equal(changed, true);
});

test("a rewritten phrase is one change, not word-by-word pairs", () => {
  assert.equal(renderDiff("the quick brown fox", "the slow red fox").text, "the ~~quick brown~~ __**slow red**__ fox");
});

test("unchanged text reports no change", () => {
  assert.deepEqual(renderDiff("same", "same"), { text: "same", complete: true, changed: false });
});

test("emoji are whole tokens, including skin tones, families, flags and keycaps", () => {
  assert.deepEqual(tokenize("hi 👍🏽 👨‍👩‍👧 🇬🇧 1️⃣").filter(t => t.trim()), ["hi", "👍🏽", "👨‍👩‍👧", "🇬🇧", "1️⃣"]);
});

test("emoji-only changes get a visible label", () => {
  assert.equal(renderDiff("add an emoji", "add an emoji 🙂").text, "add an emoji __**[+ 🙂]**__");
  assert.equal(renderDiff("thanks 👍", "thanks 👍🏽").text, "thanks ~~[− 👍]~~ __**[+ 👍🏽]**__");
  assert.equal(renderDiff("hello 🙂 friend", "hello friend").text, "hello ~~[− 🙂]~~ friend");
});

test("mentions, custom emoji and links are never split or escaped", () => {
  for (const token of ["<@123456789012345678>", "<:pog:123456789012345678>", "https://example.com/a_b"]) {
    assert.deepEqual(tokenize(`x ${token} y`).filter(t => t.trim()), ["x", token, "y"]);
    assert.equal(escapeToken(token), token);
  }
});

test("user markdown is escaped so it shows as typed and can't break the markers", () => {
  assert.equal(renderDiff("plain", "**bold** ||spoiler||").text, "~~plain~~ __**\\*\\*bold\\*\\* \\|\\|spoiler\\|\\|**__");
});

test("long messages keep context near the change and say what was left out", () => {
  const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
  const { text, complete } = renderDiff(words, words.replace("word300", "EDITED"), 1000);
  assert.equal(complete, false);
  assert.ok(text.length <= 1000);
  assert.match(text, /~~word300~~ __\*\*EDITED\*\*__/);
  assert.match(text, /unchanged words/);
});

test("line diff for the attached file", () => {
  assert.equal(lineDiff("a\nb\nc", "a\nB\nc"), "  a\n- b\n+ B\n  c");
});
