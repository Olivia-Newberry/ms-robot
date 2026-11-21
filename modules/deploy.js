// Registers the slash commands with Discord. Runs on every startup (events/clientReady.js),
// so commands appear in every server without anyone typing a command first; that used
// to need !deploy, which itself needs the Message Content intent. /deploy and !deploy
// force a re-register.
//
// Everything is registered globally, which covers every server the bot is in or joins
// later. Commands that only make sense in a server are marked with the Guild context, so
// Discord hides them in DMs; that replaces registering them per server.

import { InteractionContextType } from "discord.js";

const SERVER_ONLY = [InteractionContextType.Guild];
const ANYWHERE = [InteractionContextType.Guild, InteractionContextType.BotDM];

function definitions(client) {
  return client.container.slashcmds.map(c => ({ ...c.commandData, contexts: c.conf.guildOnly ? SERVER_ONLY : ANYWHERE }));
}

// Returns { count, updated, cleared }.
export async function deployCommands(client, { force = false } = {}) {
  const wanted = definitions(client);
  const existing = await client.application.commands.fetch();
  // Re-registering when nothing changed is harmless but slow, and Discord limits how
  // many commands an app can create per day, so it's skipped unless something differs.
  const unchanged = !force && existing.size === wanted.length
    && wanted.every(def => existing.find(c => c.name === def.name)?.equals(def));
  if (!unchanged) await client.application.commands.set(wanted);
  // Named in the result so the startup log shows exactly what changed, e.g. that a new
  // command reached Discord.
  const before = new Set(existing.map(c => c.name)), after = new Set(wanted.map(d => d.name));
  const added = [...after].filter(n => !before.has(n));
  const removed = [...before].filter(n => !after.has(n));

  // Older versions registered server-only commands in each server separately. Left in
  // place they'd show up twice next to the global ones, so they're removed. Only done
  // when something changed (or on a forced deploy) to avoid a request per server on
  // every restart.
  let cleared = 0;
  if (!unchanged) {
    for (const guild of client.guilds.cache.values()) {
      const old = await guild.commands.fetch().catch(() => null);
      if (old?.size) {
        await guild.commands.set([]).catch(() => null);
        cleared++;
      }
    }
  }
  return { count: wanted.length, updated: !unchanged, cleared, added, removed };
}

export function describeDeploy({ count, updated, cleared, added = [], removed = [] }) {
  if (!updated) return `all ${count} already up to date.`;
  const changes = [
    added.length && `new: /${added.join(", /")}`,
    removed.length && `removed: /${removed.join(", /")}`,
    cleared && `cleared old per-server copies from ${cleared} server${cleared === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `registered all ${count}${changes.length ? ` (${changes.join("; ")})` : ""}.`;
}
