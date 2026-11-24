import { GatewayIntentBits, Partials } from "discord.js";
// Role settings hold IDs (or names from older versions); see modules/roleMatch.js for
// why names alone can't be trusted.
import { resolveRoles } from "./modules/roleMatch.js";

// Whether the member has any of the roles a role setting lists.
const hasRoleSetting = (message, value) => resolveRoles(message.guild, value).some(role => message.member.roles.cache.has(role.id));

// Comma-separated lists from .env (see .env.example), so IDs and names that belong to one
// deployment, like the other bots it works with, stay out of the code.
const envList = (name) => (process.env[name] ?? "").split(",").map(s => s.trim()).filter(Boolean);

const config = {
  // Bot Admins, level 9 by default. Array of user ID strings.
  "admins": [],

  // Bot Support, level 8 by default. Array of user ID strings
  "support": [],

  // Bots whose messages this bot acts on (the bot-to-bot automation): ALLOWED_BOTS.
  "allowedBots": envList("ALLOWED_BOTS"),

  // A bot that opens mod threads with a message containing its own ID, which isn't the
  // member's, so /threaduser and !user skip it: MOD_THREAD_SKIP_IDS.
  modThreadSkipIds: envList("MOD_THREAD_SKIP_IDS"),

  // How many messages discord.js keeps in memory (see modules/messageCache.js). The
  // message log can only show the original text of an edited or deleted message if it's
  // still cached: Discord never sends the old text, and deleted messages can't be fetched.
  //   basePerChannel  messages every channel keeps normally (200, as before 1.0).
  //   perChannel      most one channel can hold during a burst. Messages past
  //                   basePerChannel are the first to go in a cleanup.
  //   hostReservePercent  share of the server's RAM to keep free (for other bots on the
  //                   same server, surges and the OS). Below it, a quarter of the cache is dropped each check.
  //                   A percentage, so it suits a bigger server too.
  // The bot also trims itself when its JavaScript memory nears Node's own limit
  // (nodeHeapPercent below).
  //   keepPerChannel  newest messages every channel keeps through any cleanup.
  //   refill          messages fetched at startup from each logged channel or thread
  //                   active in the last refillWithinHours (at most 100). Quieter ones
  //                   get keepPerChannel, since the cache holds at least that many anyway,
  //                   and their newest messages are still the likeliest to be edited.
  // Bot support, bot admins and the bot owner can see the cache size, the server's free
  // memory and that of services in MONITOR_SERVICES in /stats.
  messageCache: { basePerChannel: 200, perChannel: 1000, hostReservePercent: 30, keepPerChannel: 50, refill: 100, refillWithinHours: 72 },

  // Node's JavaScript memory limit, as a percentage of the server's RAM. Node's own
  // default is far lower than the bot could use on a small server. 70 leaves the 30%
  // hostReservePercent for other bots on the server, surges and the OS. null keeps Node's default. Applied at
  // startup by restarting in place (Node 22.15+); older Node logs the NODE_OPTIONS line
  // to add to ms-robot.service instead. See modules/nodeHeap.js.
  nodeHeapPercent: 70,

  // Other services on the same server whose memory /stats shows (systemd unit names).
  monitorServices: envList("MONITOR_SERVICES"),

  // Giphy key for /gif, from GIPHY_API_KEY in .env. Without it /gif says it isn't set up,
  // and the bot warns at startup.
  giphyApiKey: process.env.GIPHY_API_KEY || null,

  // Intents the bot needs.
  // By default GuideBot needs Guilds, Guild Messages and Direct Messages to work.
  // For join messages to work you need Guild Members, which is privileged and requires extra setup.
  // For more info about intents see the README.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration, // was GUILD_BANS
    GatewayIntentBits.GuildExpressions, // was GUILD_EMOJIS_AND_STICKERS
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    // Privileged: message text, attachments and embeds come through empty without it.
    // Only switch on once it's enabled for the bot in the Developer Portal, otherwise
    // Discord refuses the connection ("Disallowed intents").
    ...(process.env.MESSAGE_CONTENT_INTENT === "true" ? [GatewayIntentBits.MessageContent] : []),
  ],
  // Partials your bot may need should go here, CHANNEL is required for DM's.
  // MESSAGE lets edit/delete events fire for messages that aren't cached, so the
  // message log can still say *something* happened to them.
  // Reaction and User let role panel reactions arrive for panel messages posted
  // before the bot last restarted.
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User
  ],

  // Default per-server settings. These settings are entered in a database on first load, 
  // And are then completely ignored from this file. To modify default settings, use the `conf` command.
  // DO NOT REMOVE THIS BEFORE YOUR BOT IS LOADED AND FUNCTIONAL.
  
  "defaultSettings" : {
    "prefix": "!",
    "modLogChannel": "mod-log",
    "verifiedRole": "false",
    "modRole": "Moderator",
    "adminRole": "Administrator",
    "systemNotice": "true", // This gives a notice when a user tries to run a command that they do not have permission to use.
    "commandReply": "true", // Toggle this if you want the bot to ping the executioner or not.
    "welcomeChannel": "welcome",
    "welcomeMessage": "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
    "welcomeEnabled": "false",
    "messageLogChannel": "false", // Channel ID for edit/delete logs, set with /messagelog.
    "messageLogIgnore": "false",
    "minecraftReactChance": "100", // % of messages mentioning minecraft that get a reaction; 0 turns it off. /reactions
    "selfieReact": "true", // React to pictures in selfie channels. /reactions
    "selfTimeout": "true", // Let members use /timeout on themselves.
    "rolePanelAccess": "administrator", // Who can set up role panels: "administrator" or "moderator".
    // "!verification" hand-off to a verification bot, per server in /settings (Verification
    // page). Off until a server sets the command. See modules/verification.js.
    "verificationCommand": "false",
    "verificationHelpChannels": "false",
    "verificationHelpMessage": "Please read the sticky message for how to verify."
  },

  // PERMISSION LEVEL DEFINITIONS.

  permLevels: [
    // This is the lowest permission level, this is for users without a role.
    { level: 0,
      name: "User", 
      // Don't bother checking, just return true which allows them to execute any command their
      // level allows them to.
      //if verified is set to true, default to Verified role
      check: (message) => {
        if(message.settings.verifiedRole != "false") {
          try {
            if (hasRoleSetting(message, message.settings.verifiedRole)) return true;
          } catch (e) {
            return false;
          }
        } else {
          return true;
        }
      }
    },

    // This is for verified members where servers have some form of access role present.
    { level: 1,
      name: "Verified",
      check: (message) => {
        try {
          if (hasRoleSetting(message, message.settings.verifiedRole)) return true;
        } catch (e) {
          return false;
        }
      }
    },

    // This is your permission level, the staff levels should always be above the rest of the roles.
    { level: 2,
      // This is the name of the role.
      name: "Moderator",
      // The following lines check the guild the message came from for the roles.
      // Then it checks if the member that authored the message has the role.
      // If they do return true, which will allow them to execute the command in question.
      // If they don't then return false, which will prevent them from executing the command.
      check: (message) => {
        try {
          if (hasRoleSetting(message, message.settings.modRole)) return true;
        } catch (e) {
          return false;
        }
      }
    },

    { level: 3,
      name: "Administrator", 
      check: (message) => {
        try {
          return hasRoleSetting(message, message.settings.adminRole);
        } catch (e) {
          return false;
        }
      }
    },
    // This is the server owner.
    { level: 4,
      name: "Server Owner", 
      // Simple check, if the guild owner id matches the message author's ID, then it will return true.
      // Otherwise it will return false.
      check: (message) => {
        const serverOwner = message.author ?? message.user;
        return message.guild?.ownerId === serverOwner.id;
      }
    },

    // Bot Support is a special in between level that has the equivalent of server owner access
    // to any server they joins, in order to help troubleshoot the bot on behalf of owners.
    { level: 8,
      name: "Bot Support",
      // The check is by reading if an ID is part of this array. Yes, this means you need to
      // change this and reboot the bot to add a support user. Make it better yourself!
      check: (message) => {
        const botSupport = message.author ?? message.user;
        return config.support.includes(botSupport.id);
      }
    },

    // Bot Admin has some limited access like rebooting the bot or reloading commands.
    { level: 9,
      name: "Bot Admin",
      check: (message) => {
        const botAdmin = message.author ?? message.user;
        return config.admins.includes(botAdmin.id);
      }
    },

    // This is the bot owner, this should be the highest permission level available.
    // The reason this should be the highest level is because of dangerous commands such as eval
    // or exec (if the owner has that).
    // Updated to utilize the Teams type from the Application, pulls a list of "Owners" from it.
    { level: 10,
      name: "Bot Owner", 
      // Another simple check, compares the message author id to a list of owners found in the bot application.
      check: (message) => {
        const owner = message.author ?? message.user;
        return owner.id === process.env.OWNER;
      }
    }
  ]
};

// allow individual exports, while still supporting default export for compatibility
let defaultSettings = config.defaultSettings;
let permLevels = config.permLevels;
export { permLevels };
export { config, defaultSettings };
export default config;
