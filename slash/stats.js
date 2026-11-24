import { codeBlock, version } from "discord.js";
import { DurationFormatter } from "@sapphire/time-utilities";
import os from "os";
import { permlevel } from "../modules/functions.js";
import { countMembers, describeMembers } from "../modules/memberCounts.js";
import { cacheSize } from "../modules/messageCache.js";
import { heapUsage, hostMemory, mb, serviceMemory } from "../modules/hostMemory.js";
import { limitSource } from "../modules/nodeHeap.js";
import config from "../config.js";
const durationFormatter = new DurationFormatter();

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.deferReply();

  const duration = durationFormatter.format(client.uptime);
  const heap = heapUsage();
  const members = describeMembers(countMembers(client.guilds.cache.values())).join("\n");
  // Memory, cache and versions are for the people running the bot: Bot Support, Bot
  // Admin and Bot Owner (level 8 and up).
  if (permlevel(interaction) < client.container.levelCache["Bot Support"]) {
    return interaction.editReply(codeBlock("asciidoc", `= STATISTICS =
• Mem Usage  :: ${mb(heap.used)}
• Uptime     :: ${duration}
${members}
• Servers    :: ${client.guilds.cache.size.toLocaleString()}
• Channels   :: ${client.channels.cache.size.toLocaleString()}`));
  }
  // For tuning messageCache in config.js against what the bot really holds, and what
  // the server (possibly shared with other bots) has left. Services in MONITOR_SERVICES
  // that the bot can't see are left out.
  const cached = cacheSize(client.channels.cache.values());
  const host = hostMemory();
  const services = config.monitorServices.map(name => {
    const bytes = serviceMemory(name);
    if (bytes === null) return "";
    const label = name.replace(/\.service$/, "");
    return `\n• ${(label[0].toUpperCase() + label.slice(1)).padEnd(11).slice(0, 11)}:: ${mb(bytes)}`;
  }).join("");
  const stats = codeBlock("asciidoc", `= STATISTICS =
• Mem Usage  :: ${mb(heap.used)} (whole process ${mb(process.memoryUsage().rss)})
• Mem Limit  :: ${mb(heap.limit)} (${limitSource()})
• Msg Cache  :: ${cached.messages.toLocaleString()} messages, ~${mb(cached.bytes)}
• Server     :: ${mb(host.available)} available of ${mb(host.total)} (${Math.round(host.used / host.total * 100)}% used)${services}
• Server Up  :: ${durationFormatter.format(os.uptime() * 1000)}
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