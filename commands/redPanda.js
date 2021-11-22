const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  const { image, fact } = await fetch('https://some-random-api.ml/animal/red_panda').then(response => response.json());
  //returns a random red_panda image and fact with format:
  //{
    // "image": "some link",
    // "fact": "some fact"
  //}
  //get image
  
  const embed = {
    description: "Random red panda picture:",
    title: fact,
    image: {
      url: image
    },
    //random color
    color: Math.floor(Math.random() * 16777215).toString(16)
  };
  
  message.channel.send({ embeds: [embed] });
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ['red'],
  permLevel: "User"
};

exports.help = {
  name: "redPanda",
  category: "Fun",
  description: "Grab a random red panda fact and cute picture",
  usage: "redPanda"
};
