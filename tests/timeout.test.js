// /timeout: members timing themselves out.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { loadContainer, makeComponentInteraction, makeGuild, makeInteraction, makeUser } from "./helpers.js";
import interactionCreate from "../events/interactionCreate.js";
import { settings } from "../modules/settings.js";

let container;
before(async () => { container = await loadContainer(); });

const guild = makeGuild({ ownerId: "1" });
guild.members.me = { permissions: { has: () => true } };
function makeMember(id, { admin = false, moderatable = true } = {}) {
  const member = {
    id, guild, user: makeUser(id), moderatable, timedOut: null,
    roles: { cache: new Map() },
    permissions: { has: (flag) => admin && flag === PermissionFlagsBits.Administrator },
    isCommunicationDisabled: () => Boolean(member.timedOut),
    timeout: async (ms, reason) => { member.timedOut = { ms, reason }; member.communicationDisabledUntilTimestamp = Date.now() + ms; },
  };
  return member;
}
const command = async (member, options = {}) => {
  const i = makeInteraction({ commandName: "timeout", user: member.user, member, guild, options });
  await interactionCreate({ container }, i);
  return i;
};
const click = async (customId, member) => {
  const i = makeComponentInteraction({ customId, user: member.user, member, guild });
  await interactionCreate({ container }, i);
  return i.last;
};

test("asks first, then times out with the reason shown in the audit log (default 10 minutes)", async () => {
  const member = makeMember("10");
  const ask = await command(member);
  assert.match(ask.last, /10 minutes/);
  assert.equal(member.timedOut, null, "nothing happens until confirmed");
  const [confirm] = ask.replies[0].payload.components[0].components.map(b => b.data.custom_id);
  assert.match(await click(confirm, member), /timed out for 10 minutes/);
  assert.deepEqual(member.timedOut, { ms: 600_000, reason: "Self requested with /timeout for 10 minutes" });
});

test("chosen duration, and cancel does nothing", async () => {
  const member = makeMember("11");
  const ask = await command(member, { duration: 120 });
  const [confirm, cancel] = ask.replies[0].payload.components[0].components.map(b => b.data.custom_id);
  assert.match(await click(cancel, member), /Cancelled/);
  assert.equal(member.timedOut, null);
  await click(confirm, member);
  assert.equal(member.timedOut.reason, "Self requested with /timeout for 2 hours");
});

test("only the person who asked can confirm", async () => {
  const asker = makeMember("12"), other = makeMember("13");
  const [confirm] = (await command(asker)).replies[0].payload.components[0].components.map(b => b.data.custom_id);
  assert.match(await click(confirm, other), /isn't your timeout/);
  assert.equal(asker.timedOut, null);
  assert.equal(other.timedOut, null);
});

test("explains when Discord wouldn't allow it", async () => {
  assert.match((await command(makeMember("1"))).last, /server owner/);
  assert.match((await command(makeMember("14", { admin: true }))).last, /Administrator/);
  assert.match((await command(makeMember("15", { moderatable: false }))).last, /at or above mine/);
});

test("servers can turn it off, and that's checked again on confirm", async () => {
  const member = makeMember("16");
  const [confirm] = (await command(member)).replies[0].payload.components[0].components.map(b => b.data.custom_id);
  settings.set("g1", { selfTimeout: "false" });
  assert.match(await click(confirm, member), /turned off/);
  assert.equal(member.timedOut, null);
  assert.match((await command(member)).last, /turned off/);
});
