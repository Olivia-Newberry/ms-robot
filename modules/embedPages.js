// Turns long lists into as many embeds and messages as they need, so a reply can't fail
// Discord's length limits however many entries a server has.
//
//   const messages = listMessages([{ title: "Can be assigned", lines: [...] }, ...]);
//   await interaction.reply({ ...messages[0], flags });
//   for (const m of messages.slice(1)) await interaction.followUp({ ...m, flags });
//
// Embeds rather than message text: a message's text holds 2,000 characters, an embed's
// description 4,096, and role and channel mentions in an embed never ping anyone.

import { EmbedBuilder } from "discord.js";

// Discord's limits, with a little room for the "(continued)" titles.
const PER_EMBED = 4000;
const PER_MESSAGE = 5800;
const EMBEDS_PER_MESSAGE = 10;

// sections: [{ title, lines, empty }]. Each section starts a new embed, and one too long
// for an embed carries on in the next with "(continued)" in its title. Lines are never
// split; one longer than an embed (not expected) is cut.
export function listMessages(sections) {
  const embeds = [];
  for (const { title, lines, empty = "*none*" } of sections) {
    let page = [], length = 0, part = 0;
    const flush = () => {
      const heading = part++ ? `${title} (continued)` : title;
      embeds.push(new EmbedBuilder().setTitle(heading.slice(0, 256)).setDescription(page.length ? page.join("\n") : empty));
      page = []; length = 0;
    };
    for (const raw of lines) {
      const line = raw.length > PER_EMBED ? `${raw.slice(0, PER_EMBED - 1)}…` : raw;
      if (page.length && length + line.length + 1 > PER_EMBED) flush();
      page.push(line); length += line.length + 1;
    }
    flush();
  }

  const messages = [];
  let current = [], size = 0;
  for (const embed of embeds) {
    const embedSize = embed.data.title.length + embed.data.description.length;
    if (current.length && (current.length === EMBEDS_PER_MESSAGE || size + embedSize > PER_MESSAGE)) {
      messages.push({ embeds: current }); current = []; size = 0;
    }
    current.push(embed); size += embedSize;
  }
  if (current.length) messages.push({ embeds: current });
  return messages;
}
