const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

exports.run = async (client, message, args, level) => { // eslint-disable-line no-unused-vars
  let animal = 'bird';
  let white = 16777215;
  const { image, fact } = await fetch("https://some-random-api.com/animal/" + animal).then(response => response.json());
  const embed = {
    description: "Random " + animal + " picture:",
    title: fact,
    image: {
      url: image
    },
    //random color
    color: Math.floor(Math.random() * white).toString(16)
  };

  message.channel.send({ embeds: [embed] });
};

exports.conf = {
  enabled: true,
  guildOnly: false,
  aliases: ["bird"],
  permLevel: "User"
};

exports.help = {
  name: "birb",
  category: "Fun",
  description: "Grab a random birb fact and cute picture",
  usage: "birb"
};
