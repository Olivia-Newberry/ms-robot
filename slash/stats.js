import { codeBlock, version } from "discord.js";
import { DurationFormatter } from "@sapphire/time-utilities";
import { permlevel } from "../modules/functions.js";
import { countMembers, describeMembers } from "../modules/memberCounts.js";
const durationFormatter = new DurationFormatter();

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.deferReply();

  const duration = durationFormatter.format(client.uptime);
  const members = describeMembers(countMembers(client.guilds.cache.values())).join("\n");
  // Limit display when not Bot Owner
  if (permlevel(interaction) < client.container.levelCache["Bot Owner"]) {
    return interaction.editReply(codeBlock("asciidoc", `= STATISTICS =
• Mem Usage  :: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• Uptime     :: ${duration}
${members}
• Servers    :: ${client.guilds.cache.size.toLocaleString()}
• Channels   :: ${client.channels.cache.size.toLocaleString()}`));
  }
  const stats = codeBlock("asciidoc", `= STATISTICS =
• Mem Usage  :: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• Uptime     :: ${duration}
${members}
• Servers    :: ${client.guilds.cache.size.toLocaleString()}
• Channels   :: ${client.channels.cache.size.toLocaleString()}
• Discord.js :: v${version}
• Node       :: ${process.version}`);
  await interaction.editReply(stats);
}

export const commandData = {
  name: "stats",
  description: "Show's the bots stats.",
  options: [],
};

export const conf = {
  permLevel: "User",
  guildOnly: true,
  category: "Miscellaneous",
  replaces: ["stats"],
};