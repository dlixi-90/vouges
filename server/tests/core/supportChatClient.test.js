import test from "node:test";
import assert from "node:assert/strict";
import { createSupportEventParser, mergeSupportMessages, mergeSupportSnapshot, supportContext } from "../../../client/src/utils/supportChat.js";

test("SSE parsing handles split Vietnamese payloads, CRLF, keepalives and multiple events", () => {
  const snapshots = [];
  const parse = createSupportEventParser((data) => snapshots.push(data));
  const stream = ': keepalive\r\n\r\nevent: snapshot\r\ndata: {"text":"Xin chào"}\r\n\r\nevent: snapshot\ndata: {"sequence":2}\n\n';
  for (const character of stream) parse(character);
  assert.deepEqual(snapshots, [{ text: "Xin chào" }, { sequence: 2 }]);
  assert.throws(() => parse('event: error\ndata: {"message":"Kết nối lại"}\n\n'), /Kết nối lại/);
});

test("out-of-order snapshots cannot overwrite newer status and merged history has no duplicate messages", () => {
  const current = { conversation: { _id: "c", sequence: 5, updatedAt: "2026-10-18T02:00:00Z", status: "active" }, messages: [{ _id: "5", sequence: 5 }] };
  const stale = { conversation: { _id: "c", sequence: 4, updatedAt: "2026-10-18T01:00:00Z", status: "waiting" }, messages: [{ _id: "4", sequence: 4 }] };
  const merged = mergeSupportSnapshot(current, stale);
  assert.equal(merged.conversation.status, "active");
  assert.deepEqual(merged.messages.map((item) => item.sequence), [4, 5]);
  assert.equal(mergeSupportMessages(merged.messages, current.messages).length, 2);
  const read = { conversation: { ...current.conversation, updatedAt: "2026-10-18T03:00:00Z", unreadStaff: 0 }, messages: [] };
  assert.equal(mergeSupportSnapshot(current, read).conversation.unreadStaff, 0);
  assert.deepEqual(mergeSupportSnapshot(current, read).messages, current.messages);
});

test("switching conversations replaces history instead of merging another customer's messages", () => {
  const first = { conversation: { _id: "one" }, messages: [{ _id: "private", sequence: 1 }] };
  const next = { conversation: { _id: "two" }, messages: [{ _id: "other", sequence: 1 }] };
  assert.equal(mergeSupportSnapshot(first, next), next);
});

test("AI handoff preserves unanswered customer questions, excludes incomplete AI replies and bounds shared text", () => {
  const history = [
    { role: "user", content: "failed question", status: "failed" },
    { role: "system", content: "not shareable", status: "sent" },
    ...Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `${index}${"x".repeat(2200)}`, status: "sent" })),
  ];
  const context = supportContext(history);
  assert.ok(context.length <= 12);
  assert.ok(context.every((item) => item.content.length <= 2000));
  assert.ok(context.reduce((total, item) => total + item.content.length, 0) <= 18000);
  assert.ok(context.at(-1).content.startsWith("13"));
  assert.deepEqual(supportContext([
    { role: "user", content: "Câu hỏi AI chưa trả lời", status: "failed" },
    { role: "assistant", content: "Incomplete", status: "failed" },
  ]), [{ role: "user", content: "Câu hỏi AI chưa trả lời" }]);
  assert.deepEqual(supportContext([]), []);
});
