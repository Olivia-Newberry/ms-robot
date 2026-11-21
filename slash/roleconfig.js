// Edits which roles /addrole and /removerole work with.
//
//   /roleconfig list
//   /roleconfig assignable add|remove  role:<role> confirm:<code>
//   /roleconfig managers   add|remove  role:<role> confirm:<code>
//
// "assignable" is the list of roles the commands may hand out. "managers" is the list
// of roles allowed to run them. Editing either changes who can do what on this server,
// so both sit behind Discord's Manage Roles permission and a typed confirmation.
//
// The confirmation word is not a secret, it's right there in this file. It's only
// there to stop someone reconfiguring the server's access control by accident while
// tabbing through the autocomplete.
//
// This uses Manage Roles instead of conf.permLevel because the "Administrator" level
// looks up settings.adminRole by name, so it breaks on any server that calls its
// admin role something else.

import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { settings } from "../modules/settings.js";
import { idList } from "../modules/roleTools.js";
import { describeRole, lookalikeWarning, roleChoices, roleFromOption } from "../modules/roleMatch.js";

const CONFIRMATION = "iknowwhatimdoing";

// Which setting each subcommand group edits, and how to describe it.
const LISTS = {
  assignable: { key: "assignableRoles", noun: "handed out by /addrole" },
  managers: { key: "roleManagerRoles", noun: "allowed to use /addrole and /removerole" },
};

// Writes a list back to this server's overrides, the same way commands/set.js does.
// An emptied list is stored as "false", which is what the rest of the project uses to
// mean a setting isn't in use.
function save(interaction, key, ids) {
  if (!settings.has(interaction.guild.id)) settings.set(interaction.guild.id, {});
  settings.set(interaction.guild.id, ids.length ? ids.join(" ") : "false", key);
}

// An ID with no matching role means the role was deleted since it was configured.
function describe(interaction, ids) {
  if (!ids.length) return "_none_";
  return ids.map(id => {
    const role = interaction.guild.roles.cache.get(id);
    return role ? describeRole(role) : `\`${id}\` (deleted role)`;
  }).join(", ");
}

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))
    return reply("You need the **Manage Roles** permission to change this.");

  if (interaction.options.getSubcommand() === "list") {
    const assignable = idList(interaction.settings.assignableRoles);
    const managers = idList(interaction.settings.roleManagerRoles);
    return reply([
      `**Can be assigned** (${assignable.length}): ${describe(interaction, assignable)}`,
      `**Can use the commands** (${managers.length}): ${describe(interaction, managers)}`,
    ].join("\n\n"));
  }

  if (interaction.options.getString("confirm") !== CONFIRMATION)
    return reply(`This changes who can manage roles on this server. Re-run it with \`confirm: ${CONFIRMATION}\` if you meant to.`);

  const { key, noun } = LISTS[interaction.options.getSubcommandGroup()];
  const { role, error } = roleFromOption(interaction.guild, interaction.options.getString("role"));
  if (error) return reply(error);
  const current = idList(interaction.settings[key]);
  const shown = describeRole(role);

  if (interaction.options.getSubcommand() === "add") {
    if (current.includes(role.id)) return reply(`${shown} is already ${noun}.`);
    save(interaction, key, [...current, role.id]);
    return reply(`${shown} is now ${noun}.${lookalikeWarning(interaction.guild, role)}`);
  }

  if (current.includes(role.id)) {
    save(interaction, key, current.filter(id => id !== role.id));
    return reply(`${shown} is no longer ${noun}.`);
  }
  return reply(`${shown} wasn't ${noun} to begin with.`);
}

// Suggests roles with their IDs and member counts, since Discord's own role picker
// can't tell "Verified" from "vҽrified". Removing only suggests roles on that list.
export async function autocomplete(client, interaction) {
  const group = interaction.options.getSubcommandGroup();
  const only = interaction.options.getSubcommand() === "remove" && LISTS[group] ? idList(interaction.settings[LISTS[group].key]) : undefined;
  await interaction.respond(roleChoices(interaction.guild, interaction.options.getFocused(), { only }));
}

// Both groups take the same two options, so build them once.
const editSubcommand = (name, description) => ({
  name,
  description,
  type: ApplicationCommandOptionType.Subcommand,
  options: [
    { name: "role", description: "The role to change", type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
    { name: "confirm", description: `Type ${CONFIRMATION} to confirm`, type: ApplicationCommandOptionType.String, required: true },
  ],
});

export const commandData = {
  name: "roleconfig",
  description: "Choose which roles /addrole and /removerole work with.",
  options: [
    {
      name: "assignable",
      description: "Roles that /addrole may hand out",
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        editSubcommand("add", "Let /addrole hand out a role"),
        editSubcommand("remove", "Stop /addrole handing out a role"),
      ],
    },
    {
      name: "managers",
      description: "Roles allowed to use /addrole and /removerole",
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        editSubcommand("add", "Let a role use /addrole and /removerole"),
        editSubcommand("remove", "Stop a role using /addrole and /removerole"),
      ],
    },
    { name: "list", description: "Show this server's role configuration", type: ApplicationCommandOptionType.Subcommand },
  ],
  // Hidden from members who couldn't use it anyway; run() still checks, since server
  // admins can change who sees a command.
  defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
};

export const conf = {
  // Limit to server config bot admin role
  // "User" so the Manage Roles check in run() is what decides, as described at the top.
  permLevel: "User",
  guildOnly: true,
  category: "Roles",
};
