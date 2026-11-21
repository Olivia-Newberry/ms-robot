// Picture/fact/joke commands with the outside APIs stubbed, so this runs offline.
// tests/live/apis.live.js checks the real APIs still answer in these shapes.
import "./setup/tempDataDir.js";   // first
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { loadContainer, makeGuild, makeInteraction, makeMember, makeUser } from "./helpers.js";
import interactionCreate from "../events/interactionCreate.js";

let container;
before(async () => { container = await loadContainer(); });
const user = makeUser("111", "member");
const guild = makeGuild({ members: [makeMember(user)] });

const RESPONSES = [
  [/thecatapi/, [{ url: "https://cdn2.thecatapi.com/images/a.jpg" }]],
  [/catfact\.ninja/, { fact: "Cats nap." }],
  [/dog\.ceo/, { message: "https://images.dog.ceo/breeds/german-shepherd/a.jpg", status: "success" }],
  [/dogapi\.dog/, { data: [{ attributes: { body: "Dogs dream." } }] }],
  [/randomfox/, { image: "https://randomfox.ca/images/1.jpg" }],
  [/nekos\.best/, { results: [{ url: "https://nekos.best/api/v2/hug/a.gif", anime_name: "Some Anime" }] }],
  [/icanhazdadjoke/, { joke: "A bad joke." }],
];
test.beforeEach((t) => t.mock.method(globalThis, "fetch", async (url) => {
  const body = RESPONSES.find(([pattern]) => pattern.test(String(url)))?.[1];
  return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body };
}));

const replyFor = async (commandName, options = {}) => {
  const i = makeInteraction({ commandName, user, member: guild.members.cache.get(user.id), guild, options });
  await interactionCreate({ container }, i);
  return i.replies.at(-1).payload;
};
const embedFor = async (commandName, options) => (await replyFor(commandName, options)).embeds?.[0];

test("animals", async () => {
  assert.equal((await embedFor("animal", { kind: "cat" })).title, "Cats nap.");
  const dog = await embedFor("animal", { kind: "dog" });
  assert.equal(dog.description, "Random dog (german shepherd) picture:");
  assert.equal((await embedFor("animal", { kind: "fox" })).image.url, "https://randomfox.ca/images/1.jpg");
  assert.equal((await embedFor("cat")).image.url, "https://cdn2.thecatapi.com/images/a.jpg");
});

test("reaction gifs ping the chosen user, and only them", async () => {
  const hug = await replyFor("hug", { user: makeUser("222", "friend"), message: "you're great @everyone <@333>" });
  // Outside the embed, because Discord doesn't notify mentions inside one.
  assert.equal(hug.content, "<@222>");
  assert.deepEqual(hug.allowedMentions, { users: ["222"] });
  assert.equal(hug.embeds[0].description, "you're great @everyone <@333>");
  assert.match(hug.embeds[0].footer.text, /from Some Anime/);
});

test("without a user nobody is pinged", async () => {
  const pat = await replyFor("headpat");
  assert.equal(pat.content, null);
  assert.deepEqual(pat.allowedMentions, { users: [] });
  assert.match(pat.embeds[0].description, /Have a pat on the head/);
});

test("jokes", async () => {
  assert.equal((await embedFor("joke")).title, "A bad joke.");
});

test("/gif says it isn't set up when there's no Giphy key", async () => {
  const config = (await import("../config.js")).default;
  const saved = config.giphyApiKey;
  config.giphyApiKey = null;
  const reply = await replyFor("gif", { search: "cats" });
  config.giphyApiKey = saved;
  assert.match(reply.content, /isn't set up/);
  assert.equal(globalThis.fetch.mock.callCount(), 0, "Giphy isn't called without a key");
});

test("/gif searches Giphy with the key from .env", async () => {
  const config = (await import("../config.js")).default;
  const saved = config.giphyApiKey;
  config.giphyApiKey = "test-key";
  RESPONSES.push([/giphy/, { data: [{ images: { original: { url: "https://media.giphy.com/a.gif" } } }] }]);
  const embed = await embedFor("gif", { search: "cats" });
  config.giphyApiKey = saved;
  assert.equal(embed.image.url, "https://media.giphy.com/a.gif");
  assert.match(String(globalThis.fetch.mock.calls[0].arguments[0]), /api_key=test-key/);
});
