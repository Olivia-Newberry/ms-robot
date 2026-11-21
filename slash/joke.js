import { getJson, initiatedBy, randomColor } from "../modules/fun.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.deferReply();
  // icanhazdadjoke asks callers to name themselves in the User-Agent, and only returns
  // JSON when asked for it.
  const { joke } = await getJson("https://icanhazdadjoke.com/", { Accept: "application/json", "User-Agent": "ms-robot Discord bot" });
  await interaction.editReply({ embeds: [{ title: joke, color: randomColor(), footer: initiatedBy(interaction.user) }] });
}

export const commandData = { name: "joke", description: "Tells a bad joke", options: [] };

export const conf = { permLevel: "User", guildOnly: false, category: "Fun", replaces: ["joke", "funny"] };
