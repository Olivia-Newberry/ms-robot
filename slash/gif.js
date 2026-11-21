import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import config from "../config.js";
import { getJson, randomColor } from "../modules/fun.js";

// Picks among the first few results so the same search gives some variety without
// drifting into barely related gifs.
const PICK_FROM = 10;

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const search = interaction.options.getString("search");
  if (!config.giphyApiKey) {
    return interaction.reply({ content: "GIF search isn't set up on this bot yet (it needs a Giphy API key).", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply();
  const query = new URLSearchParams({ api_key: config.giphyApiKey, q: search, rating: "pg-13", limit: String(PICK_FROM) });
  const { data } = await getJson(`https://api.giphy.com/v1/gifs/search?${query}`);
  if (!data?.length) {
    return interaction.editReply({ embeds: [{ color: randomColor(), description: "🎬 Sorry I can't find a gif related to your keywords." }] });
  }
  const gif = data[Math.floor(Math.random() * data.length)];
  await interaction.editReply({
    embeds: [{ color: randomColor(), description: `${interaction.user} ${search}`, image: { url: gif.images.original.url } }],
  });
}

export const commandData = {
  name: "gif",
  description: "Grab a random gif from Giphy matching your description",
  options: [{ name: "search", description: "What to search for", type: ApplicationCommandOptionType.String, required: true, maxLength: 200 }],
};

export const conf = { permLevel: "User", guildOnly: false, category: "Fun", replaces: ["gif"] };
