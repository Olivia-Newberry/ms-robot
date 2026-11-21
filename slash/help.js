import { MessageFlags } from "discord.js";
import { permlevel } from "../modules/functions.js";

export async function run(client, interaction) {
  const { container } = client;
  const level = permlevel(interaction);
  // Only what this person can run here, so the list doesn't advertise commands that
  // would just refuse them.
  const mine = container.slashcmds.filter(c =>
    container.levelCache[c.conf.permLevel] <= level && (interaction.inGuild() || !c.conf.guildOnly));

  const byCategory = new Map();
  for (const c of [...mine.values()].sort((a, b) => a.commandData.name.localeCompare(b.commandData.name))) {
    const category = c.conf.category ?? "Other";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(`\`/${c.commandData.name}\` ${c.commandData.description}`);
  }

  const fields = [...byCategory].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, lines]) => ({ name, value: lines.join("\n").slice(0, 1024) }));
  await interaction.reply({
    embeds: [{ title: "Commands", description: "Type `/` to see these with their options.", fields }],
    flags: MessageFlags.Ephemeral,
  });
}

export const commandData = { name: "help", description: "List the commands you can use.", options: [] };

export const conf = { permLevel: "User", guildOnly: false, category: "System", replaces: ["help", "h", "halp"] };
