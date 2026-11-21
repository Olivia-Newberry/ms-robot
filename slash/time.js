import { randomColor } from "../modules/fun.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.reply({
    embeds: [{
      title: "Current time",
      description: `The current time is: <t:${Math.floor(Date.now() / 1000)}>`,
      color: randomColor(),
      // The query string stops Discord's image cache from showing a stale copy.
      image: { url: `https://imgs.xkcd.com/comics/now.png?${Date.now()}` },
    }],
  });
}

export const commandData = { name: "time", description: "Displays a map of timezones", options: [] };

export const conf = { permLevel: "User", guildOnly: true, category: "Fun", replaces: ["time"] };
