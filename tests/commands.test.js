// Every slash command definition is something Discord will accept.
import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApplicationCommandManager, ApplicationCommandOptionType as T } from "discord.js";
import { loadContainer } from "./helpers.js";
const NAME = /^[-_\p{L}\p{N}]{1,32}$/u;

function checkOptions(where, options = []) {
  assert.ok(options.length <= 25, `${where}: more than 25 options`);
  let optionalSeen = false;
  for (const o of options) {
    assert.ok(NAME.test(o.name) && o.name === o.name.toLowerCase(), `${where}.${o.name}: bad name`);
    assert.ok(o.description?.length >= 1 && o.description.length <= 100, `${where}.${o.name}: description length`);
    if (o.type === T.Subcommand || o.type === T.SubcommandGroup) { checkOptions(`${where} ${o.name}`, o.options); continue; }
    if (o.required) assert.ok(!optionalSeen, `${where}.${o.name}: required option after an optional one`);
    else optionalSeen = true;
    assert.ok(!(o.choices && o.autocomplete), `${where}.${o.name}: can't have both choices and autocomplete`);
  }
}

test("every slash command is one Discord accepts", async (t) => {
  const container = await loadContainer();
  for (const [name, command] of container.slashcmds) await t.test(`/${name}`, () => {
    const d = command.commandData;
    assert.equal(typeof command.run, "function");
    assert.ok(command.conf.permLevel in container.levelCache, "unknown permLevel");
    assert.ok(NAME.test(d.name) && d.name === d.name.toLowerCase());
    assert.ok(d.description.length >= 1 && d.description.length <= 100, "description length");
    assert.ok(!("defaultPermission" in d), "defaultPermission is deprecated");
    if (JSON.stringify(d.options ?? []).includes("\"autocomplete\":true")) assert.equal(typeof command.autocomplete, "function");
    checkOptions(name, d.options);
    ApplicationCommandManager.transformCommand(d);   // throws on anything discord.js can't send
  });
});

test("no two slash commands claim the same old prefix name", async () => {
  const container = await loadContainer();
  const claimed = new Map();
  for (const [name, c] of container.slashcmds) {
    const rep = c.conf.replaces ?? [];
    for (const old of Array.isArray(rep) ? rep : Object.keys(rep)) {
      assert.ok(!claimed.has(old), `"${old}" claimed by /${claimed.get(old)} and /${name}`);
      claimed.set(old, name);
    }
  }
});
