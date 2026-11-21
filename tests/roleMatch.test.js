// Telling apart roles whose names look the same: "Verified", "verified", "vҽrified".
import "./setup/tempDataDir.js";   // first
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "discord.js";
import { loadContainer, makeGuild, makeInteraction, makeUser } from "./helpers.js";
import interactionCreate from "../events/interactionCreate.js";
import { permlevel } from "../modules/functions.js";
import { settings } from "../modules/settings.js";
import { lookalikes, resolveRole, resolveRoles, roleChoices, skeleton } from "../modules/roleMatch.js";
import { getSettings } from "../modules/functions.js";
import { migrateRoleSettings } from "../modules/settingsUi.js";

const UPPER = "300000000000000001", LOWER = "300000000000000002", CYRILLIC = "300000000000000003", MOD = "300000000000000004";
const role = (id, name, position) => ({ id, name, position, managed: false, toString: () => `<@&${id}>`, members: new Collection(), comparePositionTo: (o) => position - o.position, permissions: { has: () => false } });
const guild = makeGuild({ ownerId: "0", roles: [role(UPPER, "Verified", 1), role(LOWER, "verified", 2), role(CYRILLIC, "vҽrified", 3), role(MOD, "moderator", 4), role("300000000000000099", "ms robot", 9)] });
guild.members.me = { permissions: { has: () => true }, roles: { highest: guild.roles.cache.get("300000000000000099") } };

test("lookalike names have the same shape", () => {
  assert.equal(skeleton("vҽrified"), skeleton("Verified"));
  assert.deepEqual(lookalikes(guild, guild.roles.cache.get(UPPER)).map(r => r.id).sort(), [LOWER, CYRILLIC]);
});

test("a typed role option picks one role, never a guess", () => {
  assert.equal(resolveRole(guild, CYRILLIC).name, "vҽrified");
  assert.equal(resolveRole(guild, "verified").id, LOWER);          // exact name wins
  assert.equal(resolveRole(guild, "VERIFIED"), null);              // two roles match without capitals
});

test("role settings: listed IDs, or for old names every role matching in any capitals", () => {
  const ids = (value) => resolveRoles(guild, value).map(r => r.id).sort();
  assert.deepEqual(ids(`${UPPER},${CYRILLIC}`), [UPPER, CYRILLIC].sort());
  assert.deepEqual(ids("VERIFIED"), [UPPER, LOWER].sort());      // as before: not the Cyrillic one
  assert.deepEqual(ids("Moderator"), [MOD]);
  assert.deepEqual(ids("false"), []);
});

test("permission levels count any listed role, and only those", () => {
  const member = (roleIds) => ({ roles: { cache: new Collection(roleIds.map(id => [id, {}])) } });
  const level = (roleIds, conf) => permlevel({ guild, member: member(roleIds), author: makeUser("5"), settings: { verifiedRole: "false", modRole: "Moderator", adminRole: "Administrator", ...conf } });
  assert.equal(level([CYRILLIC], { modRole: `${UPPER},${LOWER}` }), 0, "the lookalike doesn't count");
  assert.equal(level([LOWER], { modRole: `${UPPER},${LOWER}` }), 2);
  assert.equal(level([UPPER], { modRole: "verified" }), 2, "an old name still covers both capitalisations");
  assert.equal(level([MOD], {}), 2, "default name, role named in lowercase");
});

test("old names are converted to the IDs of the roles they match, unmatched names left alone", () => {
  settings.set("g1", { modRole: "VERIFIED", verifiedRole: "Not created yet" });
  const converted = migrateRoleSettings(guild);
  // adminRole is the default "Administrator", which matches no role here either.
  assert.equal(converted.length, 1);
  assert.equal(getSettings("g1").modRole, `${UPPER},${LOWER}`);
  assert.equal(getSettings("g1").verifiedRole, "Not created yet");
  assert.equal(getSettings("g1").adminRole, "Administrator");
  assert.deepEqual(migrateRoleSettings(guild), [], "running it again changes nothing");
});

test("role suggestions show what tells lookalikes apart", () => {
  const choices = roleChoices(guild, "verified");
  assert.equal(choices.length, 3);
  for (const c of choices) {
    assert.match(c.name, /ID \d{18} · ⚠ lookalike$/);
    assert.match(c.value, /^\d{18}$/);
  }
  assert.deepEqual(roleChoices(guild, "", { only: [LOWER] }).map(c => c.value), [LOWER]);
});

test("/addrole suggests only assignable roles and gives exactly the one picked", async () => {
  const container = await loadContainer();
  settings.set("g1", { assignableRoles: `${LOWER} ${CYRILLIC}`, roleManagerRoles: MOD });
  const target = { id: "7", user: makeUser("7", "target"), roles: { cache: new Collection(), add: async (r) => target.roles.cache.set(r.id, r) } };
  const manager = { id: "6", roles: { cache: new Collection([[MOD, {}]]) }, permissions: { has: () => true } };
  const run = async (extra) => {
    const i = makeInteraction({ commandName: "addrole", user: makeUser("6"), member: manager, guild, ...extra });
    await interactionCreate({ container }, i);
    return i;
  };
  const suggest = await run({ focused: "verified" });
  assert.deepEqual(suggest.replies[0].payload.map(c => c.value).sort(), [LOWER, CYRILLIC]);

  const given = await run({ options: { user: target, role: CYRILLIC } });
  assert.deepEqual([...target.roles.cache.keys()], [CYRILLIC]);
  assert.match(given.last, new RegExp(`<@&${CYRILLIC}> \\(\`${CYRILLIC}\`\\)`));
  assert.match((await run({ options: { user: target, role: "VERIFIED" } })).last, /3 roles are called something like/);
});
