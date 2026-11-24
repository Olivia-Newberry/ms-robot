// Keyword replies and automatic reactions (commands/partialMessage.js), and the
// !verification hand-off (modules/verification.js).
import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { run } from "../commands/partialMessage.js";
import { getSettings } from "../modules/functions.js";
import { saveOverride } from "../modules/settingsUi.js";
import { importVerificationSettings } from "../modules/verification.js";
import { makeGuild } from "./helpers.js";

async function chat(content, { guildId = "1", channel = "general", channelId = "c1", parentId = null, settings = {}, attachments = 0 } = {}) {
  const out = [];
  await run(null, {
    content, settings, guild: guildId ? { id: guildId } : null,
    attachments: new Collection(Array.from({ length: attachments }, (_, i) => [i, {}])),
    channel: { name: channel, id: channelId, parentId, send: async t => out.push(`send ${t}`) },
    reply: async t => out.push(`reply ${t}`), react: async () => { out.push("react"); },
  });
  return out;
}

const VERIFY = { verificationCommand: "!!verify", verificationHelpChannels: "200000000000000001", verificationHelpMessage: "Read the sticky or message Modmail" };

test("!verification hands off only in servers that set a command", async () => {
  assert.deepEqual(await chat("!verification", { settings: VERIFY }), ["send !!verify"]);
  assert.deepEqual(await chat("! verification please", { settings: VERIFY }), ["send !!verify"]);
  assert.deepEqual(await chat("!verification", { settings: { ...VERIFY, verificationCommand: "false" } }), []);
  assert.deepEqual(await chat("!verification", { settings: {} }), []);
  assert.deepEqual(await chat("!verification", { guildId: null, settings: VERIFY }), []);
});

test("!verification sends the help message in help channels and their threads", async () => {
  const told = ["reply Read the sticky or message Modmail"];
  assert.deepEqual(await chat("!verification", { settings: VERIFY, channelId: "200000000000000001" }), told);
  assert.deepEqual(await chat("!verification", { settings: VERIFY, channelId: "t1", parentId: "200000000000000001" }), told);
});

test("verification settings are copied from .env once, into that server only", () => {
  const env = { VERIFICATION_SERVER_ID: "300000000000000001", VERIFICATION_COMMAND: "!!verify", VERIFICATION_HELP_CHANNELS: "Mossy, newcomers", VERIFICATION_HELP_MESSAGE: "Read the sticky or message Modmail" };
  const channels = [{ id: "400000000000000001", name: "mossy" }, { id: "400000000000000002", name: "general" }];
  const other = makeGuild({ id: "300000000000000002", channels });
  assert.deepEqual(importVerificationSettings(other, env), []);
  assert.equal(getSettings(other).verificationCommand, "false");

  const guild = makeGuild({ id: env.VERIFICATION_SERVER_ID, channels });
  const done = importVerificationSettings(guild, env);
  assert.match(done.join("; "), /help channels #mossy \(400000000000000001\)/);
  assert.match(done.join("; "), /no channel named "newcomers"/);
  const s = getSettings(guild);
  assert.equal(s.verificationCommand, "!!verify");
  assert.equal(s.verificationHelpChannels, "400000000000000001");
  assert.equal(s.verificationHelpMessage, "Read the sticky or message Modmail");

  // Turned off later in /settings: a restart with .env unchanged leaves it off.
  saveOverride(guild.id, "verificationCommand", "false");
  assert.deepEqual(importVerificationSettings(guild, env), []);
  assert.equal(getSettings(guild).verificationCommand, "false");
});

test("minecraft reactions follow the server's chance", async (t) => {
  t.mock.method(Math, "random", () => 0.5);   // a roll of 50
  assert.deepEqual(await chat("minecraft!", { settings: { minecraftReactChance: "60" } }), ["react"]);
  assert.deepEqual(await chat("minecraft!", { settings: { minecraftReactChance: "40" } }), []);
  assert.deepEqual(await chat("minecraft!", { settings: { minecraftReactChance: "0" } }), []);
  // A value typed wrong with /set falls back to the default (always) instead of off.
  assert.deepEqual(await chat("minecraft!", { settings: { minecraftReactChance: "lots" } }), ["react"]);
});

test("selfie reactions are a toggle and need a picture", async () => {
  assert.deepEqual(await chat("look", { channel: "selfies", attachments: 1 }), ["react"]);
  assert.deepEqual(await chat("look", { channel: "selfies", attachments: 1, settings: { selfieReact: "false" } }), []);
  assert.deepEqual(await chat("look", { channel: "selfies" }), []);
});
