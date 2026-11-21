// Telling roles apart when their names don't.
//
// A server can have "Verified", "verified" and "vҽrified" (Cyrillic ҽ) side by side.
// Discord's own role picker shows them identically, and matching names without
// capitals picks whichever comes first, so the bot could hand out or check the wrong
// one. So roles are stored and passed around by ID, shown with their ID, and picked
// from a list that says how they differ.
//
// No imports, so config.js can use it without an import cycle.

// Letters from other alphabets that look like Latin ones. Not every confusable
// character, just the ones that turn up in role names; enough to warn about a lookalike.
const CONFUSABLES = {
  "а": "a", "ɑ": "a", "α": "a", "в": "b", "с": "c", "ϲ": "c", "ԁ": "d", "е": "e", "ҽ": "e", "ε": "e", "ɡ": "g",
  "һ": "h", "н": "h", "і": "i", "ı": "i", "ј": "j", "к": "k", "ӏ": "l", "м": "m", "п": "n", "о": "o", "ο": "o",
  "օ": "o", "р": "p", "ρ": "p", "ѕ": "s", "т": "t", "у": "y", "ү": "y", "ν": "v", "ѵ": "v", "ԝ": "w", "х": "x", "χ": "x",
};

// What a name looks like, ignoring capitals, accents and lookalike letters.
export function skeleton(name) {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/./gu, ch => CONFUSABLES[ch] ?? ch).replace(/\s+/g, " ").trim();
}

const ROLE_ID = /^(?:<@&)?(\d{17,20})>?$/;

// One role from typed text (for command options): an ID or mention, the one role with
// exactly that name, or failing that the one role with that name in any capitals. If
// more than one role fits either way, nothing rather than a guess.
export function resolveRole(guild, value) {
  if (!value || value === "false") return null;
  const id = String(value).match(ROLE_ID)?.[1];
  if (id) return guild.roles.cache.get(id) ?? null;
  const exact = guild.roles.cache.filter(r => r.name === value);
  if (exact.size) return exact.size === 1 ? exact.first() : null;
  const anyCase = guild.roles.cache.filter(r => r.name.toLowerCase() === String(value).toLowerCase());
  return anyCase.size === 1 ? anyCase.first() : null;
}

// Role settings (modRole, adminRole, verifiedRole) hold a comma-separated list of role
// IDs; members with any of them get that level. Older versions stored a name and gave
// the level to every role with that name in any capitals ("Verified" and "verified"),
// which servers relied on, so a name still means exactly that. migrateRoleSettings()
// in settingsUi.js turns stored names into those roles' IDs.
const ID_LIST = /^(?:<@&)?\d{17,20}>?(?:\s*[,\s]\s*(?:<@&)?\d{17,20}>?)*$/;
export const isIdList = (value) => ID_LIST.test(String(value ?? "").trim());

export function resolveRoles(guild, value) {
  if (!value || value === "false") return [];
  const text = String(value).trim();
  if (isIdList(text)) {
    return text.split(/[\s,]+/).map(part => guild.roles.cache.get(part.match(ROLE_ID)?.[1])).filter(Boolean);
  }
  return [...guild.roles.cache.values()].filter(r => r.name.toLowerCase() === text.toLowerCase());
}

export function lookalikes(guild, role) {
  const shape = skeleton(role.name);
  return [...guild.roles.cache.values()].filter(r => r.id !== role.id && skeleton(r.name) === shape);
}

// How a role is shown in replies: the mention renders with its colour, and the ID
// settles which one it is when names look the same.
export const describeRole = (role) => `${role} (\`${role.id}\`)`;

export function lookalikeWarning(guild, role) {
  const others = lookalikes(guild, role);
  if (!others.length) return "";
  return `\n⚠️ ${others.length === 1 ? "Another role looks" : `${others.length} other roles look`} like this one: ${others.map(describeRole).join(", ")}. Check the ID is the one you meant.`;
}

// Choices for a role option's autocomplete. Each shows what tells it apart from roles
// with similar names. `only` limits it to certain role IDs (e.g. assignable roles).
export function roleChoices(guild, typed, { only } = {}) {
  const query = skeleton(typed ?? "");
  const roles = [...guild.roles.cache.values()]
    .filter(r => r.id !== guild.id && (!only || only.includes(r.id)))
    .filter(r => !query || skeleton(r.name).includes(query) || r.id.startsWith(typed))
    .sort((a, b) => b.position - a.position)
    .slice(0, 25);
  return roles.map(role => {
    const members = role.members?.size;
    const parts = [role.name, members === undefined ? null : `${members} member${members === 1 ? "" : "s"}`, `ID ${role.id}`];
    if (lookalikes(guild, role).length) parts.push("⚠ lookalike");
    return { name: parts.filter(Boolean).join(" · ").slice(0, 100), value: role.id };
  });
}

// Reads a role option filled from roleChoices(). Autocomplete doesn't force a pick, so
// typed text is accepted too, but only when it can only mean one role.
export function roleFromOption(guild, text) {
  if (!text) return { role: null };
  const role = resolveRole(guild, text.trim());
  if (role) return { role };
  const similar = [...guild.roles.cache.values()].filter(r => skeleton(r.name) === skeleton(text));
  if (similar.length > 1) return { error: `${similar.length} roles are called something like "${text}". Pick one from the list, which shows their IDs.` };
  if (similar.length === 1) return { role: similar[0] };
  return { error: `I couldn't find a role called "${text}". Pick one from the list.` };
}
