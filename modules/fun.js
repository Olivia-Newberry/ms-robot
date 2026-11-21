// Shared by the picture/fact slash commands, which all call small public APIs and
// answer with one embed. These replaced some-random-api.com when it shut down; each
// is free and needs no key, so nothing breaks if an API key lapses.

import { ApplicationCommandOptionType } from "discord.js";

// Node 18+ has fetch built in, so the node-fetch dependency isn't needed. The timeout
// matters because a slow API would otherwise leave the "thinking…" reply hanging
// until Discord expires the interaction after 15 minutes.
export async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`);
  return response.json();
}

export const randomColor = () => Math.floor(Math.random() * 0xffffff);

export const initiatedBy = (user) => ({ text: `Initiated by ${user.tag}`, icon_url: user.displayAvatarURL() });

// Each animal needs its own picture and fact sources, so only animals with a reliable
// free source for both (or a picture at least) are offered.
const ANIMALS = {
  async cat() {
    const [[{ url }], { fact }] = await Promise.all([
      getJson("https://api.thecatapi.com/v1/images/search"),
      getJson("https://catfact.ninja/fact"),
    ]);
    return { image: url, fact };
  },
  async dog() {
    const [{ message: image }, { data }] = await Promise.all([
      getJson("https://dog.ceo/api/breeds/image/random"),
      getJson("https://dogapi.dog/api/v2/facts"),
    ]);
    // dog.ceo URLs contain the breed (/breeds/<breed>/...), which is worth showing.
    const breed = image.match(/\/breeds\/([^/]+)\//)?.[1]?.replaceAll("-", " ");
    return { image, fact: data?.[0]?.attributes?.body, label: breed ? `dog (${breed})` : "dog" };
  },
  async fox() {
    const { image } = await getJson("https://randomfox.ca/floof/");
    return { image };
  },
};

export const ANIMAL_KINDS = Object.keys(ANIMALS);

export async function animalEmbed(kind) {
  const { image, fact, label = kind } = await ANIMALS[kind]();
  // Embed titles are limited to 256 characters, and some facts are longer.
  const title = fact && fact.length > 256 ? `${fact.slice(0, 253)}...` : fact;
  return { description: `Random ${label} picture:`, title: title ?? null, image: { url: image }, color: randomColor() };
}

// /hug, /wink, /facepalm and /headpat only differ in their endpoint and wording, so each
// file is one call to this.
export function reactionCommand({ name, description, endpoint, suffix = "", replaces = [] }) {
  return {
    commandData: {
      name,
      description,
      options: [
        { name: "user", description: "Who it's for", type: ApplicationCommandOptionType.User, required: false },
        { name: "message", description: "Something to say with it", type: ApplicationCommandOptionType.String, required: false, maxLength: 1000 },
      ],
    },
    conf: { permLevel: "User", guildOnly: true, category: "Gifs", replaces },
    async run(client, interaction) {
      await interaction.deferReply();
      const { results: [gif] } = await getJson(`https://nekos.best/api/v2/${endpoint}`);
      const target = interaction.options.getUser("user");
      const text = [interaction.options.getString("message"), suffix].filter(Boolean).join(" ");
      // nekos.best says which anime each gif is from; crediting it costs nothing.
      const footer = initiatedBy(interaction.user);
      if (gif.anime_name) footer.text += ` · from ${gif.anime_name}`;
      await interaction.editReply({
        // The mention goes in the message text because Discord never notifies people
        // mentioned inside an embed, and the point is that they see it.
        content: target ? `${target}` : null,
        embeds: [{ color: randomColor(), description: text || null, image: { url: gif.url }, footer }],
        // Only the chosen user is pinged; an @everyone or other mention typed into the
        // message shows as text but notifies nobody.
        allowedMentions: { users: target ? [target.id] : [] },
      });
    },
  };
}
