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
const GUILD_ID = process.env.GUILD_ID;

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1506669903673950338";
const TICKET_CATEGORY_ID = "1507026446940508351";

const PREFIX = process.env.PREFIX || ",";

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID is missing.");
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
    data = { ...data, ...saved };
  } catch {
    console.log("⚠️ Could not read data.json. Starting fresh.");
  }
}

function saveData() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Failed to save data:", error);
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
    .slice(0, 70);
}

function successEmbed(text) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(`✅ ${text}`);
}

function errorEmbed(text) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(`❌ ${text}`);
}

function infoEmbed(text) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setDescription(text);
}

function getMemberFromMention(message, text) {
  const match = text?.match(/^<@!?(\d+)>$/);

  if (!match) return null;

  return message.guild.members.cache.get(match[1]) || null;
}

function getUserIdFromMention(text) {
  const match = text?.match(/^<@!?(\d+)>$/);
  return match ? match[1] : null;
}

function getCategoryName(category) {
  const names = {
    general: "General Support",
    script: "Script & Bug Reports",
    giveaway: "Giveaway Support",
    staff: "Staff / Helper Report"
  };

  return names[category] || "Support";
}

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("setupprefix")
    .setDescription("Show the bot prefix"),

  // MODERATION

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member to ban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("User ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member to kick")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member to mute")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("Duration in minutes")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a timeout")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Warning reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages from a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("clean")
    .setDescription("Delete bot messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock the channel"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock the channel"),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("Seconds")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  // COMMUNITY

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("DM a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View user information")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server information"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("View a user's avatar")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  // TICKETS

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create the ticket panel"),

  // GIVEAWAY

  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create a giveaway")
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("Duration")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10080)
    )
    .addIntegerOption(o =>
      o.setName("winners")
        .setDescription("Number of winners")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(o =>
      o.setName("prize")
        .setDescription("Prize")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("reroll")
    .setDescription("Reroll a giveaway")
    .addStringOption(o =>
      o.setName("messageid")
        .setDescription("Giveaway message ID")
        .setRequired(true)
    ),

  // BOOSTER

  new SlashCommandBuilder()
    .setName("br")
    .setDescription("Create your booster role")
    .addStringOption(o =>
      o.setName("name")
        .setDescription("Role name")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("color")
        .setDescription("Hex color, example #ff0000")
        .setRequired(false)
    )
];

// ============================================================
// REGISTER SLASH COMMANDS
// ============================================================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("🔄 Removing old global slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: [] }
    );

    console.log("✅ Old global commands removed.");

    console.log("🔄 Registering commands to your server...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: commands.map(command => command.toJSON())
      }
    );

    console.log("✅ Slash commands registered to your server.");
  } catch (error) {
    console.error("❌ Slash command registration failed:");
    console.error(error);
  }
}

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
  console.log("--------------------------------");
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log(`⚡ Prefix: ${PREFIX}`);
  console.log("--------------------------------");

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
// INTERACTIONS
// ============================================================

client.on("interactionCreate", async interaction => {

  try {

    // ========================================================
    // SLASH COMMANDS
    // ========================================================

    if (interaction.isChatInputCommand()) {

      if (!interaction.guild) {
        return interaction.reply({
          embeds: [
            errorEmbed("This command can only be used in a server.")
          ],
          ephemeral: true
        });
      }

      const command = interaction.commandName;

      // ======================================================
      // HELP
      // ======================================================

      if (command === "help") {

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Kenk Community")
          .setDescription(
            "**Moderation**\n" +
            "`/ban` `/unban` `/kick` `/mute` `/unmute`\n" +
            "`/warn` `/warnings` `/clear` `/purge` `/clean`\n" +
            "`/lock` `/unlock` `/slowmode`\n\n" +

            "**Community**\n" +
            "`/ticketpanel` `/giveaway` `/reroll`\n" +
            "`/say` `/dm` `/userinfo` `/serverinfo` `/avatar`\n\n" +

            "**Booster**\n" +
            "`/br`"
          );

        return interaction.reply({
          embeds: [embed]
        });
      }

      // ======================================================
      // PING
      // ======================================================

      if (command === "ping") {
        return interaction.reply(
          `🏓 Pong! \`${client.ws.ping}ms\``
        );
      }

      // ======================================================
      // PREFIX
      // ======================================================

      if (command === "setupprefix") {
        return interaction.reply({
          embeds: [
            infoEmbed(`Current prefix: \`${PREFIX}\``)
          ]
        });
      }

      // ======================================================
      // STAFF CHECK
      // ======================================================

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

      if (
        staffCommands.includes(command) &&
        !isStaff(interaction.member)
      ) {
        return interaction.reply({
          embeds: [
            errorEmbed("You don't have permission to use this command.")
          ],
          ephemeral: true
        });
      }

      // ======================================================
      // BAN
      // ======================================================

      if (command === "ban") {

        const user = interaction.options.getUser("user");

        const reason =
          interaction.options.getString("reason") ||
          "No reason provided";

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        if (!member) {
          return interaction.reply({
            embeds: [
              errorEmbed("That user is not in this server.")
            ],
            ephemeral: true
          });
        }

        if (!member.bannable) {
          return interaction.reply({
            embeds: [
              errorEmbed("I cannot ban that member.")
            ],
            ephemeral: true
          });
        }

        await member.ban({ reason });

        return interaction.reply({
          embeds: [
            successEmbed(
              `**${user.tag}** was banned.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // ======================================================
      // UNBAN
      // ======================================================

      if (command === "unban") {

        const userId =
          interaction.options.getString("userid");

        await interaction.guild.members.unban(userId);

        return interaction.reply({
          embeds: [
            successEmbed(
              `User with ID \`${userId}\` was unbanned.`
            )
          ]
        });
      }

      // ======================================================
      // KICK
      // ======================================================

      if (command === "kick") {

        const user =
          interaction.options.getUser("user");

        const reason =
          interaction.options.getString("reason") ||
          "No reason provided";

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member || !member.kickable) {
          return interaction.reply({
            embeds: [
              errorEmbed("I cannot kick that member.")
            ],
            ephemeral: true
          });
        }

        await member.kick(reason);

        return interaction.reply({
          embeds: [
            successEmbed(
              `**${user.tag}** was kicked.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // ======================================================
      // MUTE
      // ======================================================

      if (command === "mute") {

        const user =
          interaction.options.getUser("user");

        const minutes =
          interaction.options.getInteger("minutes");

        const reason =
          interaction.options.getString("reason") ||
          "No reason provided";

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member || !member.moderatable) {
          return interaction.reply({
            embeds: [
              errorEmbed("I cannot mute that member.")
            ],
            ephemeral: true
          });
        }

        await member.timeout(
          minutes * 60 * 1000,
          reason
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              `**${user.tag}** was muted for **${minutes} minutes**.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // ======================================================
      // UNMUTE
      // ======================================================

      if (command === "unmute") {

        const user =
          interaction.options.getUser("user");

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {
          return interaction.reply({
            embeds: [
              errorEmbed("Member not found.")
            ],
            ephemeral: true
          });
        }

        await member.timeout(
          null,
          "Timeout removed by staff"
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              `**${user.tag}** was unmuted.`
            )
          ]
        });
      }

      // ======================================================
      // WARN
      // ======================================================

      if (command === "warn") {

        const user =
          interaction.options.getUser("user");

        const reason =
          interaction.options.getString("reason");

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
              `**${user.tag}** was warned.\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // ======================================================
      // WARNINGS
      // ======================================================

      if (command === "warnings") {

        const user =
          interaction.options.getUser("user");

        const warnings =
          data.warnings[user.id] || [];

        if (!warnings.length) {
          return interaction.reply({
            embeds: [
              infoEmbed(
                `**${user.tag}** has no warnings.`
              )
            ]
          });
        }

        const text = warnings
          .map(
            (w, i) =>
              `**${i + 1}.** ${w.reason}\nModerator: <@${w.moderator}>`
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

      // ======================================================
      // CLEAR
      // ======================================================

      if (command === "clear") {

        const amount =
          interaction.options.getInteger("amount");

        const deleted =
          await interaction.channel.bulkDelete(
            amount,
            true
          );

        return interaction.reply({
          embeds: [
            successEmbed(
              `Deleted **${deleted.size}** messages.`
            )
          ],
          ephemeral: true
        });
      }

      // ======================================================
      // PURGE
      // ======================================================

      if (command === "purge") {

        const user =
          interaction.options.getUser("user");

        const amount =
          interaction.options.getInteger("amount");

        const messages =
          await interaction.channel.messages.fetch({
            limit: 100
          });

        const selected =
          messages
            .filter(m => m.author.id === user.id)
            .first(amount);

        if (!selected.length) {
          return interaction.reply({
            embeds: [
              errorEmbed(
                "No messages from that user were found."
              )
            ],
            ephemeral: true
          });
        }

        const deleted =
          await interaction.channel.bulkDelete(
            selected,
            true
          );

        return interaction.reply({
          embeds: [
            successEmbed(
              `Deleted **${deleted.size}** messages from **${user.tag}**.`
            )
          ],
          ephemeral: true
        });
      }

      // ======================================================
      // CLEAN
      // ======================================================

      if (command === "clean") {

        const amount =
          interaction.options.getInteger("amount");

        const messages =
          await interaction.channel.messages.fetch({
            limit: 100
          });

        const selected =
          messages
            .filter(m => m.author.bot)
            .first(amount);

        if (!selected.length) {
          return interaction.reply({
            embeds: [
              errorEmbed("No bot messages were found.")
            ],
            ephemeral: true
          });
        }

        const deleted =
          await interaction.channel.bulkDelete(
            selected,
            true
          );

        return interaction.reply({
          embeds: [
            successEmbed(
              `Deleted **${deleted.size}** bot messages.`
            )
          ],
          ephemeral: true
        });
      }

      // ======================================================
      // LOCK
      // ======================================================

      if (command === "lock") {

        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: false
          }
        );

        return interaction.reply({
          embeds: [
            successEmbed("This channel was locked.")
          ]
        });
      }

      // ======================================================
      // UNLOCK
      // ======================================================

      if (command === "unlock") {

        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: null
          }
        );

        return interaction.reply({
          embeds: [
            successEmbed("This channel was unlocked.")
          ]
        });
      }

      // ======================================================
      // SLOWMODE
      // ======================================================

      if (command === "slowmode") {

        const seconds =
          interaction.options.getInteger("seconds");

        await interaction.channel.setRateLimitPerUser(
          seconds
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              `Slowmode set to **${seconds} seconds**.`
            )
          ]
        });
      }

      // ======================================================
      // SAY
      // ======================================================

      if (command === "say") {

        const text =
          interaction.options.getString("message");

        await interaction.channel.send(text);

        return interaction.reply({
          content: "✅ Sent.",
          ephemeral: true
        });
      }

      // ======================================================
      // DM
      // ======================================================

      if (command === "dm") {

        const user =
          interaction.options.getUser("user");

        const text =
          interaction.options.getString("message");

        try {

          await user.send(text);

          return interaction.reply({
            embeds: [
              successEmbed(
                `DM sent to **${user.tag}**.`
              )
            ],
            ephemeral: true
          });

        } catch {

          return interaction.reply({
            embeds: [
              errorEmbed(
                "I couldn't DM that user."
              )
            ],
            ephemeral: true
          });
        }
      }

      // ======================================================
      // USERINFO
      // ======================================================

      if (command === "userinfo") {

        const user =
          interaction.options.getUser("user") ||
          interaction.user;

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`User Info — ${user.tag}`)
          .setThumbnail(
            user.displayAvatarURL({
              size: 1024
            })
          )
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
            }
          );

        if (member?.joinedTimestamp) {
          embed.addFields({
            name: "Joined",
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

      // ======================================================
      // SERVERINFO
      // ======================================================

      if (command === "serverinfo") {

        const guild = interaction.guild;

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Server Info — ${guild.name}`)
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
            }
          );

        return interaction.reply({
          embeds: [embed]
        });
      }

      // ======================================================
      // AVATAR
      // ======================================================

      if (command === "avatar") {

        const user =
          interaction.options.getUser("user") ||
          interaction.user;

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${user.tag}'s Avatar`)
          .setImage(
            user.displayAvatarURL({
              size: 4096
            })
          );

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
            "Select the category that best matches your issue."
          )
          .addFields(
            {
              name: "💬 General Support",
              value: "General questions and help.",
              inline: true
            },
            {
              name: "🛠️ Script & Bug Reports",
              value: "Report scripts or bugs.",
              inline: true
            },
            {
              name: "🎁 Giveaway Support",
              value: "Problems with giveaways.",
              inline: true
            },
            {
              name: "👮 Staff / Helper Report",
              value: "Report a staff/helper issue.",
              inline: true
            }
          )
          .setFooter({
            text: "Kenk Community"
          });

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId("ticket_category")
            .setPlaceholder("Select a ticket category")
            .addOptions(
              {
                label: "General Support",
                description: "Get general help",
                value: "general"
              },
              {
                label: "Script & Bug Reports",
                description: "Report a script or bug",
                value: "script"
              },
              {
                label: "Giveaway Support",
                description: "Get giveaway help",
                value: "giveaway"
              },
              {
                label: "Staff / Helper Report",
                description: "Report a staff/helper",
                value: "staff"
              }
            );

        await interaction.channel.send({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(menu)
          ]
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

        const minutes =
          interaction.options.getInteger("minutes");

        const winners =
          interaction.options.getInteger("winners");

        const prize =
          interaction.options.getString("prize");

        const endTime =
          Date.now() + minutes * 60 * 1000;

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🎉 Giveaway")
          .setDescription(
            `**Prize:** ${prize}\n\n` +
            `**Winners:** ${winners}\n` +
            `**Ends:** <t:${Math.floor(
              endTime / 1000
            )}:R>\n\n` +
            "Click the button below to enter."
          );

        const button =
          new ButtonBuilder()
            .setCustomId("giveaway_enter")
            .setLabel("Enter Giveaway")
            .setStyle(ButtonStyle.Primary);

        const msg =
          await interaction.channel.send({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(button)
            ]
          });

        data.giveaways[msg.id] = {
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

      // ======================================================
      // REROLL
      // ======================================================

      if (command === "reroll") {

        const messageId =
          interaction.options.getString("messageid");

        const giveaway =
          data.giveaways[messageId];

        if (!giveaway) {
          return interaction.reply({
            embeds: [
              errorEmbed("Giveaway not found.")
            ],
            ephemeral: true
          });
        }

        if (!giveaway.entries.length) {
          return interaction.reply({
            embeds: [
              errorEmbed("There are no entries.")
            ],
            ephemeral: true
          });
        }

        const winner =
          giveaway.entries[
            Math.floor(
              Math.random() *
              giveaway.entries.length
            )
          ];

        return interaction.reply(
          `🎉 New winner: <@${winner}>`
        );
      }

      // ======================================================
      // BOOSTER ROLE
      // ======================================================

      if (command === "br") {

        if (!interaction.member.premiumSince) {
          return interaction.reply({
            embeds: [
              errorEmbed(
                "You must be a server booster to use this command."
              )
            ],
            ephemeral: true
          });
        }

        const name =
          interaction.options.getString("name");

        let color =
          interaction.options.getString("color");

        if (!/^#[0-9A-Fa-f]{6}$/.test(color || "")) {
          color = "#5865F2";
        }

        const oldRoleId =
          data.boosterRoles[interaction.user.id];

        if (oldRoleId) {

          const oldRole =
            interaction.guild.roles.cache.get(oldRoleId);

          if (oldRole) {
            return interaction.reply({
              embeds: [
                errorEmbed(
                  `You already have ${oldRole}.`
                )
              ],
              ephemeral: true
            });
          }
        }

        const role =
          await interaction.guild.roles.create({
            name,
            color,
            reason:
              `Booster role created by ${interaction.user.tag}`
          });

        data.boosterRoles[interaction.user.id] =
          role.id;

        saveData();

        await interaction.member.roles
          .add(role)
          .catch(() => {});

        return interaction.reply({
          embeds: [
            successEmbed(
              `Your booster role ${role} was created and assigned to you.`
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

      const category =
        interaction.values[0];

      const existing =
        Object.values(data.tickets).find(
          ticket =>
            ticket.guildId === interaction.guild.id &&
            ticket.userId === interaction.user.id &&
            !ticket.closed
        );

      if (existing) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              `You already have an open ticket: <#${existing.channelId}>`
            )
          ],
          ephemeral: true
        });
      }

      // ------------------------------------------------------
      // GENERAL SUPPORT
      // ------------------------------------------------------

      if (category === "general") {

        const modal =
          new ModalBuilder()
            .setCustomId("ticket_general")
            .setTitle("General Support");

        const q1 =
          new TextInputBuilder()
            .setCustomId("question1")
            .setLabel("What do you need help with?")
            .setPlaceholder("Explain your issue...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const q2 =
          new TextInputBuilder()
            .setCustomId("question2")
            .setLabel("When did this issue start?")
            .setPlaceholder("Tell us when it started...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const q3 =
          new TextInputBuilder()
            .setCustomId("question3")
            .setLabel("Anything else we should know?")
            .setPlaceholder("Additional information...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(q1),
          new ActionRowBuilder().addComponents(q2),
          new ActionRowBuilder().addComponents(q3)
        );

        return interaction.showModal(modal);
      }

      // ------------------------------------------------------
      // SCRIPT / BUG
      // ------------------------------------------------------

      if (category === "script") {

        const modal =
          new ModalBuilder()
            .setCustomId("ticket_script")
            .setTitle("Script & Bug Report");

        const q1 =
          new TextInputBuilder()
            .setCustomId("question1")
            .setLabel("What script or feature is affected?")
            .setPlaceholder("Script/feature name...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const q2 =
          new TextInputBuilder()
            .setCustomId("question2")
            .setLabel("What is the problem?")
            .setPlaceholder("Explain the bug...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const q3 =
          new TextInputBuilder()
            .setCustomId("question3")
            .setLabel("What error do you receive?")
            .setPlaceholder("Paste the error or explain it...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(q1),
          new ActionRowBuilder().addComponents(q2),
          new ActionRowBuilder().addComponents(q3)
        );

        return interaction.showModal(modal);
      }

      // ------------------------------------------------------
      // GIVEAWAY
      // ------------------------------------------------------

      if (category === "giveaway") {

        const modal =
          new ModalBuilder()
            .setCustomId("ticket_giveaway")
            .setTitle("Giveaway Support");

        const q1 =
          new TextInputBuilder()
            .setCustomId("question1")
            .setLabel("Which giveaway is this about?")
            .setPlaceholder("Prize or giveaway message...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const q2 =
          new TextInputBuilder()
            .setCustomId("question2")
            .setLabel("What is the problem?")
            .setPlaceholder("Explain what happened...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const q3 =
          new TextInputBuilder()
            .setCustomId("question3")
            .setLabel("Any proof or extra information?")
            .setPlaceholder("Message ID, screenshot details, etc...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(q1),
          new ActionRowBuilder().addComponents(q2),
          new ActionRowBuilder().addComponents(q3)
        );

        return interaction.showModal(modal);
      }

      // ------------------------------------------------------
      // STAFF REPORT
      // ------------------------------------------------------

      if (category === "staff") {

        const modal =
          new ModalBuilder()
            .setCustomId("ticket_staff")
            .setTitle("Staff / Helper Report");

        const q1 =
          new TextInputBuilder()
            .setCustomId("question1")
            .setLabel("Who are you reporting?")
            .setPlaceholder("Staff/helper username...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const q2 =
          new TextInputBuilder()
            .setCustomId("question2")
            .setLabel("What happened?")
            .setPlaceholder("Explain what happened...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const q3 =
          new TextInputBuilder()
            .setCustomId("question3")
            .setLabel("Do you have any proof?")
            .setPlaceholder("Screenshots, messages, etc...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(q1),
          new ActionRowBuilder().addComponents(q2),
          new ActionRowBuilder().addComponents(q3)
        );

        return interaction.showModal(modal);
      }
    }

    // ========================================================
    // TICKET MODALS
    // ========================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticket_") &&
      interaction.customId !== "ticket_close_modal"
    ) {

      const category =
        interaction.customId.replace("ticket_", "");

      const answer1 =
        interaction.fields.getTextInputValue("question1");

      const answer2 =
        interaction.fields.getTextInputValue("question2");

      const answer3 =
        interaction.fields.getTextInputValue("question3");

      const channel =
        await interaction.guild.channels.create({
          name:
            `ticket-${cleanName(
              interaction.user.username
            )}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone.id,
              deny: [
                PermissionsBitField.Flags.ViewChannel
              ]
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
        answers: [
          answer1,
          answer2,
          answer3
        ],
        claimedBy: null,
        closed: false,
        createdAt: Date.now()
      };

      saveData();

      const ticketEmbed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(
            `Kenk Community — ${getCategoryName(category)}`
          )
          .setDescription(
            `Welcome <@${interaction.user.id}>.\n\n` +
            `**Question 1**\n${answer1}\n\n` +
            `**Question 2**\n${answer2}\n\n` +
            `**Question 3**\n${answer3}`
          )
          .setFooter({
            text: "Kenk Community"
          });

      const buttons =
        new ActionRowBuilder().addComponents(

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
        allowedMentions: {
          roles: [STAFF_ROLE_ID]
        }
      });

      await channel.send({
        embeds: [ticketEmbed],
        components: [buttons]
      });

      return interaction.reply({
        content: `✅ Your ticket has been created: ${channel}`,
        ephemeral: true
      });
    }

    // ========================================================
    // CLAIM
    // ========================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_claim"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "Only staff can claim tickets."
            )
          ],
          ephemeral: true
        });
      }

      const ticket =
        data.tickets[interaction.channel.id];

      if (!ticket || ticket.closed) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "This is not an active ticket."
            )
          ],
          ephemeral: true
        });
      }

      if (ticket.claimedBy) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              `This ticket is already claimed by <@${ticket.claimedBy}>.`
            )
          ],
          ephemeral: true
        });
      }

      ticket.claimedBy =
        interaction.user.id;

      saveData();

      return interaction.reply({
        embeds: [
          successEmbed(
            `${interaction.user} claimed this ticket.`
          )
        ]
      });
    }

    // ========================================================
    // CLOSE BUTTON
    // ========================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "Only staff can close tickets."
            )
          ],
          ephemeral: true
        });
      }

      const modal =
        new ModalBuilder()
          .setCustomId("ticket_close_modal")
          .setTitle("Close Ticket");

      const reason =
        new TextInputBuilder()
          .setCustomId("close_reason")
          .setLabel("Why are you closing this ticket?")
          .setPlaceholder("Enter the reason...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(reason)
      );

      return interaction.showModal(modal);
    }

    // ========================================================
    // CLOSE MODAL
    // ========================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticket_close_modal"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "Only staff can close tickets."
            )
          ],
          ephemeral: true
        });
      }

      const reason =
        interaction.fields.getTextInputValue(
          "close_reason"
        );

      const ticket =
        data.tickets[interaction.channel.id];

      if (ticket) {
        ticket.closed = true;
        ticket.closedBy =
          interaction.user.id;
        ticket.closeReason = reason;
        ticket.closedAt = Date.now();

        saveData();
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            `Ticket closed.\n**Reason:** ${reason}\n\nThis channel will be deleted in 5 seconds.`
          )
        ]
      });

      setTimeout(async () => {
        await interaction.channel
          .delete(
            `Ticket closed by ${interaction.user.tag}: ${reason}`
          )
          .catch(() => {});
      }, 5000);

      return;
    }

    // ========================================================
    // GIVEAWAY ENTRY
    // ========================================================

    if (
      interaction.isButton() &&
      interaction.customId === "giveaway_enter"
    ) {

      const giveaway =
        data.giveaways[interaction.message.id];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "This giveaway has ended."
            )
          ],
          ephemeral: true
        });
      }

      if (
        giveaway.entries.includes(
          interaction.user.id
        )
      ) {
        return interaction.reply({
          content:
            "⚠️ You are already entered.",
          ephemeral: true
        });
      }

      giveaway.entries.push(
        interaction.user.id
      );

      saveData();

      return interaction.reply({
        content:
          "🎉 You have entered the giveaway!",
        ephemeral: true
      });
    }

  } catch (error) {

    console.error(
      "❌ Interaction error:",
      error
    );

    try {

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        await interaction.followUp({
          embeds: [
            errorEmbed(
              "Something went wrong."
            )
          ],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Something went wrong."
            )
          ],
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

    if (
      message.author.bot ||
      !message.guild ||
      !message.content.startsWith(PREFIX)
    ) {
      return;
    }

    const args =
      message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command =
      args.shift()?.toLowerCase();

    if (!command) return;

    // --------------------------------------------------------
    // HELP
    // --------------------------------------------------------

    if (command === "help") {

      return message.reply({
        embeds: [
          infoEmbed(
            `**Kenk Community Commands**\n\n` +
            `\`${PREFIX}ban @user reason\`\n` +
            `\`${PREFIX}unban USER_ID\`\n` +
            `\`${PREFIX}kick @user reason\`\n` +
            `\`${PREFIX}mute @user minutes reason\`\n` +
            `\`${PREFIX}unmute @user\`\n` +
            `\`${PREFIX}warn @user reason\`\n` +
            `\`${PREFIX}warnings @user\`\n` +
            `\`${PREFIX}clear amount\`\n` +
            `\`${PREFIX}purge @user amount\`\n` +
            `\`${PREFIX}clean amount\`\n` +
            `\`${PREFIX}lock\`\n` +
            `\`${PREFIX}unlock\`\n` +
            `\`${PREFIX}slowmode seconds\`\n` +
            `\`${PREFIX}ticketpanel\`\n` +
            `\`${PREFIX}say message\`\n` +
            `\`${PREFIX}dm @user message\`\n` +
            `\`${PREFIX}userinfo @user\`\n` +
            `\`${PREFIX}serverinfo\`\n` +
            `\`${PREFIX}avatar @user\`\n` +
            `\`${PREFIX}giveaway minutes winners prize\`\n` +
            `\`${PREFIX}reroll messageID\`\n` +
            `\`${PREFIX}br role-name\``
          )
        ]
      });
    }

    // --------------------------------------------------------
    // PING
    // --------------------------------------------------------

    if (command === "ping") {
      return message.reply(
        `🏓 Pong! \`${client.ws.ping}ms\``
      );
    }

    // --------------------------------------------------------
    // STAFF CHECK
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

    if (
      staffCommands.includes(command) &&
      !isStaff(message.member)
    ) {
      return message.reply({
        embeds: [
          errorEmbed(
            "You don't have permission to use this command."
          )
        ]
      });
    }

    // --------------------------------------------------------
    // BAN
    // --------------------------------------------------------

    if (command === "ban") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        );

      const reason =
        args.slice(1).join(" ") ||
        "No reason provided";

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}ban @user reason\``
        );
      }

      if (!member.bannable) {
        return message.reply({
          embeds: [
            errorEmbed(
              "I cannot ban that member."
            )
          ]
        });
      }

      await member.ban({ reason });

      return message.reply({
        embeds: [
          successEmbed(
            `**${member.user.tag}** was banned.\n**Reason:** ${reason}`
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

      await message.guild.members.unban(
        userId
      );

      return message.reply({
        embeds: [
          successEmbed(
            `User with ID \`${userId}\` was unbanned.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // KICK
    // --------------------------------------------------------

    if (command === "kick") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        );

      const reason =
        args.slice(1).join(" ") ||
        "No reason provided";

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}kick @user reason\``
        );
      }

      if (!member.kickable) {
        return message.reply({
          embeds: [
            errorEmbed(
              "I cannot kick that member."
            )
          ]
        });
      }

      await member.kick(reason);

      return message.reply({
        embeds: [
          successEmbed(
            `**${member.user.tag}** was kicked.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // MUTE
    // --------------------------------------------------------

    if (command === "mute") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        );

      const minutes =
        parseInt(args[1]);

      const reason =
        args.slice(2).join(" ") ||
        "No reason provided";

      if (
        !member ||
        Number.isNaN(minutes)
      ) {
        return message.reply(
          `❌ Usage: \`${PREFIX}mute @user minutes reason\``
        );
      }

      if (!member.moderatable) {
        return message.reply({
          embeds: [
            errorEmbed(
              "I cannot mute that member."
            )
          ]
        });
      }

      const safeMinutes =
        Math.min(
          Math.max(minutes, 1),
          40320
        );

      await member.timeout(
        safeMinutes * 60000,
        reason
      );

      return message.reply({
        embeds: [
          successEmbed(
            `**${member.user.tag}** was muted for **${safeMinutes} minutes**.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // UNMUTE
    // --------------------------------------------------------

    if (command === "unmute") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        );

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}unmute @user\``
        );
      }

      await member.timeout(
        null,
        "Timeout removed by staff"
      );

      return message.reply({
        embeds: [
          successEmbed(
            `**${member.user.tag}** was unmuted.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // WARN
    // --------------------------------------------------------

    if (command === "warn") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        );

      const reason =
        args.slice(1).join(" ") ||
        "No reason provided";

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
            `**${member.user.tag}** was warned.\n**Reason:** ${reason}`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // WARNINGS
    // --------------------------------------------------------

    if (command === "warnings") {

      const userId =
        getUserIdFromMention(
          args[0]
        );

      if (!userId) {
        return message.reply(
          `❌ Usage: \`${PREFIX}warnings @user\``
        );
      }

      const warnings =
        data.warnings[userId] || [];

      if (!warnings.length) {
        return message.reply({
          embeds: [
            infoEmbed(
              "This user has no warnings."
            )
          ]
        });
      }

      const text =
        warnings
          .map(
            (w, i) =>
              `**${i + 1}.** ${w.reason}\nModerator: <@${w.moderator}>`
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

      const amount =
        Math.max(
          1,
          Math.min(
            parseInt(args[0]) || 1,
            100
          )
        );

      const deleted =
        await message.channel.bulkDelete(
          amount + 1,
          true
        );

      return message.channel.send({
        embeds: [
          successEmbed(
            `Deleted **${Math.max(
              deleted.size - 1,
              0
            )}** messages.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // PURGE
    // --------------------------------------------------------

    if (command === "purge") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        );

      const amount =
        Math.max(
          1,
          Math.min(
            parseInt(args[1]) || 1,
            100
          )
        );

      if (!member) {
        return message.reply(
          `❌ Usage: \`${PREFIX}purge @user amount\``
        );
      }

      const messages =
        await message.channel.messages.fetch({
          limit: 100
        });

      const selected =
        messages
          .filter(
            m =>
              m.author.id ===
              member.id
          )
          .first(amount);

      if (!selected.length) {
        return message.reply({
          embeds: [
            errorEmbed(
              "No messages from that user were found."
            )
          ]
        });
      }

      const deleted =
        await message.channel.bulkDelete(
          selected,
          true
        );

      return message.channel.send({
        embeds: [
          successEmbed(
            `Deleted **${deleted.size}** messages from **${member.user.tag}**.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // CLEAN
    // --------------------------------------------------------

    if (command === "clean") {

      const amount =
        Math.max(
          1,
          Math.min(
            parseInt(args[0]) || 1,
            100
          )
        );

      const messages =
        await message.channel.messages.fetch({
          limit: 100
        });

      const selected =
        messages
          .filter(
            m => m.author.bot
          )
          .first(amount);

      if (!selected.length) {
        return message.reply({
          embeds: [
            errorEmbed(
              "No bot messages were found."
            )
          ]
        });
      }

      const deleted =
        await message.channel.bulkDelete(
          selected,
          true
        );

      return message.channel.send({
        embeds: [
          successEmbed(
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
            "This channel was locked."
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
            "This channel was unlocked."
          )
        ]
      });
    }

    // --------------------------------------------------------
    // SLOWMODE
    // --------------------------------------------------------

    if (command === "slowmode") {

      const seconds =
        Math.max(
          0,
          Math.min(
            parseInt(args[0]) || 0,
            21600
          )
        );

      await message.channel.setRateLimitPerUser(
        seconds
      );

      return message.reply({
        embeds: [
          successEmbed(
            `Slowmode set to **${seconds} seconds**.`
          )
        ]
      });
    }

    // --------------------------------------------------------
    // SAY
    // --------------------------------------------------------

    if (command === "say") {

      const text =
        args.join(" ");

      if (!text) {
        return message.reply(
          `❌ Usage: \`${PREFIX}say message\``
        );
      }

      await message.delete().catch(() => {});

      return message.channel.send(
        text
      );
    }

    // --------------------------------------------------------
    // DM
    // --------------------------------------------------------

    if (command === "dm") {

      const userId =
        getUserIdFromMention(
          args[0]
        );

      const text =
        args.slice(1).join(" ");

      if (!userId || !text) {
        return message.reply(
          `❌ Usage: \`${PREFIX}dm @user message\``
        );
      }

      const user =
        await client.users
          .fetch(userId)
          .catch(() => null);

      if (!user) {
        return message.reply(
          "❌ User not found."
        );
      }

      try {

        await user.send(text);

        return message.reply({
          embeds: [
            successEmbed(
              `DM sent to **${user.tag}**.`
            )
          ]
        });

      } catch {

        return message.reply({
          embeds: [
            errorEmbed(
              "I couldn't DM that user."
            )
          ]
        });
      }
    }

    // --------------------------------------------------------
    // USERINFO
    // --------------------------------------------------------

    if (command === "userinfo") {

      const member =
        getMemberFromMention(
          message,
          args[0]
        ) || message.member;

      const embed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(
            `User Info — ${member.user.tag}`
          )
          .setThumbnail(
            member.user.displayAvatarURL({
              size: 1024
            })
          )
          .addFields(
            {
              name: "User ID",
              value: member.id,
              inline: true
            },
            {
              name: "Bot",
              value:
                member.user.bot
                  ? "Yes"
                  : "No",
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

      const guild =
        message.guild;

      const embed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(
            `Server Info — ${guild.name}`
          )
          .addFields(
            {
              name: "Members",
              value:
                `${guild.memberCount}`,
              inline: true
            },
            {
              name: "Channels",
              value:
                `${guild.channels.cache.size}`,
              inline: true
            },
            {
              name: "Roles",
              value:
                `${guild.roles.cache.size}`,
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
        getMemberFromMention(
          message,
          args[0]
        ) || message.member;

      const embed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(
            `${member.user.tag}'s Avatar`
          )
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

      const embed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(
            "Kenk Community Support"
          )
          .setDescription(
            "Select the category that best matches your issue."
          )
          .addFields(
            {
              name: "💬 General Support",
              value:
                "General questions and help.",
              inline: true
            },
            {
              name: "🛠️ Script & Bug Reports",
              value:
                "Report scripts or bugs.",
              inline: true
            },
            {
              name: "🎁 Giveaway Support",
              value:
                "Problems with giveaways.",
              inline: true
            },
            {
              name: "👮 Staff / Helper Report",
              value:
                "Report staff/helper issues.",
              inline: true
            }
          );

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId(
            "ticket_category"
          )
          .setPlaceholder(
            "Select a ticket category"
          )
          .addOptions(
            {
              label: "General Support",
              description:
                "Get general help",
              value: "general"
            },
            {
              label:
                "Script & Bug Reports",
              description:
                "Report a script or bug",
              value: "script"
            },
            {
              label:
                "Giveaway Support",
              description:
                "Get giveaway help",
              value: "giveaway"
            },
            {
              label:
                "Staff / Helper Report",
              description:
                "Report a staff/helper",
              value: "staff"
            }
          );

      await message.channel.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder()
            .addComponents(menu)
        ]
      });

      return message.reply(
        "✅ Ticket panel created."
      );
    }

    // --------------------------------------------------------
    // BOOSTER ROLE
    // --------------------------------------------------------

    if (command === "br") {

      if (!message.member.premiumSince) {
        return message.reply({
          embeds: [
            errorEmbed(
              "You must be a server booster to use this command."
            )
          ]
        });
      }

      const roleName =
        args.join(" ");

      if (!roleName) {
        return message.reply(
          `❌ Usage: \`${PREFIX}br role-name\``
        );
      }

      const oldRoleId =
        data.boosterRoles[
          message.author.id
        ];

      if (oldRoleId) {

        const oldRole =
          message.guild.roles.cache.get(
            oldRoleId
          );

        if (oldRole) {
          return message.reply({
            embeds: [
              errorEmbed(
                `You already have ${oldRole}.`
              )
            ]
          });
        }
      }

      const role =
        await message.guild.roles.create({
          name: roleName.slice(0, 100),
          color: "#5865F2",
          reason:
            `Booster role created by ${message.author.tag}`
        });

      data.boosterRoles[
        message.author.id
      ] = role.id;

      saveData();

      await message.member.roles
        .add(role)
        .catch(() => {});

      return message.reply({
        embeds: [
          successEmbed(
            `Your booster role ${role} was created and assigned to you.`
          )
        ]
      });
    }

  } catch (error) {

    console.error(
      "❌ Prefix command error:",
      error
    );

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

client.on(
  "guildMemberUpdate",
  async (oldMember, newMember) => {

    try {

      if (
        oldMember.premiumSince &&
        !newMember.premiumSince
      ) {

        const roleId =
          data.boosterRoles[
            newMember.id
          ];

        if (!roleId) return;

        const role =
          newMember.guild.roles.cache.get(
            roleId
          );

        if (role) {
          await role.delete(
            "Booster stopped boosting"
          ).catch(() => {});
        }

        delete data.boosterRoles[
          newMember.id
        ];

        saveData();
      }

    } catch (error) {
      console.error(
        "Booster cleanup error:",
        error
      );
    }
  }
);

// ============================================================
// GIVEAWAY CHECKER
// ============================================================

setInterval(async () => {

  try {

    const now = Date.now();

    for (
      const [messageId, giveaway]
      of Object.entries(data.giveaways)
    ) {

      if (
        giveaway.ended ||
        now < giveaway.endTime
      ) {
        continue;
      }

      giveaway.ended = true;

      saveData();

      const channel =
        await client.channels
          .fetch(giveaway.channelId)
          .catch(() => null);

      if (!channel) continue;

      const entries =
        [...new Set(giveaway.entries)];

      if (!entries.length) {

        await channel.send(
          `🎉 Giveaway ended for **${giveaway.prize}**, but there were no entries.`
        );

        continue;
      }

      const shuffled =
        entries.sort(
          () => Math.random() - 0.5
        );

      const winners =
        shuffled.slice(
          0,
          Math.min(
            giveaway.winners,
            shuffled.length
          )
        );

      await channel.send(
        `🎉 **Giveaway Ended!**\n\n` +
        `**Prize:** ${giveaway.prize}\n` +
        `**Winner${winners.length > 1 ? "s" : ""}:** ` +
        winners
          .map(id => `<@${id}>`)
          .join(", ")
      );
    }

  } catch (error) {

    console.error(
      "Giveaway checker error:",
      error
    );
  }

}, 10000);

// ============================================================
// LOGIN
// ============================================================

client.login(TOKEN);
