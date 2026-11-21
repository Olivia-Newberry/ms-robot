// The verification flow (the "!!verify" hand-off, the mossy/newcomers channels, Sora)
// only exists in this server. Anywhere else the bot would be telling people to message
// someone who isn't there, or triggering a bot that isn't installed.
const VERIFICATION_SERVER = "438306949285806082";

// Settings are free text (/set can write anything), so a value that isn't a number falls
// back to the default rather than switching the reaction off by accident.
function reactChance(value) {
  const chance = Number(value);
  return Number.isFinite(chance) ? Math.min(100, Math.max(0, chance)) : 100;
}

export async function run(client, message, args, level, command) { // eslint-disable-line no-unused-vars
  var msgLower = message.content.toLowerCase();

  if (["ms robot test", "anyone listening?"].includes(msgLower)) {
    message.reply('I\'m listening!');
  }
  if (msgLower == "hi ms robot") {
    message.reply('Hello, how are you today?');
  }
  // Custom emoji reactions fail if the emoji is deleted or the bot can't use external
  // emoji in that channel; that shouldn't surface as an unhandled rejection on every
  // matching message.
  // A chance rather than on/off because in a busy server reacting to every mention gets
  // noisy, while an occasional one still feels like a joke.
  if (msgLower.includes('minecraft') && Math.random() * 100 < reactChance(message.settings?.minecraftReactChance)) {
    message.react("634294300976349194").catch(() => {});
  }

  if (
    message.guild?.id === VERIFICATION_SERVER
    && (msgLower.includes('!verification') || msgLower.includes('! verification'))
  ){
    if (message.channel.name != undefined && !(['mossy','newcomers'].includes(message.channel.name.toLowerCase()))) {
      message.channel.send('!!verify');
    } else {
      message.reply('Please read the sticky message or try messaging Sora');
    }
  }

  // Only a toggle, no chance: the point is that every selfie gets a reaction, to
  // encourage people to post and react.
  if (message.settings?.selfieReact !== "false" && message.channel.name != undefined && message.channel.name.toLowerCase().includes("selfie")) {
    if (message.attachments.size > 0) {
      message.react("758296751861268540").catch(() => {});
    }
  }
}

export const conf = {
  enabled: true,
  guildOnly: false,
  aliases: [],
  permLevel: "User"
};

export const help = {
  name: "partialMessage",
  category: "Miscellaneous",
  description: "Easter eggs, funky things and others",
  usage: "Just chat, you may notice it."
};
