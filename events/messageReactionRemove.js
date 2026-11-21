// Taking a reaction off a role panel removes the role (see messageReactionAdd.js).

import { error } from "../modules/Logger.js";
import { emojiKey, panelForMessage } from "../modules/rolePanels.js";

export default async (client, reaction, user) => {
  try {
    // Partial users (not cached since the restart) don't say whether they're a bot.
    if (user.partial) user = await user.fetch();
    if (user.bot) return;
    const panel = panelForMessage(reaction.message.id);
    if (panel?.style !== "reactions") return;
    const entry = panel.roles.find(e => emojiKey(e.emoji) === emojiKey(reaction.emoji));
    if (!entry) return;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    // Also runs when the bot takes back a swapped-out or refused reaction; by then the
    // role is already gone (or was never given), so there's nothing to do.
    if (member?.roles.cache.has(entry.roleId)) await member.roles.remove(entry.roleId, `Role panel: ${panel.title}`.slice(0, 512));
  } catch (e) {
    error(`Role panel reaction removal failed: ${e.message}`);
  }
};
