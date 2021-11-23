const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  
  const { image, caption, category } = await fetch('https://some-random-api.ml/meme').then(response => response.json());
  
  const embed = {
    title: caption,
    description: 'Category: '+category,
    color: Math.floor(Math.random() * 16777215).toString(16),
    image: {
      url: image
    },
    footer: {
      text: 'Initiated by '+message.author.username+'#'+message.author.discriminator,
      icon_url: message.author.displayAvatarURL()
    }
  };
  
  message.channel.send({ embeds: [embed] });
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ["mem"],
  permLevel: "User"
};

exports.help = {
  name: "meme",
  category: "Fun",
  description: "Shares a terrible meme",
  usage: "meme"
};
