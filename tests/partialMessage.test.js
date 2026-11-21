// Keyword replies and automatic reactions (commands/partialMessage.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { run } from "../commands/partialMessage.js";

async function chat(content, { guildId = "1", channel = "general", settings = {}, attachments = 0 } = {}) {
  const out = [];
  await run(null, {
    content, settings, guild: guildId ? { id: guildId } : null,
    attachments: new Collection(Array.from({ length: attachments }, (_, i) => [i, {}])),
    channel: { name: channel, send: async t => out.push(`send ${t}`) },
    reply: async t => out.push(`reply ${t}`), react: async () => { out.push("react"); },
  });
  return out;
}

test("!verification only answers in its own server", async () => {
  assert.deepEqual(await chat("!verification", { guildId: "438306949285806082" }), ["send !!verify"]);
  assert.deepEqual(await chat("!verification", { guildId: "438306949285806082", channel: "newcomers" }), ["reply Please read the sticky message or try messaging Sora"]);
  assert.deepEqual(await chat("!verification", { guildId: "1" }), []);
  assert.deepEqual(await chat("!verification", { guildId: null }), []);
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
