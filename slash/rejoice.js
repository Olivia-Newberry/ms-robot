export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.reply("https://youtu.be/NmPhaG1ud38");
}

export const commandData = { name: "rejoice", description: "Rejoice!", options: [] };

export const conf = { permLevel: "User", guildOnly: false, category: "Fun", replaces: ["rejoice"] };
