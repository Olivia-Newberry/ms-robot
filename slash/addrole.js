// Gives a member one of the roles an admin has allowlisted for this server.
//
// Roles are picked from the bot's own list (see autocomplete below) and handled as IDs,
// never matched by name: role names can differ only by capitalisation or by lookalike
// characters, and Discord permits duplicates. Checks and settings are shared with
// removerole.js.

import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { describeRole, roleChoices, roleFromOption } from "../modules/roleMatch.js";
import { findProblem, idList, logRoleChange } from "../modules/roleTools.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const member = interaction.options.getMember("user");
  const { role, error } = roleFromOption(interaction.guild, interaction.options.getString("role"));
  if (error) return interaction.reply({ content: error, flags: MessageFlags.Ephemeral });

  const problem = findProblem(interaction, member, role, "add");
  if (problem) return interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });

  await member.roles.add(role, `/addrole used by ${interaction.user.tag}`);
  await interaction.reply({ content: `Gave ${describeRole(role)} to ${member.user.tag}.`, flags: MessageFlags.Ephemeral });
  await logRoleChange(interaction, member, role, "added a role");
}

// Only assignable roles are suggested, each with its ID and member count: Discord's own
// role picker shows every role and can't tell "Verified" from "vҽrified".
export async function autocomplete(client, interaction) {
  const only = idList(interaction.settings.assignableRoles);
  await interaction.respond(roleChoices(interaction.guild, interaction.options.getFocused(), { only }));
}

export const commandData = {
  name: "addrole",
  description: "Give a member one of this server's assignable roles.",
  options: [
    { name: "user", description: "The member to give the role to", type: ApplicationCommandOptionType.User, required: true },
    { name: "role", description: "The role to give", type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
  ],
};

export const conf = {
  // Anyone may invoke; the real check is roleManagerRoles, in findProblem().
  permLevel: "User",
  guildOnly: true,
  category: "Roles",
};
