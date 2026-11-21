// Shared routing for buttons, select menus and modals.
//
// Every interactive component Discord sends back carries a customId (max 100 chars).
// This project packs a handler name and arguments into it:
//
//   "<prefix>:<arg>:<arg>..."     e.g. "msglog:ctx:<channelId>:<messageId>"
//
// index.js loads every file in ./components and registers it by its `prefix`, and
// events/interactionCreate.js hands each click to the matching file. Because all the
// state lives in the customId, buttons keep working after the bot restarts and no
// collector or timeout has to be kept alive.
//
// A handler file looks like:
//
//   export const prefix = "rolebtn";
//   export const conf = { guildOnly: true };            // optional
//   export async function run(client, interaction, args) { ... }
//
// and a command builds its buttons with:
//
//   new ButtonBuilder().setCustomId(componentId("rolebtn", role.id)).setLabel(...)
//
// Anything that won't fit in 100 characters (message text, long lists) has to be
// stored elsewhere and looked up by a short key.

const SEPARATOR = ":";
const MAX_LENGTH = 100;

// Throws instead of trimming: a separator inside an argument would shift every
// argument after it when parsed, and an ID over 100 characters makes Discord reject the
// whole message. Both are better caught when the button is built.
export function componentId(prefix, ...args) {
  const parts = [prefix, ...args.map(String)];
  if (parts.some(p => p.includes(SEPARATOR))) throw new Error(`componentId parts can't contain "${SEPARATOR}": ${parts.join(", ")}`);
  const id = parts.join(SEPARATOR);
  if (id.length > MAX_LENGTH) throw new Error(`componentId is ${id.length} characters, Discord allows ${MAX_LENGTH}: ${id}`);
  return id;
}

export function parseComponentId(customId) {
  const [prefix, ...args] = customId.split(SEPARATOR);
  return { prefix, args };
}
