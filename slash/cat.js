const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.run = async (client, interaction) => { // eslint-disable-line no-unused-vars

    
  const factEmbed = {
    description: "Waiting on picture",
    title: "Waiting for fact",
    //random color
    color: Math.floor(Math.random() * 16777215).toString(16),
  };
  await interaction.deferReply();
  await interaction.editReply({embeds: [factEmbed]});

  const { link } = await fetch('https://some-random-api.ml/img/cat').then(response => response.json());
  const cat = link;
  const { fact } = await fetch('https://some-random-api.ml/facts/cat').then(response => response.json());
  
  const embed = {
    description: "Random cat picture:",
    title: fact,
    image: {
      url: cat
    },
    //random color
    color: Math.floor(Math.random() * 16777215).toString(16)
  };
  

  //await interaction.editReply(`Pong! Latency is ${reply.createdTimestamp - interaction.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`);
  await interaction.editReply({embeds: [embed]});
  
};

exports.commandData = {
  name: "cat",
  description: "Grab a random cat fact and cute picture",
  options: [],
  defaultPermission: true,
};

// Set guildOnly to true if you want it to be available on guilds only.
// Otherwise false is global.
exports.conf = {
  permLevel: "User",
  guildOnly: true
};
