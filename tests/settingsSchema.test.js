import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { normalize, pagesFor } from "../modules/settingsSchema.js";

const LOG = "111111111111111111";
const guild = {
  channels: { cache: new Collection([[LOG, { id: LOG, name: "message-log" }]]) },
  roles: { cache: new Collection([["222222222222222222", { id: "222222222222222222", name: "Mods" }]]) },
};

test("true/false settings accept common spellings and reject typos", () => {
  for (const yes of ["true", "yes", "on", "1", "TRUE"]) assert.deepEqual(normalize("selfieReact", yes), { value: "true" });
  for (const no of ["false", "no", "off", "0"]) assert.deepEqual(normalize("selfieReact", no), { value: "false" });
  assert.ok(normalize("selfieReact", "ture").error);
});

test("percentages", () => {
  assert.deepEqual(normalize("minecraftReactChance", "40%"), { value: "40" });
  assert.ok(normalize("minecraftReactChance", "150").error);
  assert.ok(normalize("minecraftReactChance", "lots").error);
});

test("channel settings take a mention or ID that exists, or off", () => {
  assert.deepEqual(normalize("messageLogChannel", `<#${LOG}>`, guild), { value: LOG });
  assert.deepEqual(normalize("messageLogChannel", "off", guild), { value: "false" });
  assert.ok(normalize("messageLogChannel", "999999999999999999", guild).error);
  assert.ok(normalize("messageLogIgnore", `${LOG} general`, guild).error);
});

test("channel-name settings turn a pasted mention into the name the bot matches on", () => {
  assert.deepEqual(normalize("welcomeChannel", `<#${LOG}>`, guild), { value: "message-log" });
});

test("role settings store IDs; a name means every role with that name in any capitals", () => {
  assert.deepEqual(normalize("modRole", "<@&222222222222222222>", guild), { value: "222222222222222222" });
  assert.deepEqual(normalize("modRole", "Mods", guild), { value: "222222222222222222" });
  assert.deepEqual(normalize("verifiedRole", "none", guild), { value: "false" });
  const lookalikes = { roles: { cache: new Collection([
    ["300000000000000001", { id: "300000000000000001", name: "Verified" }],
    ["300000000000000002", { id: "300000000000000002", name: "verified" }],
    ["300000000000000003", { id: "300000000000000003", name: "vҽrified" }],
  ]) } };
  // Both capitalisations, as names always matched; the Cyrillic lookalike never did.
  assert.deepEqual(normalize("verifiedRole", "VERIFIED", lookalikes), { value: "300000000000000001,300000000000000002" });
  assert.deepEqual(normalize("verifiedRole", "<@&300000000000000003>, 300000000000000001", lookalikes), { value: "300000000000000003,300000000000000001" });
  assert.match(normalize("verifiedRole", "nothing like it", lookalikes).error, /doesn't match any role/);
});

test("every form page fits Discord's 5-field limit, and custom keys get their own page", () => {
  const pages = pagesFor(["prefix", "commandReply", "selfieReact", "a", "b", "c", "d", "e", "f"]);
  assert.ok(pages.every(p => p.keys.length <= 5));
  assert.deepEqual(pages.filter(p => p.title.startsWith("Other")).flatMap(p => p.keys), ["a", "b", "c", "d", "e", "f"]);
});
