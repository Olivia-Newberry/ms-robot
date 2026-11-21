// Emoji reactions on role panels (see modules/rolePanels.js). Needs the Reaction and
// User partials in config.js so reactions on messages from before a restart arrive.

import { error } from "../modules/Logger.js";
import { emojiKey, panelForMessage, pick } from "../modules/rolePanels.js";

export default async (client, reaction, user) => {
  try {
    // Partial users (not cached since the restart) don't say whether they're a bot.
    if (user.partial) user = await user.fetch();
    if (user.bot) return;
    const panel = panelForMessage(reaction.message.id);
    if (panel?.style !== "reactions") return;
    if (reaction.partial) reaction = await reaction.fetch();

    const entry = panel.roles.find(e => emojiKey(e.emoji) === emojiKey(reaction.emoji));
    // Anything else would sit on the panel looking like an option.
    if (!entry) return void await reaction.users.remove(user.id).catch(() => null);

    const member = await reaction.message.guild.members.fetch(user.id);
    // Reacting means "I want this role", so a reaction on a role they already have
    // (e.g. one they had before the panel) shouldn't take it away.
    if (member.roles.cache.has(entry.roleId)) return;
    const { result, text, removed } = await pick(member, panel, entry.roleId);

    if (result === "refused") {
      // A reaction has no private reply, so the reason goes by DM, if they accept DMs,
      // and the reaction is taken back so it doesn't look like it worked. Role mentions
      // don't display in DMs, so they're written out as names.
      await reaction.users.remove(user.id).catch(() => null);
      await user.send(`${text.replace(/<@&([^>]+)>/g, (m, id) => `@${member.guild.roles.cache.get(id)?.name ?? "deleted role"}`)} (${member.guild.name})`).catch(() => null);
      return;
    }
    // Pick-one: take back their reactions for the roles that were swapped out.
    for (const roleId of removed) {
      const old = panel.roles.find(e => e.roleId === roleId);
      const oldReaction = reaction.message.reactions.cache.find(r => emojiKey(r.emoji) === emojiKey(old?.emoji));
      await oldReaction?.users.remove(user.id).catch(() => null);
    }
  } catch (e) {
    error(`Role panel reaction failed: ${e.message}`);
  }
};
