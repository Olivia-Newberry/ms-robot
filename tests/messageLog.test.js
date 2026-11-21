import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { makeUser } from "./helpers.js";
import { settings } from "../modules/settings.js";
import { logBulkDelete, logDelete, logEdit } from "../modules/messageLog.js";
import * as jobs from "../modules/jobs.js";
test.after(() => jobs.stopJobs(0));

settings.set("g1", { messageLogChannel: "log1", messageLogIgnore: "ignoredCategory" });
const sent = [];
const logChannel = { id: "log1", name: "mod-log", isTextBased: () => true, permissionsFor: () => ({ has: () => true }), send: async p => { await new Promise(r => setTimeout(r, 30)); sent.push(p); } };
const guild = { id: "g1", name: "Test", members: { me: {} }, channels: { cache: new Map([["log1", logChannel]]) } };
const author = makeUser("111", "someone");
const channel = { id: "c1", parentId: "cat1", isThread: () => false, isTextBased: () => true };
const msg = (id, content, extra = {}) => ({ id, guild, guildId: "g1", channelId: "c1", channel, author, content, partial: false,
  attachments: new Collection(), embeds: [], stickers: new Collection(), createdTimestamp: Date.now(), editedTimestamp: Date.now(), ...extra });
const settle = async () => { jobs.startJobs({ channels: { cache: new Map([["log1", logChannel]]) } }); await new Promise(r => setTimeout(r, 400)); };
const entries = () => sent.flatMap(p => p.embeds.map(e => e.toJSON()));

test("edits, deletes and purges are logged with the user's ID searchable in the text", async () => {
  const before = msg("1", "the meeting is on tuesday");
  logEdit(before, { ...before, content: "the meeting is on thursday" });
  logEdit(before, { ...before });                                       // unfurl/pin: no text change, not logged
  logDelete(msg("2", "you're all wrong"));
  logDelete({ ...msg("3", "in an ignored category"), channel: { ...channel, parentId: "ignoredCategory" } });
  logBulkDelete(new Collection([["a", msg("4", "spam")], ["b", { ...msg("5", null), partial: true }]]));
  await settle();

  assert.deepEqual(entries().map(e => e.title.replace(/^#\d+ · /, "")), ["Message edited", "Message deleted", "2 messages deleted at once"]);
  assert.match(entries()[0].description, /~~tuesday~~ __\*\*thursday\*\*__/);
  assert.match(sent[0].content, /`111`/);
  assert.ok(sent.flatMap(p => p.files).some(f => f.name.startsWith("bulk-delete-")));
});

test("entries that queue up together share a message, with numbered buttons", () => {
  const labels = sent.flatMap(p => p.components.flatMap(r => r.toJSON().components.map(b => b.label)));
  assert.ok(labels.includes("View context #1") && labels.includes("View context #2"));
  assert.deepEqual(sent[0].allowedMentions, { parse: [] });
});

test("entries saved by the discord.js 13 version still send", async () => {
  sent.length = 0;
  jobs.schedule("msglog", {
    channelId: "log1", content: "queued before the upgrade",
    embeds: [{ title: "Message edited", description: "old", color: 1 }],
    components: [{ type: 1, components: [{ type: 2, style: 2, label: "View context", custom_id: "msglog:ctx:c1:9" }] }],
    files: [{ name: "edit-9.diff", data: Buffer.from("- a\n+ b").toString("base64") }],
  }, { lane: "log1" });
  await new Promise(r => setTimeout(r, 300));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].files[0].name, "edit-9.diff");
});
