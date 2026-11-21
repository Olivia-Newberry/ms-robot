// Runs arbitrary JavaScript as the bot. Bot Owner only, because it can do anything the
// bot's process can: read the token, the database, or files on the machine.

import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits, codeBlock } from "discord.js";
import util from "util";

// Stops output from pinging @everyone or leaking the token, and from closing the code
// block early.
function clean(client, value) {
  const text = typeof value === "string" ? value : util.inspect(value, { depth: 1 });
  return text
    .replace(/`/g, "`​")
    .replace(/@/g, "@​")
    .replaceAll(client.token, "[REDACTED]");
}

export async function run(client, interaction) {
  const code = interaction.options.getString("code");
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let result;
  try {
    result = await eval(code);
  } catch (e) {
    result = e;
  }
  // 2000 is the message limit; the rest is the code block around it.
  await interaction.editReply(codeBlock("js", clean(client, result).slice(0, 1980)));
}

export const commandData = {
  name: "eval",
  description: "Evaluates arbitrary JavaScript.",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [{ name: "code", description: "The code", type: ApplicationCommandOptionType.String, required: true }],
};

export const conf = { permLevel: "Bot Owner", guildOnly: true, category: "System", replaces: ["eval"] };
