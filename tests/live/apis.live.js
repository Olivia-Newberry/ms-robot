// Calls the real outside APIs the fun commands depend on. Not part of `npm test`
// because it needs the internet and those services can be slow; run it with
// `npm run test:live`, e.g. when a fun command starts failing. This is how a dead
// service (like some-random-api.com) gets noticed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getJson } from "../../modules/fun.js";

const CHECKS = {
  "TheCatAPI (cat pictures)": async () => assert.match((await getJson("https://api.thecatapi.com/v1/images/search"))[0].url, /^https:/),
  "catfact.ninja (cat facts)": async () => assert.ok((await getJson("https://catfact.ninja/fact")).fact),
  "dog.ceo (dog pictures)": async () => assert.match((await getJson("https://dog.ceo/api/breeds/image/random")).message, /\/breeds\//),
  "dogapi.dog (dog facts)": async () => assert.ok((await getJson("https://dogapi.dog/api/v2/facts")).data[0].attributes.body),
  "randomfox.ca (fox pictures)": async () => assert.match((await getJson("https://randomfox.ca/floof/")).image, /^https:/),
  "icanhazdadjoke (jokes)": async () => assert.ok((await getJson("https://icanhazdadjoke.com/", { Accept: "application/json", "User-Agent": "ms-robot Discord bot" })).joke),
  "Urban Dictionary (/define)": async () => assert.ok(Array.isArray((await getJson("https://api.urbandictionary.com/v0/define?term=hello")).list)),
};
for (const endpoint of ["hug", "wink", "facepalm", "pat"]) {
  CHECKS[`nekos.best ${endpoint}`] = async () => assert.match((await getJson(`https://nekos.best/api/v2/${endpoint}`)).results[0].url, /^https:/);
}

for (const [name, check] of Object.entries(CHECKS)) test(name, check);
