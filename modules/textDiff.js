// Diffing is done per word rather than per line because most edits change a few words
// in one long line, and a line diff would mark the whole line as changed.
//
//   the ~~quick brown~~ __**slow red**__ fox
//
// Strikethrough and bold/underline are used because they look the same on desktop and
// mobile. ANSI coloured code blocks look nicer on desktop, but mobile shows them
// without colour, and code blocks also stop mentions and emoji from rendering.

// Many emoji are several code points: flags, keycaps (1️⃣), skin tones, tag sequences
// (🏴󠁧󠁢󠁳󠁣󠁴󠁿) and ZWJ joins (👨‍👩‍👧). Matching them as one token stops the diff from
// splitting one and showing half an emoji, e.g. when 👍 becomes 👍🏽.
const PICTO = "\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?[\\u{E0020}-\\u{E007F}]*";
const EMOJI = `\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|${PICTO}(?:\\u200D${PICTO})*`;
const CUSTOM_EMOJI = "<a?:\\w+:\\d+>";

// Things that must never be split, because half a mention, emoji or URL stops
// rendering. After those: runs of whitespace, words, then single punctuation
// characters so "colour," -> "color," only marks the word.
const TOKEN = new RegExp([
  CUSTOM_EMOJI, "<[@#][!&]?\\d+>", "<\\/[^:>]+:\\d+>", "<t:-?\\d+(?::[tTdDfFR])?>",
  "https?:\\/\\/[^\\s<]+[^\\s<.,:;\"')\\]]", EMOJI, "\\s+", "[\\p{L}\\p{N}_']+", "[^\\s\\p{L}\\p{N}_']",
].join("|"), "gu");
const EMOJI_ONLY = new RegExp(`^(?:${CUSTOM_EMOJI}|${EMOJI})$`, "u");
const UNICODE_EMOJI_ONLY = new RegExp(`^(?:${EMOJI})$`, "u");

// Also used by role panels to check an emoji is a single real emoji.
export const isUnicodeEmoji = (text) => UNICODE_EMOJI_ONLY.test(text);

// Above this many LCS cells (roughly two 2000 character rewrites) we stop trying to
// align the middle of the message and treat it as one replacement. That keeps a single
// huge edit from blocking the event loop.
const MAX_CELLS = 2_000_000;

export function tokenize(text) {
  return text.match(TOKEN) ?? [];
}

export function diffTokens(a, b) {
  // Most edits touch a small part of the message, so trimming the shared start and end
  // first keeps the LCS table small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  const ops = [];
  const push = (type, tokens) => {
    if (!tokens.length) return;
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.tokens.push(...tokens);
    else ops.push({ type, tokens: [...tokens] });
  };

  push("eq", a.slice(0, start));

  const midA = a.slice(start, endA), midB = b.slice(start, endB);
  const n = midA.length, m = midB.length;
  if (n * m > MAX_CELLS) {
    push("del", midA);
    push("ins", midB);
  } else {
    // Walked forwards with deletions taken first, so removed text is shown before the
    // text that replaced it.
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = midA[i] === midB[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { push("eq", [midA[i]]); i++; j++; }
      else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) push("del", [midA[i++]]);
      else push("ins", [midB[j++]]);
    }
    push("del", midA.slice(i));
    push("ins", midB.slice(j));
  }

  push("eq", a.slice(endA));
  return ops;
}

// Turns the op list into alternating context and change hunks. Whitespace that sits
// between two changes is folded into the change, so a rewritten phrase reads as
// "~~the quick brown~~ **a slow red**" rather than word by word strike/bold pairs.
export function toHunks(ops) {
  const hunks = [];
  let current = null;
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    const isGap = op.type === "eq" && current && k + 1 < ops.length
      && op.tokens.every(t => /^\s+$/.test(t));
    if (op.type === "eq" && !isGap) {
      if (current) { hunks.push(current); current = null; }
      hunks.push({ type: "eq", tokens: op.tokens });
      continue;
    }
    current ??= { type: "change", del: [], ins: [] };
    if (op.type === "eq") { current.del.push(...op.tokens); current.ins.push(...op.tokens); }
    else current[op.type].push(...op.tokens);
  }
  if (current) hunks.push(current);
  return hunks;
}

// Mentions, custom emoji, timestamps and links are left alone so they still render.
// Everything else has markdown characters escaped so the log shows what was typed,
// and so user text can't break out of the strike/bold markers around it.
const RAW_TOKEN = /^(<a?:\w+:\d+>|<[@#][!&]?\d+>|<\/[^:>]+:\d+>|<t:-?\d+(?::[tTdDfFR])?>|https?:\/\/)/;
export function escapeToken(token) {
  if (RAW_TOKEN.test(token)) return token;
  return token.replace(/[\\*_~`|[\]>#-]/g, "\\$&");
}

const escapeAll = (tokens) => tokens.map(escapeToken).join("");

// Wraps text in a marker, but keeps leading/trailing whitespace and line breaks outside
// it. "~~ word~~" and markers spanning lines don't render in Discord.
function wrap(text, open, close) {
  return text.split("\n").map(line => {
    const m = /^(\s*)(.*?)(\s*)$/s.exec(line);
    return m[2] ? `${m[1]}${open}${m[2]}${close}${m[3]}` : line;
  }).join("\n");
}

const DEL = (text) => wrap(text, "~~", "~~");
const INS = (text) => wrap(text, "__**", "**__");

// Strikethrough and underline don't show on emoji, and are near invisible on a lone
// full stop or comma, so a change that is only emoji, or only a few punctuation marks,
// gets a visible label as well: ~~[− 🙂]~~ and __**[+ .]**__.
const isEmojiOnly = (tokens) => tokens.some(t => t.trim()) && tokens.every(t => !t.trim() || EMOJI_ONLY.test(t));
const isSmallPunctuation = (tokens) => {
  const visible = tokens.filter(t => t.trim()).join("");
  return visible.length > 0 && visible.length <= 3 && !/[\p{L}\p{N}]/u.test(visible);
};
const needsLabel = (tokens) => isEmojiOnly(tokens) || isSmallPunctuation(tokens);
const markDel = (tokens) => needsLabel(tokens) ? wrap(escapeAll(tokens), "~~[− ", "]~~") : DEL(escapeAll(tokens));
const markIns = (tokens) => needsLabel(tokens) ? wrap(escapeAll(tokens), "__**[+ ", "]**__") : INS(escapeAll(tokens));

function renderChange(hunk, limit = Infinity) {
  let del = escapeAll(hunk.del), ins = escapeAll(hunk.ins);
  const hasDel = del.trim().length > 0, hasIns = ins.trim().length > 0;
  // Markers around whitespace show up as literal ~~ in Discord, so a spacing-only
  // change is shown without them.
  if (!hasDel && !hasIns) return ins;
  // 24 covers the markers and emoji labels added around the text.
  if (del.length + ins.length + 24 <= limit) {
    if (hasDel && hasIns) return `${markDel(hunk.del)} ${markIns(hunk.ins)}`;
    return hasDel ? markDel(hunk.del) : markIns(hunk.ins);
  }
  // Cutting this one change keeps room for the changes after it. The caller attaches
  // the full text, so nothing is lost.
  const each = Math.max(0, Math.floor((limit - 24) / 2));
  const cut = (s) => s.length > each ? s.slice(0, each).replace(/\\$/, "") + "…" : s;
  del = cut(del); ins = cut(ins);
  if (hasDel && hasIns) return `${DEL(del)} ${INS(ins)}`;
  return hasDel ? DEL(del) : INS(ins);
}

// The words nearest a change are what make it readable, so unchanged text is cut
// from the middle of a run and the words next to each change are kept.
function collapse(tokens, keep, position) {
  const words = tokens.filter(t => !/^\s+$/.test(t)).length;
  // Not worth swapping a few words for a marker that's nearly as long.
  if (words <= keep * 2 + 3) return escapeAll(tokens);
  // Counts words, not tokens, so whitespace doesn't use up the context.
  const indexOfWord = (n, fromEnd) => {
    let seen = 0;
    for (let k = 0; k < tokens.length; k++) {
      const idx = fromEnd ? tokens.length - 1 - k : k;
      if (!/^\s+$/.test(tokens[idx]) && ++seen > n) return idx;
    }
    return fromEnd ? 0 : tokens.length;
  };
  const head = position === "first" ? [] : tokens.slice(0, indexOfWord(keep, false));
  const tail = position === "last" ? [] : tokens.slice(indexOfWord(keep, true) + 1);
  const hidden = words - (position === "first" ? 0 : keep) - (position === "last" ? 0 : keep);
  const marker = `*…${hidden} unchanged word${hidden === 1 ? "" : "s"}…*`;
  return [escapeAll(head).trimEnd(), marker, escapeAll(tail).trimStart()].filter(Boolean).join(" ");
}

// `complete` tells the caller whether to attach the full text, since anything less
// than the whole message has hidden part of it.
export function renderDiff(before, after, budget = 3800) {
  const hunks = toHunks(diffTokens(tokenize(before), tokenize(after)));
  if (!hunks.some(h => h.type === "change")) return { text: escapeAll(tokenize(after)), complete: true, changed: false };

  const render = (keep) => hunks.map((h, k) => {
    if (h.type === "change") return renderChange(h);
    if (keep === Infinity) return escapeAll(h.tokens);
    const position = k === 0 ? "first" : k === hunks.length - 1 ? "last" : "middle";
    return collapse(h.tokens, keep, position);
  }).join("");

  // Shrinks context only as far as needed, so mods see as much of the message as fits.
  for (const keep of [Infinity, 25, 12, 6, 3, 0]) {
    const text = render(keep);
    if (text.length <= budget) return { text, complete: keep === Infinity, changed: true };
  }

  // The changes alone are too big. Showing the first ones still beats an empty entry,
  // and the full text is attached.
  let text = "";
  for (let k = 0; k < hunks.length; k++) {
    const h = hunks[k];
    const room = budget - text.length - 40;
    if (room <= 0) break;
    const piece = h.type === "change"
      ? renderChange(h, room)
      : collapse(h.tokens, 0, k === 0 ? "first" : k === hunks.length - 1 ? "last" : "middle");
    if (piece.length > room) break;
    text += piece;
  }
  return { text: `${text}\n*…more changes, see the attached file*`, complete: false, changed: true };
}

// Line based unified-style diff for the attached file. Discord previews .diff files
// with red/green highlighting, which suits long messages better than inline markup.
export function lineDiff(before, after) {
  const ops = diffTokens(before.split("\n"), after.split("\n"));
  const prefix = { eq: "  ", del: "- ", ins: "+ " };
  return ops.flatMap(op => op.tokens.map(line => prefix[op.type] + line)).join("\n");
}
