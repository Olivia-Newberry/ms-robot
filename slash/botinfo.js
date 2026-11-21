export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  await interaction.reply({
    embeds: [{
      title: "about ms robot",
      description: "ms robot is a bot that is managed and hosted by @cyndergosa\nIf you wish to suggest changes, send me a DM or open a pull request or issue requesting update over at github\n",
      fields: [
        { name: "Github", value: "[Link](https://github.com/Olivia-Newberry/ms-robot/)", inline: true },
        { name: "Discord Invite", value: "[Link](https://discord.com/api/oauth2/authorize?client_id=719912462631305217&permissions=8&scope=applications.commands%20bot)", inline: true },
      ],
      footer: { text: "ms robot" },
    }],
  });
}

export const commandData = { name: "botinfo", description: "GitHub and invite links", options: [] };

export const conf = { permLevel: "User", guildOnly: false, category: "Miscellaneous", replaces: ["botinfo"] };
