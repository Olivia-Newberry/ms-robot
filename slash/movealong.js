export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.reply("https://youtu.be/_Wx98AolMQw");
}

export const commandData = { name: "movealong", description: "Nothing to see here", options: [] };

export const conf = { permLevel: "User", guildOnly: false, category: "Fun", replaces: ["movealong"] };
