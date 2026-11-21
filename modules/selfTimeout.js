// Members timing themselves out (/timeout), e.g. to take a break. Shared by the command
// and its confirmation button (components/selftimeout.js).

import { PermissionFlagsBits } from "discord.js";

// Fixed choices rather than any number: easy to pick on mobile, and nobody locks
// themselves out for Discord's maximum of 28 days by a typo.
export const DURATIONS = [5, 10, 30, 60, 120, 360, 720, 1440, 4320, 10080];
export const DEFAULT_MINUTES = 10;

export function describeDuration(minutes) {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes < 1440) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
}

// Shown in the server's audit log as the reason for the timeout.
export const auditReason = (minutes) => `Self requested with /timeout for ${describeDuration(minutes)}`;

// Why this member can't be timed out, or null. Discord would refuse these itself, but
// with an error that doesn't tell the member why.
export function timeoutProblem(member, settings) {
  if (settings.selfTimeout === "false") return "Self-timeouts are turned off in this server.";
  if (member.isCommunicationDisabled?.()) return `You're already timed out until <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:t>.`;
  if (member.id === member.guild.ownerId) return "Discord doesn't let anyone time out the server owner.";
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return "Discord doesn't let anyone time out members with the Administrator permission.";
  if (!member.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) return "I'm missing the **Timeout Members** permission in this server.";
  if (!member.moderatable) return "Your highest role is at or above mine, so I can't time you out.";
  return null;
}
