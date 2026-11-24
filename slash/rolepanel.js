// Sets up role panels (see modules/rolePanels.js).
//
//   /rolepanel create  title style mode [description] [channel]
//   /rolepanel add     panel role [label] [emoji] [requires]
//   /rolepanel remove  panel role
//   /rolepanel edit    panel [title] [description] [style] [mode]
//   /rolepanel list
//   /rolepanel delete  panel
//
// Who can use it is a server setting (rolePanelAccess): the Administrator level by
// default, or the Moderator level and up. It's checked in run() rather than through
// conf.permLevel, which is the same for every server.

import { ApplicationCommandOptionType as T, ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { permlevel } from "../modules/functions.js";
import { checkEmoji, deletePanel, getPanel, MAX_ROLES, newPanel, panelsIn, publish, roleProblem, savePanel } from "../modules/rolePanels.js";
import { lookalikeWarning, roleChoices, roleFromOption } from "../modules/roleMatch.js";
import { listMessages } from "../modules/embedPages.js";

// Reactions need these on top of sending; Manage Messages lets the bot tidy up stray
// reactions and swap them in pick-one panels, but panels work without it.
const NEEDED = {
  "View Channel": PermissionFlagsBits.ViewChannel, "Send Messages": PermissionFlagsBits.SendMessages, "Embed Links": PermissionFlagsBits.EmbedLinks,
};
const NEEDED_FOR_REACTIONS = { "Add Reactions": PermissionFlagsBits.AddReactions, "Read Message History": PermissionFlagsBits.ReadMessageHistory };

function missingPermissions(channel, me, style) {
  const needed = style === "reactions" ? { ...NEEDED, ...NEEDED_FOR_REACTIONS } : NEEDED;
  const perms = channel.permissionsFor(me);
  return Object.keys(needed).filter(name => !perms?.has(needed[name]));
}

export async function run(client, interaction) {
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const level = interaction.settings.rolePanelAccess === "moderator" ? "Moderator" : "Administrator";
  if (permlevel(interaction) < client.container.levelCache[level])
    return reply(`Setting up role panels needs the ${level} level (a role in this server's \`${level === "Moderator" ? "modRole" : "adminRole"}\` setting).`);

  const sub = interaction.options.getSubcommand();
  if (sub === "list") {
    const list = panelsIn(interaction.guildId);
    if (!list.length) return reply("This server has no role panels yet. Make one with `/rolepanel create`.");
    // Split over as many embeds and messages as needed; one message held about 13 panels.
    const [first, ...rest] = listMessages([{
      title: `Role panels (${list.length})`,
      lines: list.map(p => `**${p.title}** · ${p.roles.length} role${p.roles.length === 1 ? "" : "s"} · ${p.style}, ${p.mode === "single" ? "pick one" : "pick any"} · ${p.messageId ? `https://discord.com/channels/${p.guildId}/${p.channelId}/${p.messageId}` : "not posted"}`),
    }]);
    await interaction.reply({ ...first, flags: MessageFlags.Ephemeral });
    for (const message of rest) await interaction.followUp({ ...message, flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === "create") {
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const style = interaction.options.getString("style");
    const missing = missingPermissions(channel, interaction.guild.members.me, style);
    if (missing.length) return reply(`I need ${missing.map(p => `\`${p}\``).join(", ")} in ${channel} first.`);
    const panel = newPanel({
      guildId: interaction.guildId, channelId: channel.id, createdBy: interaction.user.id, style,
      title: interaction.options.getString("title"), description: interaction.options.getString("description"),
      mode: interaction.options.getString("mode"),
    });
    await publish(client, panel);
    return reply(`Posted **${panel.title}** in ${channel}. Add roles with \`/rolepanel add\`.`);
  }

  // Everything else works on an existing panel, picked by autocomplete.
  let panel = getPanel(interaction.options.getString("panel"));
  if (!panel || panel.guildId !== interaction.guildId) return reply("I couldn't find that panel. Pick one from the list.");

  if (sub === "delete") {
    const channel = client.channels.cache.get(panel.channelId);
    const message = panel.messageId && channel ? await channel.messages.fetch(panel.messageId).catch(() => null) : null;
    await message?.delete().catch(() => null);
    deletePanel(panel.id);
    return reply(`Deleted **${panel.title}**. Roles people already picked stay with them.`);
  }

  if (sub === "add") {
    const picked = roleFromOption(interaction.guild, interaction.options.getString("role"));
    const needed = roleFromOption(interaction.guild, interaction.options.getString("requires"));
    if (picked.error || needed.error) return reply(picked.error ?? needed.error);
    const role = picked.role, requires = needed.role;
    const label = interaction.options.getString("label");
    const emojiText = interaction.options.getString("emoji");
    const problem = roleProblem(interaction.guild, role);
    if (problem) return reply(`Can't add it: ${problem}.`);
    if (requires?.id === role.id) return reply("A role can't require itself.");
    if (panel.roles.length >= MAX_ROLES[panel.style]) return reply(`A ${panel.style} panel holds at most ${MAX_ROLES[panel.style]} roles.`);
    let emoji = null;
    if (emojiText) {
      const checked = checkEmoji(emojiText, client);
      if (checked.error) return reply(`Can't use that emoji: ${checked.error}.`);
      emoji = checked.emoji;
    }
    // Reactions are the only way to pick on a reaction panel, so each role needs one.
    if (panel.style === "reactions" && !emoji) return reply("Reaction panels need an emoji for every role.");
    if (emoji && panel.roles.some(e => e.emoji === emoji && e.roleId !== role.id)) return reply("Another role on this panel already uses that emoji.");

    const entry = { roleId: role.id, label: label ?? null, emoji, requires: requires?.id ?? null };
    const existing = panel.roles.findIndex(e => e.roleId === role.id);
    const roles = existing >= 0 ? panel.roles.map((e, i) => (i === existing ? entry : e)) : [...panel.roles, entry];
    panel = savePanel({ ...panel, roles });
    await publish(client, panel);
    return reply(`${existing >= 0 ? "Updated" : "Added"} ${role} (\`${role.id}\`) on **${panel.title}**${requires ? `, for people who have ${requires} (\`${requires.id}\`)` : ""}.${lookalikeWarning(interaction.guild, role)}${requires ? lookalikeWarning(interaction.guild, requires) : ""}`);
  }

  if (sub === "remove") {
    const { role, error } = roleFromOption(interaction.guild, interaction.options.getString("role"));
    if (error) return reply(error);
    if (!panel.roles.some(e => e.roleId === role.id)) return reply(`${role} isn't on **${panel.title}**.`);
    panel = savePanel({ ...panel, roles: panel.roles.filter(e => e.roleId !== role.id) });
    await publish(client, panel);
    return reply(`Removed ${role} from **${panel.title}**. People who already have it keep it.`);
  }

  if (sub === "edit") {
    const style = interaction.options.getString("style") ?? panel.style;
    if (style === "reactions" && panel.roles.some(e => !e.emoji)) return reply("Every role needs an emoji before this can become a reaction panel. Add them with `/rolepanel add`.");
    if (panel.roles.length > MAX_ROLES[style]) return reply(`A ${style} panel holds at most ${MAX_ROLES[style]} roles.`);
    panel = savePanel({
      ...panel, style,
      title: interaction.options.getString("title") ?? panel.title,
      description: interaction.options.getString("description") ?? panel.description,
      mode: interaction.options.getString("mode") ?? panel.mode,
    });
    await publish(client, panel);
    return reply(`Updated **${panel.title}**.`);
  }
}

export async function autocomplete(client, interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name === "panel") {
    const typed = focused.value.toLowerCase();
    const matches = panelsIn(interaction.guildId).filter(p => p.title.toLowerCase().includes(typed)).slice(0, 25);
    return interaction.respond(matches.map(p => ({ name: `${p.title} (${p.roles.length} roles)`.slice(0, 100), value: p.id })));
  }
  // Roles, with IDs and member counts: Discord's own role picker can't tell
  // "Verified" from "vҽrified". Removing only suggests roles already on the panel.
  const panel = getPanel(interaction.options.getString("panel"));
  const only = interaction.options.getSubcommand() === "remove" && panel ? panel.roles.map(e => e.roleId) : undefined;
  await interaction.respond(roleChoices(interaction.guild, focused.value, { only }));
}

const panelOption = { name: "panel", description: "Which panel", type: T.String, required: true, autocomplete: true };
const styleChoices = [{ name: "Buttons", value: "buttons" }, { name: "Emoji reactions", value: "reactions" }];
const modeChoices = [{ name: "Pick one (choosing another swaps it)", value: "single" }, { name: "Pick any number", value: "multiple" }];

export const commandData = {
  name: "rolepanel",
  description: "Set up messages members use to pick their own roles.",
  // Not hidden behind a Discord permission: moderators may be allowed to use it without
  // having Manage Roles themselves (the bot does the role changes).
  options: [
    {
      name: "create", description: "Post a new role panel", type: T.Subcommand, options: [
        { name: "title", description: "Panel title", type: T.String, required: true, maxLength: 256 },
        { name: "style", description: "How members pick", type: T.String, required: true, choices: styleChoices },
        { name: "mode", description: "One role or several", type: T.String, required: true, choices: modeChoices },
        { name: "description", description: "Text shown above the roles", type: T.String, required: false, maxLength: 2000 },
        { name: "channel", description: "Where to post it (here if left out)", type: T.Channel, required: false, channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
      ],
    },
    {
      name: "add", description: "Add a role to a panel, or change one already on it", type: T.Subcommand, options: [
        panelOption,
        { name: "role", description: "The role members can pick", type: T.String, required: true, autocomplete: true },
        { name: "label", description: "Button text (the role name if left out)", type: T.String, required: false, maxLength: 80 },
        { name: "emoji", description: "Emoji for the button or reaction", type: T.String, required: false, maxLength: 64 },
        { name: "requires", description: "A role members must already have to pick this one", type: T.String, required: false, autocomplete: true },
      ],
    },
    {
      name: "remove", description: "Take a role off a panel", type: T.Subcommand,
      options: [panelOption, { name: "role", description: "The role", type: T.String, required: true, autocomplete: true }],
    },
    {
      name: "edit", description: "Change a panel's title, text, style or mode", type: T.Subcommand, options: [
        panelOption,
        { name: "title", description: "New title", type: T.String, required: false, maxLength: 256 },
        { name: "description", description: "New text shown above the roles", type: T.String, required: false, maxLength: 2000 },
        { name: "style", description: "How members pick", type: T.String, required: false, choices: styleChoices },
        { name: "mode", description: "One role or several", type: T.String, required: false, choices: modeChoices },
      ],
    },
    { name: "list", description: "Show this server's role panels", type: T.Subcommand },
    { name: "delete", description: "Delete a panel and its message", type: T.Subcommand, options: [panelOption] },
  ],
};

export const conf = { permLevel: "User", guildOnly: true, category: "Roles" };
