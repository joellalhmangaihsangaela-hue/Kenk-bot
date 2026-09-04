const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || "";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1506669903673950338";

const PREFIX = process.env.PREFIX || ",";

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing.");
  process.exit(1);
}

// ============================================================
// DATA
// ============================================================

const dataFolder = path.join(__dirname, "data");
const dataFile = path.join(dataFolder, "data.json");

if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder, { recursive: true });
}

let data = {
  warnings: {},
  tickets: {},
  giveaways: {},
  boosterRoles: {}
};

if (fs.existsSync(dataFile)) {
  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    data = {
      ...data,
      ...saved
    };
  } catch (error) {
    console.log("⚠️ data.json could not be loaded. Creating a new one.");
  }
}

function saveData() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Could not save data:", error);
  }
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ============================================================
// HELPERS
// ============================================================

function isStaff(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function cleanName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function getAmount(value, fallback = 10) {
  const amount = parseInt(value);

  if (Number.isNaN(amount)) return fallback;

  return Math.max(1, Math.min(amount, 100));
}

function getUserFromMention(message, text) {
  const match = text?.match(/^<@!?(\d+)>$/);

  if (!match) return null;

  return message.guild.members.cache.get(match[1]) || null;
}

function getUserIdFromMention(text) {
  const match = text?.match(/^<@!?(\d+)>$/);
  return match ? match[1] : null;
}

async function safeReply(interaction, content, options = {}) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content,
        ...options
      });
    }

    return interaction.reply({
      content,
      ...options
    });
  } catch {
    return null;
  }
}

// ============================================================
// EMBEDS
// ============================================================

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("❌ Error")
    .setDescription(description)
    .setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all bot commands"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("setupprefix")
    .setDescription("Show the bot prefix"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to ban")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Ban reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(option =>
      option
        .setName("userid")
        .setDescription("User ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to kick")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Kick reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to mute")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("Mute duration")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Mute reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a timeout")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to unmute")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to warn")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Warning reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's warnings")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete recent messages")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount of messages")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages from a specific user")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount to delete")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("clean")
    .setDescription("Delete bot messages")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount to check")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock the current channel"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock the current channel"),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode")
    .addIntegerOption(option =>
      option
        .setName("seconds")
        .setDescription("Slowmode seconds")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("DM a user")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View user information")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server information"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("View a user's avatar")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create the support ticket panel"),

  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create a giveaway")
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("Duration in minutes")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10080)
    )
    .addIntegerOption(option =>
      option
        .setName("winners")
        .setDescription("Number of winners")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(option =>
      option
        .setName("prize")
        .setDescription("Giveaway prize")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("reroll")
    .setDescription("Reroll a giveaway")
    .addStringOption(option =>
      option
        .setName("messageid")
        .setDescription("Giveaway message ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("br")
    .setDescription("Create your booster role")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("Role name")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("color")
        .setDescription("Hex color, example: #ff0000")
        .setRequired(false)
    )
];

// ============================================================
// REGISTER COMMANDS
// ============================================================

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    const commandData = commands.map(command => command.toJSON());

    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        {
          body: commandData
        }
      );

      console.log("✅ Slash commands registered to the test server.");
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        {
          body: commandData
        }
      );

      console.log("✅ Global slash commands registered.");
    }
  } catch (error) {
    console.error("❌ Command registration error:", error);
  }
}

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
  console.log("=================================");
  console.log(`✅ ${client.user.tag} is online!`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log(`👥 Users: ${client.users.cache.size}`);
  console.log(`⚡ Prefix: ${PREFIX}`);
  console.log("=================================");

  client.user.setPresence({
    activities: [
      {
        name: "Kenk Community",
        type: 3
      }
    ],
    status: "online"
  });

  await registerCommands();
});

// ============================================================
// SLASH COMMAND HANDLER
// ============================================================

client.on("interactionCreate", async interaction => {
  try {
    // --------------------------------------------------------
    // SLASH COMMANDS
    // --------------------------------------------------------

    if (interaction.isChatInputCommand()) {
      const command = interaction.commandName;

      if (!interaction.guild) {
        return safeReply(interaction, "❌ This command can only be used in a server.");
      }

      // HELP
      if (command === "help") {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Kenk Community — Commands")
          .setDescription(
            `**Prefix:** \`${PREFIX}\`\n\n` +
            "**Moderation**\n" +
            "`/ban` `/unban` `/kick` `/mute` `/unmute`\n" +
            "`/warn` `/warnings` `/clear` `/purge` `/clean`\n" +
            "`/lock` `/unlock` `/slowmode`\n\n" +
            "**Community**\n" +
            "`/ticketpanel` `/giveaway` `/reroll`\n" +
            "`/say` `/dm` `/userinfo` `/serverinfo` `/avatar`\n\n" +
            "**Booster**\n" +
            "`/br` — Create your custom booster role"
          )
          .setFooter({ text: "Kenk Community" });

        return interaction.reply({ embeds: [embed] });
      }

      // PING
      if (command === "ping") {
        return interaction.reply({
          content: `🏓 Pong! \`${client.ws.ping}ms\``
        });
      }

      // PREFIX
      if (command === "setupprefix") {
        return interaction.reply({
          embeds: [
            infoEmbed(
              "Kenk Community Prefix",
              `The current prefix is \`${PREFIX}\``
            )
          ]
        });
      }

      // STAFF CHECK
      const staffCommands = [
        "ban",
        "unban",
        "kick",
        "mute",
        "unmute",
        "warn",
        "warnings",
        "clear",
        "purge",
        "clean",
        "lock",
        "unlock",
        "slowmode",
        "dm",
        "ticketpanel",
        "giveaway",
        "reroll"
      ];

      if (staffCommands.includes(command) && !isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed("You don't have permission to use this command.")
          ],
          ephemeral: true
        });
      }

      // BAN
      if (command === "ban") {
        const user = interaction.options.getUser("user");
        const reason =
          interaction.options.getString("reason") || "No reason provided";

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        if (!member) {
          return interaction.reply({
            embeds: [errorEmbed("That user is not in this server.")],
            ephemeral: true
          });
        }

        if (!member.bannable) {
          return interaction.reply({
            embeds: [errorEmbed("I cannot ban that member.")],
            ephemeral: true
          });
        }

        await member.ban({ reason });

        return interaction.reply({
          embeds: [
            successEmbed(
              "Member Banned",
              `**${user.tag}** has been banned.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // UNBAN
      if (command === "unban") {
        const userId = interaction.options.getString("userid");

        await interaction.guild.members.unban(userId);

        return interaction.reply({
          embeds: [
            successEmbed(
              "User Unbanned",
              `User ID \`${userId}\` has been unbanned.`
            )
          ]
        });
      }

      // KICK
      if (command === "kick") {
        const user = interaction.options.getUser("user");
        const reason =
          interaction.options.getString("reason") || "No reason provided";

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        if (!member || !member.kickable) {
          return interaction.reply({
            embeds: [errorEmbed("I cannot kick that member.")],
            ephemeral: true
          });
        }

        await member.kick(reason);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Member Kicked",
              `**${user.tag}** has been kicked.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // MUTE
      if (command === "mute") {
        const user = interaction.options.getUser("user");
        const minutes = interaction.options.getInteger("minutes");
        const reason =
          interaction.options.getString("reason") || "No reason provided";

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        if (!member || !member.moderatable) {
          return interaction.reply({
            embeds: [errorEmbed("I cannot mute that member.")],
            ephemeral: true
          });
        }

        await member.timeout(minutes * 60 * 1000, reason);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Member Muted",
              `**${user.tag}** has been timed out for **${minutes} minutes**.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // UNMUTE
      if (command === "unmute") {
        const user = interaction.options.getUser("user");

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        if (!member) {
          return interaction.reply({
            embeds: [errorEmbed("Member not found.")],
            ephemeral: true
          });
        }

        await member.timeout(null, "Timeout removed by staff");

        return interaction.reply({
          embeds: [
            successEmbed(
              "Member Unmuted",
              `**${user.tag}** is no longer timed out.`
            )
          ]
        });
      }

      // WARN
      if (command === "warn") {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        if (!data.warnings[user.id]) {
          data.warnings[user.id] = [];
        }

        data.warnings[user.id].push({
          reason,
          moderator: interaction.user.id,
          timestamp: Date.now()
        });

        saveData();

        return interaction.reply({
          embeds: [
            successEmbed(
              "Warning Added",
              `**${user.tag}** has been warned.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // WARNINGS
      if (command === "warnings") {
        const user = interaction.options.getUser("user");
        const warnings = data.warnings[user.id] || [];

        if (!warnings.length) {
          return interaction.reply({
            embeds: [
              infoEmbed(
                "Warnings",
                `**${user.tag}** has no warnings.`
              )
            ]
          });
        }

        const text = warnings
          .map(
            (warning, index) =>
              `**${index + 1}.** ${warning.reason}\n` +
              `Moderator: <@${warning.moderator}>`
          )
          .join("\n\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfee75c)
              .setTitle(`Warnings — ${user.tag}`)
              .setDescription(text)
          ]
        });
      }

      // CLEAR
      if (command === "clear") {
        const amount = interaction.options.getInteger("amount");

        const deleted = await interaction.channel.bulkDelete(amount, true);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Messages Cleared",
              `Deleted **${deleted.size}** messages.`
            )
          ],
          ephemeral: true
        });
      }

      // PURGE
      if (command === "purge") {
        const user = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        const messages = await interaction.channel.messages.fetch({
          limit: 100
        });

        const selected = messages
          .filter(message => message.author.id === user.id)
          .first(amount);

        if (!selected.length) {
          return interaction.reply({
            embeds: [errorEmbed("No messages from that user were found.")],
            ephemeral: true
          });
        }

        const deleted = await interaction.channel.bulkDelete(selected, true);

        return interaction.reply({
          embeds: [
            successEmbed(
              "User Messages Purged",
              `Deleted **${deleted.size}** messages from **${user.tag}**.`
            )
          ],
          ephemeral: true
        });
      }

      // CLEAN
      if (command === "clean") {
        const amount = interaction.options.getInteger("amount");

        const messages = await interaction.channel.messages.fetch({
          limit: 100
        });

        const selected = messages
          .filter(message => message.author.bot)
          .first(amount);

        if (!selected.length) {
          return interaction.reply({
            embeds: [errorEmbed("No bot messages were found.")],
            ephemeral: true
          });
        }

        const deleted = await interaction.channel.bulkDelete(selected, true);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Bot Messages Cleared",
              `Deleted **${deleted.size}** bot messages.`
            )
          ],
          ephemeral: true
        });
      }

      // LOCK
      if (command === "lock") {
        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: false
          }
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              "Channel Locked",
              "Members can no longer send messages here."
            )
          ]
        });
      }

      // UNLOCK
      if (command === "unlock") {
        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: null
          }
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              "Channel Unlocked",
              "Members can send messages again."
            )
          ]
        });
      }

      // SLOWMODE
      if (command === "slowmode") {
        const seconds = interaction.options.getInteger("seconds");

        await interaction.channel.setRateLimitPerUser(seconds);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Slowmode Updated",
              `Slowmode is now **${seconds} seconds**.`
            )
          ]
        });
      }

      // SAY
      if (command === "say") {
        const message = interaction.options.getString("message");

        await interaction.channel.send(message);

        return interaction.reply({
          content: "✅ Message sent.",
          ephemeral: true
        });
      }

      // DM
      if (command === "dm") {
        const user = interaction.options.getUser("user");
        const message = interaction.options.getString("message");

        try {
          await user.send(message);

          return interaction.reply({
            embeds: [
              successEmbed(
                "DM Sent",
                `Message sent to **${user.tag}**.`
              )
            ],
            ephemeral: true
          });
        } catch {
          return interaction.reply({
            embeds: [errorEmbed("I couldn't DM that user.")],
            ephemeral: true
          });
        }
      }

      // USERINFO
      if (command === "userinfo") {
        const user =
          interaction.options.getUser("user") || interaction.user;

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`User Info — ${user.tag}`)
          .setThumbnail(user.displayAvatarURL({ size: 1024 }))
          .addFields(
            {
              name: "User ID",
              value: user.id,
              inline: true
            },
            {
              name: "Bot",
              value: user.bot ? "Yes" : "No",
              inline: true
            },
            {
              name: "Joined Discord",
              value: `<t:${Math.floor(
                user.createdTimestamp / 1000
              )}:R>`,
              inline: true
            }
          );

        if (member) {
          embed.addFields({
            name: "Joined Server",
            value: `<t:${Math.floor(
              member.joinedTimestamp / 1000
            )}:R>`,
            inline: true
          });
        }

        return interaction.reply({
          embeds: [embed]
        });
      }

      // SERVERINFO
      if (command === "serverinfo") {
        const guild = interaction.guild;

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Server Info — ${guild.name}`)
          .setThumbnail(guild.iconURL({ size: 1024 }))
          .addFields(
            {
              name: "Members",
              value: `${guild.memberCount}`,
              inline: true
            },
            {
              name: "Channels",
              value: `${guild.channels.cache.size}`,
              inline: true
            },
            {
              name: "Roles",
              value: `${guild.roles.cache.size}`,
              inline: true
            },
            {
              name: "Server ID",
              value: guild.id,
              inline: true
            },
            {
              name: "Created",
              value: `<t:${Math.floor(
                guild.createdTimestamp / 1000
              )}:R>`,
              inline: true
            }
          );

        return interaction.reply({
          embeds: [embed]
        });
      }

      // AVATAR
      if (command === "avatar") {
        const user =
          interaction.options.getUser("user") || interaction.user;

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${user.tag}'s Avatar`)
          .setImage(user.displayAvatarURL({ size: 4096 }));

        return interaction.reply({
          embeds: [embed]
        });
      }

      // ======================================================
      // TICKET PANEL
      // ======================================================

      if (command === "ticketpanel") {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Kenk Community Support")
          .setDescription(
            "Need help? Select the category that matches your issue below."
          )
          .addFields(
            {
              name: "💬 General Support",
              value: "General questions and assistance.",
              inline: true
            },
            {
              name: "🛠️ Script and bug reports",
              value: "Report scripts, bugs or problems.",
              inline: true
            },
            {
              name: "🎁 Giveaway Support",
              value: "Problems involving giveaways.",
              inline: true
            },
            {
              name: "👮 Staff/Helper Report",
              value: "Report a staff or helper issue.",
              inline: true
            }
          )
          .setFooter({
            text: "Kenk Community"
          });

        const menu = new StringSelectMenuBuilder()
          .setCustomId("ticket_category")
          .setPlaceholder("Select a ticket category")
          .addOptions(
            {
              label: "General Support",
              description: "Get general help",
              value: "general"
            },
            {
              label: "Script and bug reports",
              description: "Report a script or bug",
              value: "script"
            },
            {
              label: "Giveaway Support",
              description: "Get help with a giveaway",
              value: "giveaway"
            },
            {
              label: "Staff/Helper Report",
              description: "Report a staff/helper",
              value: "staff"
            }
          );

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.channel.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content: "✅ Ticket panel created.",
          ephemeral: true
        });
      }

      // ======================================================
      // GIVEAWAY
      // ======================================================

      if (command === "giveaway") {
        const minutes = interaction.options.getInteger("minutes");
        const winners = interaction.options.getInteger("winners");
        const prize = interaction.options.getString("prize");

        const endTime = Date.now() + minutes * 60 * 1000;

        const giveawayEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🎉 Giveaway")
          .setDescription(
            `**Prize:** ${prize}\n\n` +
            `**Winners:** ${winners}\n` +
            `**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
            "Click the button below to enter!"
          )
          .setFooter({
            text: "Kenk Community"
          });

        const button = new ButtonBuilder()
          .setCustomId("giveaway_enter")
          .setLabel("Enter Giveaway")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const message = await interaction.channel.send({
          embeds: [giveawayEmbed],
          components: [row]
        });

        data.giveaways[message.id] = {
          channelId: interaction.channel.id,
          guildId: interaction.guild.id,
          prize,
          winners,
          endTime,
          entries: [],
          ended: false
        };

        saveData();

        return interaction.reply({
          content: "✅ Giveaway created.",
          ephemeral: true
        });
      }

      // REROLL
      if (command === "reroll") {
        const messageId = interaction.options.getString("messageid");
        const giveaway = data.giveaways[messageId];

        if (!giveaway) {
          return interaction.reply({
            embeds: [errorEmbed("Giveaway not found.")],
            ephemeral: true
          });
        }

        if (!giveaway.entries.length) {
          return interaction.reply({
            embeds: [errorEmbed("There are no entries.")],
            ephemeral: true
          });
        }

        const winner =
          giveaway.entries[
            Math.floor(Math.random() * giveaway.entries.length)
          ];

        return interaction.reply({
          embeds: [
            successEmbed(
              "Giveaway Rerolled",
              `🎉 New winner: <@${winner}>`
            )
          ]
        });
      }

      // ======================================================
      // BOOSTER ROLE
      // ======================================================

      if (command === "br") {
        const name = interaction.options.getString("name");
        let color = interaction.options.getString("color");

        if (!/^#[0-9A-Fa-f]{6}$/.test(color || "")) {
          color = "#5865F2";
        }

        const member = interaction.member;

        if (!member.premiumSince) {
          return interaction.reply({
            embeds: [
              errorEmbed(
                "You must be a server booster to use this command."
              )
            ],
            ephemeral: true
          });
        }

        const existingId = data.boosterRoles[member.id];

        if (existingId) {
          const existing = interaction.guild.roles.cache.get(existingId);

          if (existing) {
            return interaction.reply({
              embeds: [
                errorEmbed(
                  `You already have a booster role: ${existing}`
                )
              ],
              ephemeral: true
            });
          }
        }

        const role = await interaction.guild.roles.create({
          name,
          color,
          reason: `Booster role created by ${member.user.tag}`
        });

        data.boosterRoles[member.id] = role.id;
        saveData();

        try {
          await member.roles.add(role);
        } catch {}

        return interaction.reply({
          embeds: [
            successEmbed(
              "Booster Role Created",
              `Your custom role ${role} has been created and assigned to you.`
            )
          ]
        });
      }
    }

    // ========================================================
    // TICKET SELECT MENU
    // ========================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_category"
    ) {
      const category = interaction.values[0];

      const categoryNames = {
        general: "General Support",
        script: "Script and bug reports",
        giveaway: "Giveaway Support",
        staff: "Staff Helper Report"
      };

      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${category}`)
        .setTitle(categoryNames[category]);

      const issueInput = new TextInputBuilder()
        .setCustomId("issue")
        .setLabel("What do you need help with?")
        .setPlaceholder("Briefly explain your issue...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(issueInput)
      );

      return interaction.showModal(modal);
    }

    // ========================================================
    // TICKET MODAL
    // ========================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticket_modal_")
    ) {
      const category = interaction.customId.replace(
        "ticket_modal_",
        ""
      );

      const issue = interaction.fields.getTextInputValue("issue");

      const existingTicket = Object.values(data.tickets).find(
        ticket =>
          ticket.guildId === interaction.guild.id &&
          ticket.userId === interaction.user.id &&
          !ticket.closed
      );

      if (existingTicket) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              `You already have an open ticket: <#${existingTicket.channelId}>`
            )
          ],
          ephemeral: true
        });
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${cleanName(interaction.user.username)}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages
            ]
          }
        ]
      });

      data.tickets[channel.id] = {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        category,
        issue,
        claimedBy: null,
        closed: false,
        createdAt: Date.now()
      };

      saveData();

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Kenk Community — ${categoryNames(category)}`)
        .setDescription(
          `Welcome <@${interaction.user.id}>!\n\n` +
          `**Issue:**\n${issue}\n\n` +
          "A staff member will assist you shortly."
        )
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@&${STAFF_ROLE_ID}>`,
        embeds: [embed],
        components: [buttons],
        allowedMentions: {
          roles: [STAFF_ROLE_ID]
        }
      });

      return interaction.reply({
        content: `✅ Ticket created: ${channel}`,
        ephemeral: true
      });
    }

    // ========================================================
    // TICKET BUTTONS
    // ========================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_claim"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [errorEmbed("Only staff can claim tickets.")],
          ephemeral: true
        });
      }

      const ticket = data.tickets[interaction.channel.id];

      if (!ticket || ticket.closed) {
        return interaction.reply({
          embeds: [errorEmbed("This is not an active ticket.")],
          ephemeral: true
        });
      }

      if (ticket.claimedBy) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              `This ticket has already been claimed by <@${ticket.claimedBy}>.`
            )
          ],
          ephemeral: true
        });
      }

      ticket.claimedBy = interaction.user.id;
      saveData();

      return interaction.reply({
        embeds: [
          successEmbed(
            "Ticket Claimed",
            `${interaction.user} has claimed this ticket.`
          )
        ]
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [errorEmbed("Only staff can close tickets.")],
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("ticket_close_modal")
        .setTitle("Close Ticket");

      const reason = new TextInputBuilder()
        .setCustomId("close_reason")
        .setLabel("Why are you closing this ticket?")
        .setPlaceholder("Enter the closing reason...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(reason)
      );

      return interaction.showModal(modal);
    }

    // ========================================================
    // CLOSE TICKET MODAL
    // ========================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticket_close_modal"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [errorEmbed("Only staff can close tickets.")],
          ephemeral: true
        });
      }

      const reason =
        interaction.fields.getTextInputValue("close_reason");

      const ticket = data.tickets[interaction.channel.id];

      if (ticket) {
        ticket.closed = true;
        ticket.closedBy = interaction.user.id;
        ticket.closeReason = reason;
        ticket.closedAt = Date.now();

        saveData();
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Ticket Closed",
            `**Reason:** ${reason}\n\nThis channel will be deleted in 5 seconds.`
          )
        ]
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete(
            `Ticket closed by ${interaction.user.tag}: ${reason}`
          );
        } catch {}
      }, 5000);

      return;
    }

    // ========================================================
    // GIVEAWAY BUTTON
    // ========================================================

    if (
      interaction.isButton() &&
      interaction.customId === "giveaway_enter"
    ) {
      const giveaway = data.giveaways[interaction.message.id];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({
          embeds: [errorEmbed("This giveaway has ended.")],
          ephemeral: true
        });
      }

      if (Date.now() >= giveaway.endTime) {
        return interaction.reply({
          embeds: [errorEmbed("This giveaway has ended.")],
          ephemeral: true
        });
      }

      if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({
          content: "⚠️ You are already entered.",
          ephemeral: true
        });
      }

      giveaway.entries.push(interaction.user.id);
      saveData();

      return interaction.reply({
        content: "🎉 You have entered the giveaway!",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error("Interaction error:", error);

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Something went wrong.",
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: "❌ Something went wrong.",
          ephemeral: true
        });
      }
    } catch {}
  }
});

// ============================================================
// PREFIX COMMANDS
// ============================================================

client.on("messageCreate", async message => {
  try {
    if (message.author.bot || !message.guild) return;

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // --------------------------------------------------------
    // HELP
    // --------------------------------------------------------

    if (command === "help") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Kenk Community — Prefix Commands")
        .setDescription(
          `**Prefix:** \`${PREFIX}\`\n\n` +
          "**Moderation**\n" +
          `\`${PREFIX}ban @user [reason]\`\n` +
          `\`${PREFIX}unban USER_ID\`\n` +
          `\`${PREFIX}kick @user [reason]\`\n` +
          `\`${PREFIX}mute @user minutes [reason]\`\n` +
          `\`${PREFIX}unmute @user\`\n` +
          `\`${PREFIX}warn @user reason\`\n` +
          `\`${PREFIX}warnings @user\`\n` +
          `\`${PREFIX}clear amount\`\n` +
          `\`${PREFIX}purge @user amount\`\n` +
          `\`${PREFIX}clean amount\`\n` +
          `\`${PREFIX}lock\`\n` +
          `\`${PREFIX}unlock\`\n` +
          `\`${PREFIX}slowmode seconds\`\n\n` +
          "**Community**\n" +
          `\`${PREFIX}say message\`\n` +
          `\`${PREFIX}dm @user message\`\n` +
          `\`${PREFIX}userinfo @user\`\n` +
          `\`${PREFIX}serverinfo\`\n` +
          `\`${PREFIX}avatar @user\`\n` +
          `\`${PREFIX}ticketpanel\`\n` +
          `\`${PREFIX}giveaway minutes winners prize\`\n` +
          `\`${PREFIX}reroll messageID\`\n\n` +
          "**Booster**\n" +
          `\`${PREFIX}br role name | color\``
        );

      return message.reply({ embeds: [embed] });
    }

    // --------------------------------------------------------
    // PING
    // --------------------------------------------------------

    if (command === "ping") {
      return message.reply(`🏓 Pong! \`${client.ws.ping}ms\``);
    }

    // --------------------------------------------------------
    // STAFF COMMAND CHECK
    // --------------------------------------------------------

    const staffCommands = [
      "ban",
      "unban",
      "kick",
      "mute",
      "unmute",
      "warn",
      "warnings",
      "clear",
      "purge",
      "clean",
      "lock",
      "unlock",
      "slowmode",
      "dm",
      "ticketpanel",
      "giveaway",
      "reroll"
    ];

    if (staffCommands.includes(command) && !isStaff(message.member)) {
      return message.reply({
        embeds: [
          errorEmbed("You don't have permission to use this command.")
        ]
      });
    }

    // --------------------------------------------------------
    // BAN
    // --------------------------------------------------------

    if (command === "ban") {
      const member = getUserFromMention(message, args[0]);
      const reason =
        args.slice(1).join(" ") || "No reason provided";

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}ban @user [reason]\``
        );
      }

      if (!member.bannable) {
        return message.reply("❌ I cannot ban that member.");
      }

      await member.ban({ reason });

      return message.reply({
        embeds: [
          successEmbed(
            "Member Banned",
            `**${member.user.tag}** has been banned.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // UNBAN
    // --------------------------------------------------------

    if (command === "unban") {
      const userId = args[0];

      if (!userId) {
        return message.reply(
          `❌ Usage: \`${PREFIX}unban USER_ID\``
        );
      }

      await message.guild.members.unban(userId);

      return message.reply({
        embeds: [
          successEmbed(
            "User Unbanned",
            `User ID \`${userId}\` has been unbanned.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // KICK
    // --------------------------------------------------------

    if (command === "kick") {
      const member = getUserFromMention(message, args[0]);
      const reason =
        args.slice(1).join(" ") || "No reason provided";

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}kick @user [reason]\``
        );
      }

      if (!member.kickable) {
        return message.reply("❌ I cannot kick that member.");
      }

      await member.kick(reason);

      return message.reply({
        embeds: [
          successEmbed(
            "Member Kicked",
            `**${member.user.tag}** has been kicked.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // MUTE
    // --------------------------------------------------------

    if (command === "mute") {
      const member = getUserFromMention(message, args[0]);
      const minutes = parseInt(args[1]);
      const reason =
        args.slice(2).join(" ") || "No reason provided";

      if (!member || Number.isNaN(minutes)) {
        return message.reply(
          `❌ Usage: \`${PREFIX}mute @user minutes [reason]\``
        );
      }

      if (!member.moderatable) {
        return message.reply("❌ I cannot mute that member.");
      }

      const safeMinutes = Math.max(1, Math.min(minutes, 40320));

      await member.timeout(
        safeMinutes * 60 * 1000,
        reason
      );

      return message.reply({
        embeds: [
          successEmbed(
            "Member Muted",
            `**${member.user.tag}** has been timed out for **${safeMinutes} minutes**.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // UNMUTE
    // --------------------------------------------------------

    if (command === "unmute") {
      const member = getUserFromMention(message, args[0]);

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}unmute @user\``
        );
      }

      await member.timeout(null, "Timeout removed by staff");

      return message.reply({
        embeds: [
          successEmbed(
            "Member Unmuted",
            `**${member.user.tag}** is no longer timed out.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // WARN
    // --------------------------------------------------------

    if (command === "warn") {
      const member = getUserFromMention(message, args[0]);
      const reason =
        args.slice(1).join(" ") || "No reason provided";

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}warn @user reason\``
        );
      }

      if (!data.warnings[member.id]) {
        data.warnings[member.id] = [];
      }

      data.warnings[member.id].push({
        reason,
        moderator: message.author.id,
        timestamp: Date.now()
      });

      saveData();

      return message.reply({
        embeds: [
          successEmbed(
            "Warning Added",
            `**${member.user.tag}** has been warned.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // WARNINGS
    // --------------------------------------------------------

    if (command === "warnings") {
      const userId = getUserIdFromMention(args[0]);

      if (!userId) {
        return message.reply(
          `❌ Usage: \`${PREFIX}warnings @user\``
        );
      }

      const warnings = data.warnings[userId] || [];

      if (!warnings.length) {
        return message.reply("✅ That user has no warnings.");
      }

      const text = warnings
        .map(
          (warning, index) =>
            `**${index + 1}.** ${warning.reason}\nModerator: <@${warning.moderator}>`
        )
        .join("\n\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle("Warnings")
            .setDescription(text)
        ]
      });
    }

    // --------------------------------------------------------
    // CLEAR
    // --------------------------------------------------------

    if (command === "clear") {
      const amount = getAmount(args[0]);

      const deleted = await message.channel.bulkDelete(
        amount + 1,
        true
      );

      return message.channel.send({
        embeds: [
          successEmbed(
            "Messages Cleared",
            `Deleted **${Math.max(0, deleted.size - 1)}** messages.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // PURGE USER
    // --------------------------------------------------------

    if (command === "purge") {
      const member = getUserFromMention(message, args[0]);
      const amount = getAmount(args[1]);

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}purge @user amount\``
        );
      }

      const messages = await message.channel.messages.fetch({
        limit: 100
      });

      const selected = messages
        .filter(msg => msg.author.id === member.id)
        .first(amount);

      if (!selected.length) {
        return message.reply(
          "❌ No messages from that user were found."
        );
      }

      const deleted = await message.channel.bulkDelete(
        selected,
        true
      );

      return message.channel.send({
        embeds: [
          successEmbed(
            "User Messages Purged",
            `Deleted **${deleted.size}** messages from **${member.user.tag}**.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // CLEAN BOT MESSAGES
    // --------------------------------------------------------

    if (command === "clean") {
      const amount = getAmount(args[0]);

      const messages = await message.channel.messages.fetch({
        limit: 100
      });

      const selected = messages
        .filter(msg => msg.author.bot)
        .first(amount);

      if (!selected.length) {
        return message.reply("❌ No bot messages were found.");
      }

      const deleted = await message.channel.bulkDelete(
        selected,
        true
      );

      return message.channel.send({
        embeds: [
          successEmbed(
            "Bot Messages Cleared",
            `Deleted **${deleted.size}** bot messages.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // LOCK
    // --------------------------------------------------------

    if (command === "lock") {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      return message.reply({
        embeds: [
          successEmbed(
            "Channel Locked",
            "Members can no longer send messages here."
          )
        ]
      });
    }

    // --------------------------------------------------------
    // UNLOCK
    // --------------------------------------------------------

    if (command === "unlock") {
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      return message.reply({
        embeds: [
          successEmbed(
            "Channel Unlocked",
            "Members can send messages again."
          )
        ]
      });
    }

    // --------------------------------------------------------
    // SLOWMODE
    // --------------------------------------------------------

    if (command === "slowmode") {
      const seconds = parseInt(args[0]);

      if (Number.isNaN(seconds)) {
        return message.reply(
          `❌ Usage: \`${PREFIX}slowmode seconds\``
        );
      }

      const safeSeconds = Math.max(
        0,
        Math.min(seconds, 21600)
      );

      await message.channel.setRateLimitPerUser(
        safeSeconds
      );

      return message.reply({
        embeds: [
          successEmbed(
            "Slowmode Updated",
            `Slowmode is now **${safeSeconds} seconds**.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // SAY
    // --------------------------------------------------------

    if (command === "say") {
      const text = args.join(" ");

      if (!text) {
        return message.reply(
          `❌ Usage: \`${PREFIX}say message\``
        );
      }

      await message.delete().catch(() => {});

      return message.channel.send(text);
    }

    // --------------------------------------------------------
    // DM
    // --------------------------------------------------------

    if (command === "dm") {
      const userId = getUserIdFromMention(args[0]);
      const text = args.slice(1).join(" ");

      if (!userId || !text) {
        return message.reply(
          `❌ Usage: \`${PREFIX}dm @user message\``
        );
      }

      const user = await client.users
        .fetch(userId)
        .catch(() => null);

      if (!user) {
        return message.reply("❌ User not found.");
      }

      try {
        await user.send(text);

        return message.reply("✅ DM sent.");
      } catch {
        return message.reply(
          "❌ I couldn't DM that user."
        );
      }
    }

    // --------------------------------------------------------
    // USERINFO
    // --------------------------------------------------------

    if (command === "userinfo") {
      const member =
        getUserFromMention(message, args[0]) ||
        message.member;

      const user = member.user;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`User Info — ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ size: 1024 }))
        .addFields(
          {
            name: "User ID",
            value: user.id,
            inline: true
          },
          {
            name: "Bot",
            value: user.bot ? "Yes" : "No",
            inline: true
          },
          {
            name: "Joined Server",
            value: member.joinedTimestamp
              ? `<t:${Math.floor(
                  member.joinedTimestamp / 1000
                )}:R>`
              : "Unknown",
            inline: true
          }
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // --------------------------------------------------------
    // SERVERINFO
    // --------------------------------------------------------

    if (command === "serverinfo") {
      const guild = message.guild;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Server Info — ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 1024 }))
        .addFields(
          {
            name: "Members",
            value: `${guild.memberCount}`,
            inline: true
          },
          {
            name: "Channels",
            value: `${guild.channels.cache.size}`,
            inline: true
          },
          {
            name: "Roles",
            value: `${guild.roles.cache.size}`,
            inline: true
          },
          {
            name: "Server ID",
            value: guild.id,
            inline: true
          }
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    if (command === "avatar") {
      const member =
        getUserFromMention(message, args[0]) ||
        message.member;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${member.user.tag}'s Avatar`)
        .setImage(
          member.user.displayAvatarURL({
            size: 4096
          })
        );

      return message.reply({
        embeds: [embed]
      });
    }

    // --------------------------------------------------------
    // TICKET PANEL
    // --------------------------------------------------------

    if (command === "ticketpanel") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Kenk Community Support")
        .setDescription(
          "Need help? Select the category that matches your issue below."
        )
        .addFields(
          {
            name: "💬 General Support",
            value: "General questions and assistance.",
            inline: true
          },
          {
            name: "🛠️ Script and bug reports",
            value: "Report scripts, bugs or problems.",
            inline: true
          },
          {
            name: "🎁 Giveaway Support",
            value: "Problems involving giveaways.",
            inline: true
          },
          {
            name: "👮 Staff/Helper Report",
            value: "Report a staff or helper issue.",
            inline: true
          }
        );

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_category")
        .setPlaceholder("Select a ticket category")
        .addOptions(
          {
            label: "General Support",
            description: "Get general help",
            value: "general"
          },
          {
            label: "Script and bug reports",
            description: "Report a script or bug",
            value: "script"
          },
          {
            label: "Giveaway Support",
            description: "Get help with giveaways",
            value: "giveaway"
          },
          {
            label: "Staff/Helper Report",
            description: "Report a staff/helper",
            value: "staff"
          }
        );

      await message.channel.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });

      return message.reply("✅ Ticket panel created.");
    }

    // --------------------------------------------------------
    // GIVEAWAY
    // --------------------------------------------------------

    if (command === "giveaway") {
      const minutes = parseInt(args[0]);
      const winners = parseInt(args[1]);
      const prize = args.slice(2).join(" ");

      if (
        Number.isNaN(minutes) ||
        Number.isNaN(winners) ||
        !prize
      ) {
        return message.reply(
          `❌ Usage: \`${PREFIX}giveaway minutes winners prize\``
        );
      }

      const safeMinutes = Math.max(
        1,
        Math.min(minutes, 10080)
      );

      const safeWinners = Math.max(
        1,
        Math.min(winners, 20)
      );

      const endTime =
        Date.now() + safeMinutes * 60 * 1000;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎉 Giveaway")
        .setDescription(
          `**Prize:** ${prize}\n\n` +
          `**Winners:** ${safeWinners}\n` +
          `**Ends:** <t:${Math.floor(
            endTime / 1000
          )}:R>\n\n` +
          "Click the button below to enter!"
        );

      const button = new ButtonBuilder()
        .setCustomId("giveaway_enter")
        .setLabel("Enter Giveaway")
        .setStyle(ButtonStyle.Primary);

      const giveawayMessage =
        await message.channel.send({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(button)
          ]
        });

      data.giveaways[giveawayMessage.id] = {
        channelId: message.channel.id,
        guildId: message.guild.id,
        prize,
        winners: safeWinners,
        endTime,
        entries: [],
        ended: false
      };

      saveData();

      return;
    }

    // --------------------------------------------------------
    // REROLL
    // --------------------------------------------------------

    if (command === "reroll") {
      const messageId = args[0];
      const giveaway = data.giveaways[messageId];

      if (!giveaway) {
        return message.reply("❌ Giveaway not found.");
      }

      if (!giveaway.entries.length) {
        return message.reply("❌ There are no entries.");
      }

      const winner =
        giveaway.entries[
          Math.floor(
            Math.random() * giveaway.entries.length
          )
        ];

      return message.reply(
        `🎉 New giveaway winner: <@${winner}>`
      );
    }

    // --------------------------------------------------------
    // BOOSTER ROLE
    // --------------------------------------------------------

    if (command === "br") {
      if (!message.member.premiumSince) {
        return message.reply(
          "❌ You must be a server booster to use this command."
        );
      }

      const roleName = args.join(" ");

      if (!roleName) {
        return message.reply(
          `❌ Usage: \`${PREFIX}br role name\``
        );
      }

      const existingId = data.boosterRoles[message.author.id];

      if (existingId) {
        const existing =
          message.guild.roles.cache.get(existingId);

        if (existing) {
          return message.reply(
            `❌ You already have a booster role: ${existing}`
          );
        }
      }

      const role = await message.guild.roles.create({
        name: roleName.slice(0, 100),
        color: "#5865F2",
        reason: `Booster role created by ${message.author.tag}`
      });

      data.boosterRoles[message.author.id] = role.id;
      saveData();

      await message.member.roles.add(role).catch(() => {});

      return message.reply({
        embeds: [
          successEmbed(
            "Booster Role Created",
            `Your custom role ${role} has been created and assigned to you.`
          )
        ]
      });
    }
  } catch (error) {
    console.error("Prefix command error:", error);

    return message.reply({
      embeds: [
        errorEmbed(
          "Something went wrong while running that command."
        )
      ]
    }).catch(() => {});
  }
});

// ============================================================
// BOOSTER ROLE CLEANUP
// ============================================================

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    // Booster stopped boosting
    if (oldMember.premiumSince && !newMember.premiumSince) {
      const roleId = data.boosterRoles[newMember.id];

      if (!roleId) return;

      const role = newMember.guild.roles.cache.get(roleId);

      if (role) {
        await role.delete(
          "Booster stopped boosting the server"
        ).catch(() => {});
      }

      delete data.boosterRoles[newMember.id];
      saveData();
    }
  } catch (error) {
    console.error("Booster cleanup error:", error);
  }
});

// ============================================================
// GIVEAWAY CHECKER
// ============================================================

setInterval(async () => {
  try {
    const now = Date.now();

    for (const [messageId, giveaway] of Object.entries(
      data.giveaways
    )) {
      if (giveaway.ended) continue;

      if (now < giveaway.endTime) continue;

      giveaway.ended = true;
      saveData();

      const channel = await client.channels
        .fetch(giveaway.channelId)
        .catch(() => null);

      if (!channel) continue;

      const giveawayMessage = await channel.messages
        .fetch(messageId)
        .catch(() => null);

      const entries = [...new Set(giveaway.entries)];

      if (!entries.length) {
        await channel.send(
          `🎉 Giveaway ended for **${giveaway.prize}**, but there were no valid entries.`
        );

        continue;
      }

      const shuffled = entries.sort(
        () => Math.random() - 0.5
      );

      const winners = shuffled.slice(
        0,
        Math.min(giveaway.winners, shuffled.length)
      );

      await channel.send(
        `🎉 **Giveaway Ended!**\n\n` +
        `**Prize:** ${giveaway.prize}\n` +
        `**Winner${winners.length > 1 ? "s" : ""}:** ` +
        winners.map(id => `<@${id}>`).join(", ")
      );

      if (giveawayMessage) {
        const disabledButton =
          new ButtonBuilder()
            .setCustomId("giveaway_ended")
            .setLabel("Giveaway Ended")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        await giveawayMessage.edit({
          components: [
            new ActionRowBuilder().addComponents(
              disabledButton
            )
          ]
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("Giveaway checker error:", error);
  }
}, 10000);

// ============================================================
// CATEGORY NAME
// ============================================================

function categoryNames(category) {
  const names = {
    general: "General Support",
    script: "Script and bug reports",
    giveaway: "Giveaway Support",
    staff: "Staff/Helper Report"
  };

  return names[category] || "Support";
}

// ============================================================
// LOGIN
// ============================================================

client.login(TOKEN);
