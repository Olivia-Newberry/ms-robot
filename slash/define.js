import { ApplicationCommandOptionType } from "discord.js";
import { getJson, randomColor } from "../modules/fun.js";

// Embed fields hold 1024 characters and Urban Dictionary entries can be much longer.
const trim = (text, max) => text.length > max ? `${text.slice(0, max - 3)}...` : text;

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const term = interaction.options.getString("term");
  await interaction.deferReply();
  const { list } = await getJson(`https://api.urbandictionary.com/v0/define?${new URLSearchParams({ term })}`);
  if (!list) return interaction.editReply("There was an error fetching any results.");
  if (!list.length) return interaction.editReply(`No results found for **${term}**.`);

  const [answer] = list;
  await interaction.editReply({
    embeds: [{
      color: randomColor(),
      description: `**${answer.word}**\n\nCommand issued by ${interaction.user.tag}`,
      url: answer.permalink,
      fields: [
        { name: "Definition", value: trim(answer.definition, 1024) || "-", inline: false },
        { name: "Example", value: trim(answer.example, 1024) || "-", inline: true },
      ],
      footer: { text: `👍 ${answer.thumbs_up} | 👎 ${answer.thumbs_down}` },
    }],
  });
}

export const commandData = {
  name: "define",
  description: "Grab the Urban Dictionary definition for something",
  options: [{ name: "term", description: "What to look up", type: ApplicationCommandOptionType.String, required: true, maxLength: 200 }],
};

export const conf = { permLevel: "User", guildOnly: false, category: "Fun", replaces: ["define"] };
