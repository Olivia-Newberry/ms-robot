// Takes one of this server's allowlisted roles off a member.
// The inverse of addrole.js; see modules/roleTools.js for the shared checks.

import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { describeRole, roleChoices, roleFromOption } from "../modules/roleMatch.js";
import { findProblem, idList, logRoleChange } from "../modules/roleTools.js";

export async function run(client, interaction) { // eslint-disable-line no-unused-vars
  const member = interaction.options.getMember("user");
  const { role, error } = roleFromOption(interaction.guild, interaction.options.getString("role"));
  if (error) return interaction.reply({ content: error, flags: MessageFlags.Ephemeral });

  const problem = findProblem(interaction, member, role, "remove");
  if (problem) return interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });

  await member.roles.remove(role, `/removerole used by ${interaction.user.tag}`);
  await interaction.reply({ content: `Took ${describeRole(role)} from ${member.user.tag}.`, flags: MessageFlags.Ephemeral });
  await logRoleChange(interaction, member, role, "removed a role");
}

// Only assignable roles are suggested, each with its ID and member count: Discord's own
// role picker shows every role and can't tell "Verified" from "vҽrified".
export async function autocomplete(client, interaction) {
  const only = idList(interaction.settings.assignableRoles);
  await interaction.respond(roleChoices(interaction.guild, interaction.options.getFocused(), { only }));
}

export const commandData = {
  name: "removerole",
  description: "Take one of this server's assignable roles off a member.",
  options: [
    { name: "user", description: "The member to take the role from", type: ApplicationCommandOptionType.User, required: true },
    { name: "role", description: "The role to take", type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
  ],
};

export const conf = {
  // Anyone may invoke; the real check is roleManagerRoles, in findProblem().
  permLevel: "User",
  guildOnly: true,
  category: "Roles",
};
