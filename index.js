const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
  Collection
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ======================================================
// CONFIG
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const PREFIX = process.env.PREFIX || ",";

const STAFF_ROLE_ID =
  process.env.STAFF_ROLE_ID || "1506669903673950338";

const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID || "1507026446940508351";

// ======================================================
// CHECK VARIABLES
// ======================================================

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing.");
  process.exit(1);
}

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ======================================================
// DATA
// ======================================================

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "data.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let data = {
  warnings: {},
  tickets: {},
  giveaways: {},
  boosters: {}
};

if (fs.existsSync(dataFile)) {
  try {
    data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    console.log("⚠️ data.json could not be read. Creating a new one.");
  }
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// ======================================================
// EMBEDS
// ======================================================

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
    .setTitle("❌ Something went wrong")
    .setDescription(description)
    .setTimestamp();
}

function moderationEmbed(action, member, reason, moderator) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(
      `**${member.user?.tag || member.tag || member}** was ${action}.`
    )
    .addFields(
      {
        name: "Reason",
        value: reason || "No reason provided.",
        inline: true
      },
      {
        name: "Moderator",
        value: `${moderator}`,
        inline: true
      }
    )
    .setTimestamp();
}

// ======================================================
// PERMISSION CHECK
// ======================================================

function isStaff(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function canModerate(member) {
  return member.permissions.has(
    PermissionsBitField.Flags.KickMembers
  );
}

// ======================================================
// WARNING SYSTEM
// ======================================================

function getWarnings(guildId, userId) {
  if (!data.warnings[guildId]) {
    data.warnings[guildId] = {};
  }

  if (!data.warnings[guildId][userId]) {
    data.warnings[guildId][userId] = [];
  }

  return data.warnings[guildId][userId];
}

function addWarning(guildId, userId, reason, moderator) {
  const warnings = getWarnings(guildId, userId);

  warnings.push({
    reason,
    moderator: moderator.id,
    moderatorTag: moderator.tag,
    timestamp: Date.now()
  });

  saveData();

  return warnings.length;
}

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all bot commands"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("setupprefix")
    .setDescription("Show the current prefix"),

  // BAN
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member to ban")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("delete_days")
        .setDescription("Delete 0-7 days of messages")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
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
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    ),

  // KICK
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

  // MUTE
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
        .setDescription("Mute duration in minutes")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a member's timeout")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    ),

  // WARN
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
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove a warning from a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("number")
        .setDescription("Warning number")
        .setMinValue(1)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View member warnings")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    ),

  // MODERATION
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount of messages")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages from a specific user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clean")
    .setDescription("Delete bot messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock this channel"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock this channel"),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("Slowmode seconds")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  // UTILITY
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
    .setDescription("DM a member")
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
    .setDescription("Show member information")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server information"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("nick")
    .setDescription("Change a member nickname")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("nickname")
        .setDescription("New nickname")
        .setRequired(false)
    ),

  // ROLE
  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Manage roles")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a role")
        .addUserOption(o =>
          o.setName("user")
            .setDescription("Member")
            .setRequired(true)
        )
        .addRoleOption(o =>
          o.setName("role")
            .setDescription("Role")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove a role")
        .addUserOption(o =>
          o.setName("user")
            .setDescription("Member")
            .setRequired(true)
        )
        .addRoleOption(o =>
          o.setName("role")
            .setDescription("Role")
            .setRequired(true)
        )
    ),

  // TICKETS
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send the ticket panel"),

  // GIVEAWAY
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Start a giveaway")
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("Duration")
        .setMinValue(1)
        .setRequired(true)
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
    .addStringOption(o =>
      o.setName("icon")
        .setDescription("Unicode emoji for the role")
        .setRequired(false)
    )
];

const commandData = commands.map(c => c.toJSON());

// ======================================================
// REGISTER SLASH COMMANDS
// ======================================================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    if (GUILD_ID) {
      // Remove old global commands so duplicates disappear.
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );

      // Register instantly to this server.
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandData }
      );

      console.log("✅ Slash commands registered to your server.");
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commandData }
      );

      console.log("✅ Global slash commands registered.");
    }
  } catch (error) {
    console.error("❌ Slash command registration failed:", error);
  }
}

// ======================================================
// HELP
// ======================================================

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Kenk Community")
    .setDescription("Here are the available commands.")
    .addFields(
      {
        name: "Moderation",
        value:
          "`/ban` `/unban` `/kick` `/mute` `/unmute`\n" +
          "`/warn` `/unwarn` `/warnings`\n" +
          "`/clear` `/purge` `/clean`\n" +
          "`/lock` `/unlock` `/slowmode`"
      },
      {
        name: "Utility",
        value:
          "`/userinfo` `/serverinfo` `/avatar`\n" +
          "`/say` `/dm` `/nick` `/role`"
      },
      {
        name: "Community",
        value:
          "`/ticketpanel` `/giveaway` `/reroll` `/br`"
      }
    )
    .setFooter({ text: "Kenk Community" })
    .setTimestamp();
}

// ======================================================
// TICKET QUESTIONS
// ======================================================

const ticketQuestions = {
  general: [
    "What do you need help with?",
    "What happened?",
    "Is there anything else we should know?"
  ],

  bug: [
    "What is the bug or problem?",
    "How can we reproduce it?",
    "What device/game/version are you using?"
  ],

  giveaway: [
    "Which giveaway are you asking about?",
    "What happened with your entry or prize?",
    "Do you have any proof/screenshots?"
  ],

  staff: [
    "Which staff/helper are you reporting?",
    "What happened?",
    "Do you have proof or screenshots?"
  ]
};

// ======================================================
// TICKET PANEL
// ======================================================

function ticketPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Kenk Community Support")
    .setDescription(
      "Select a category below to create a private ticket.\n\n" +
      "Please choose the category that best matches your issue."
    )
    .setFooter({ text: "Kenk Community Support" });
}

function ticketPanelRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Select a ticket category")
      .addOptions(
        {
          label: "General Support",
          description: "General questions and support",
          value: "general",
          emoji: "💬"
        },
        {
          label: "Script & Bug Reports",
          description: "Report a script or bug",
          value: "bug",
          emoji: "🛠️"
        },
        {
          label: "Giveaway Support",
          description: "Problems with giveaways",
          value: "giveaway",
          emoji: "🎁"
        },
        {
          label: "Staff / Helper Report",
          description: "Report a staff member or helper",
          value: "staff",
          emoji: "👮"
        }
      )
  );
}

// ======================================================
// TICKET BUTTONS
// ======================================================

function ticketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim Ticket")
      .setEmoji("📜")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ======================================================
// TICKET MODAL
// ======================================================

function createTicketModal(category) {
  const questions = ticketQuestions[category];

  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${category}`)
    .setTitle("Ticket Questions");

  questions.forEach((question, index) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`answer_${index}`)
          .setLabel(question.slice(0, 45))
          .setStyle(
            index === 0
              ? TextInputStyle.Paragraph
              : TextInputStyle.Short
          )
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
  });

  return modal;
}

// ======================================================
// TICKET CREATION
// ======================================================

async function createTicket(interaction, category) {
  const guild = interaction.guild;

  const existing = guild.channels.cache.find(
    c =>
      c.parentId === TICKET_CATEGORY_ID &&
      c.topic === `ticket:${interaction.user.id}`
  );

  if (existing) {
    return interaction.reply({
      embeds: [
        errorEmbed(
          `You already have an open ticket: ${existing}`
        )
      ],
      ephemeral: true
    });
  }

  const questions = ticketQuestions[category];

  const answers = questions.map((_, i) =>
    interaction.fields.getTextInputValue(`answer_${i}`)
  );

  const channel = await guild.channels.create({
    name: `ticket-${interaction.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 80),

    type: ChannelType.GuildText,

    parent: TICKET_CATEGORY_ID,

    topic: `ticket:${interaction.user.id}`,

    permissionOverwrites: [
      {
        id: guild.id,
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
    owner: interaction.user.id,
    category,
    created: Date.now()
  };

  saveData();

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Ticket Opened")
    .setDescription(
      `Thank you for contacting support, ${interaction.user}.\n` +
      `Please wait for a response from our staff team.`
    )
    .addFields(
      {
        name: questions[0],
        value: answers[0] || "Not provided"
      },
      {
        name: questions[1],
        value: answers[1] || "Not provided"
      },
      {
        name: questions[2],
        value: answers[2] || "Not provided"
      }
    )
    .setFooter({ text: "Kenk Community | Ticket System" })
    .setTimestamp();

  await channel.send({
    content: `<@&${STAFF_ROLE_ID}>`,
    embeds: [ticketEmbed],
    components: [ticketButtons()]
  });

  await interaction.reply({
    embeds: [
      successEmbed(
        "Ticket Created",
        `Your ticket has been created: ${channel}`
      )
    ],
    ephemeral: true
  });
}

// ======================================================
// COMMAND HANDLER
// ======================================================

client.on("interactionCreate", async interaction => {
  try {

    // ==================================================
    // SLASH COMMANDS
    // ==================================================

    if (interaction.isChatInputCommand()) {

      const command = interaction.commandName;

      // ---------------- HELP ----------------

      if (command === "help") {
        return interaction.reply({
          embeds: [helpEmbed()],
          ephemeral: true
        });
      }

      // ---------------- PING ----------------

      if (command === "ping") {
        return interaction.reply({
          embeds: [
            successEmbed(
              "Pong!",
              `Latency: **${client.ws.ping}ms**`
            )
          ]
        });
      }

      // ---------------- PREFIX ----------------

      if (command === "setupprefix") {
        return interaction.reply({
          embeds: [
            successEmbed(
              "Prefix",
              `Your prefix is \`${PREFIX}\``
            )
          ],
          ephemeral: true
        });
      }

      // =================================================
      // STAFF ONLY
      // =================================================

      const staffCommands = [
        "ban",
        "unban",
        "kick",
        "mute",
        "unmute",
        "warn",
        "unwarn",
        "warnings",
        "clear",
        "purge",
        "clean",
        "lock",
        "unlock",
        "slowmode",
        "say",
        "dm",
        "nick",
        "role",
        "ticketpanel",
        "giveaway",
        "reroll"
      ];

      if (staffCommands.includes(command) && !isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed("You do not have permission to use this command.")
          ],
          ephemeral: true
        });
      }

      // =================================================
      // BAN
      // =================================================

      if (command === "ban") {

        if (!interaction.member.permissions.has(
          PermissionsBitField.Flags.BanMembers
        )) {
          return interaction.reply({
            embeds: [errorEmbed("You need the Ban Members permission.")],
            ephemeral: true
          });
        }

        const user = interaction.options.getUser("user");
        const days =
          interaction.options.getInteger("delete_days") || 0;
        const reason =
          interaction.options.getString("reason") ||
          "No reason provided.";

        const member = await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

        if (member && !member.bannable) {
          return interaction.reply({
            embeds: [
              errorEmbed("I cannot ban this member. Check my role position.")
            ],
            ephemeral: true
          });
        }

        await interaction.guild.members.ban(user.id, {
          deleteMessageSeconds: days * 86400,
          reason
        });

        return interaction.reply({
          embeds: [
            moderationEmbed(
              "banned",
              user,
              reason,
              interaction.user
            )
          ]
        });
      }

      // =================================================
      // UNBAN
      // =================================================

      if (command === "unban") {

        const userId = interaction.options.getString("userid");

        const reason =
          interaction.options.getString("reason") ||
          "No reason provided.";

        await interaction.guild.members.unban(
          userId,
          reason
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              "User Unbanned",
              `User ID **${userId}** was unbanned.\n\n**Reason:** ${reason}`
            )
          ]
        });
      }

      // =================================================
      // KICK
      // =================================================

      if (command === "kick") {

        const user = interaction.options.getUser("user");
        const reason =
          interaction.options.getString("reason") ||
          "No reason provided.";

        const member =
          await interaction.guild.members.fetch(user.id);

        if (!member.kickable) {
          return interaction.reply({
            embeds: [
              errorEmbed("I cannot kick this member.")
            ],
            ephemeral: true
          });
        }

        await member.kick(reason);

        return interaction.reply({
          embeds: [
            moderationEmbed(
              "kicked",
              user,
              reason,
              interaction.user
            )
          ]
        });
      }

      // =================================================
      // MUTE
      // =================================================

      if (command === "mute") {

        const user = interaction.options.getUser("user");
        const minutes =
          interaction.options.getInteger("minutes");

        const reason =
          interaction.options.getString("reason") ||
          "No reason provided.";

        const member =
          await interaction.guild.members.fetch(user.id);

        if (!member.moderatable) {
          return interaction.reply({
            embeds: [
              errorEmbed("I cannot mute this member.")
            ],
            ephemeral: true
          });
        }

        await member.timeout(
          minutes * 60000,
          reason
        );

        return interaction.reply({
          embeds: [
            moderationEmbed(
              "muted",
              user,
              `${reason}\nDuration: ${minutes} minute(s)`,
              interaction.user
            )
          ]
        });
      }

      // =================================================
      // UNMUTE
      // =================================================

      if (command === "unmute") {

        const user = interaction.options.getUser("user");
        const reason =
          interaction.options.getString("reason") ||
          "No reason provided.";

        const member =
          await interaction.guild.members.fetch(user.id);

        await member.timeout(null, reason);

        return interaction.reply({
          embeds: [
            moderationEmbed(
              "unmuted",
              user,
              reason,
              interaction.user
            )
          ]
        });
      }

      // =================================================
      // WARN
      // =================================================

      if (command === "warn") {

        const user = interaction.options.getUser("user");
        const reason =
          interaction.options.getString("reason");

        const count = addWarning(
          interaction.guild.id,
          user.id,
          reason,
          interaction.user
        );

        return interaction.reply({
          embeds: [
            moderationEmbed(
              "warned",
              user,
              `${reason}\nWarnings: ${count}`,
              interaction.user
            )
          ]
        });
      }

      // =================================================
      // UNWARN
      // =================================================

      if (command === "unwarn") {

        const user = interaction.options.getUser("user");
        const number =
          interaction.options.getInteger("number");

        const warnings =
          getWarnings(interaction.guild.id, user.id);

        if (!warnings[number - 1]) {
          return interaction.reply({
            embeds: [
              errorEmbed(
                `Warning #${number} does not exist for ${user}.`
              )
            ],
            ephemeral: true
          });
        }

        warnings.splice(number - 1, 1);
        saveData();

        return interaction.reply({
          embeds: [
            successEmbed(
              "Warning Removed",
              `Removed warning **#${number}** from ${user}.`
            )
          ]
        });
      }

      // =================================================
      // WARNINGS
      // =================================================

      if (command === "warnings") {

        const user = interaction.options.getUser("user");

        const warnings =
          getWarnings(interaction.guild.id, user.id);

        if (!warnings.length) {
          return interaction.reply({
            embeds: [
              successEmbed(
                "Warnings",
                `${user} has no warnings.`
              )
            ]
          });
        }

        const description = warnings
          .map(
            (w, i) =>
              `**#${i + 1}** — ${w.reason}\n` +
              `Moderator: <@${w.moderator}>`
          )
          .join("\n\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffc107)
              .setTitle(`Warnings — ${user.tag}`)
              .setDescription(description)
              .setTimestamp()
          ]
        });
      }

      // =================================================
      // CLEAR
      // =================================================

      if (command === "clear") {

        const amount =
          interaction.options.getInteger("amount");

        const deleted =
          await interaction.channel.bulkDelete(amount, true);

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

      // =================================================
      // PURGE USER
      // =================================================

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
          messages.filter(m => m.author.id === user.id)
            .first(amount);

        if (!selected.length) {
          return interaction.reply({
            embeds: [
              errorEmbed("No messages from that user were found.")
            ],
            ephemeral: true
          });
        }

        await interaction.channel.bulkDelete(selected, true);

        return interaction.reply({
          embeds: [
            successEmbed(
              "User Messages Purged",
              `Deleted **${selected.length}** messages from ${user}.`
            )
          ],
          ephemeral: true
        });
      }

      // =================================================
      // CLEAN BOT
      // =================================================

      if (command === "clean") {

        const amount =
          interaction.options.getInteger("amount");

        const messages =
          await interaction.channel.messages.fetch({
            limit: 100
          });

        const selected =
          messages.filter(m => m.author.bot)
            .first(amount);

        if (!selected.length) {
          return interaction.reply({
            embeds: [
              errorEmbed("No bot messages were found.")
            ],
            ephemeral: true
          });
        }

        await interaction.channel.bulkDelete(selected, true);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Bot Messages Cleared",
              `Deleted **${selected.length}** bot messages.`
            )
          ],
          ephemeral: true
        });
      }

      // =================================================
      // LOCK
      // =================================================

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
              "This channel has been locked."
            )
          ]
        });
      }

      // =================================================
      // UNLOCK
      // =================================================

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
              "This channel has been unlocked."
            )
          ]
        });
      }

      // =================================================
      // SLOWMODE
      // =================================================

      if (command === "slowmode") {

        const seconds =
          interaction.options.getInteger("seconds");

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

      // =================================================
      // SAY
      // =================================================

      if (command === "say") {

        const message =
          interaction.options.getString("message");

        await interaction.reply({
          content: message
        });
      }

      // =================================================
      // DM
      // =================================================

      if (command === "dm") {

        const user =
          interaction.options.getUser("user");

        const message =
          interaction.options.getString("message");

        try {
          await user.send(message);

          return interaction.reply({
            embeds: [
              successEmbed(
                "DM Sent",
                `Message sent to ${user}.`
              )
            ],
            ephemeral: true
          });
        } catch {
          return interaction.reply({
            embeds: [
              errorEmbed("I could not DM that user.")
            ],
            ephemeral: true
          });
        }
      }

      // =================================================
      // USERINFO
      // =================================================

      if (command === "userinfo") {

        const user =
          interaction.options.getUser("user") ||
          interaction.user;

        const member =
          await interaction.guild.members.fetch(user.id);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(`User Information`)
              .setThumbnail(user.displayAvatarURL())
              .addFields(
                {
                  name: "User",
                  value: `${user}`,
                  inline: true
                },
                {
                  name: "ID",
                  value: user.id,
                  inline: true
                },
                {
                  name: "Joined Server",
                  value: `<t:${Math.floor(
                    member.joinedTimestamp / 1000
                  )}:R>`,
                  inline: true
                }
              )
              .setTimestamp()
          ]
        });
      }

      // =================================================
      // SERVERINFO
      // =================================================

      if (command === "serverinfo") {

        const guild = interaction.guild;

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(guild.name)
              .setThumbnail(guild.iconURL())
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
              )
              .setTimestamp()
          ]
        });
      }

      // =================================================
      // AVATAR
      // =================================================

      if (command === "avatar") {

        const user =
          interaction.options.getUser("user") ||
          interaction.user;

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(`${user.username}'s Avatar`)
              .setImage(user.displayAvatarURL({
                size: 1024
              }))
          ]
        });
      }

      // =================================================
      // NICK
      // =================================================

      if (command === "nick") {

        const user =
          interaction.options.getUser("user");

        const nickname =
          interaction.options.getString("nickname");

        const member =
          await interaction.guild.members.fetch(user.id);

        await member.setNickname(nickname);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Nickname Updated",
              `${user}'s nickname was changed.`
            )
          ]
        });
      }

      // =================================================
      // ROLE
      // =================================================

      if (command === "role") {

        const sub = interaction.options.getSubcommand();

        const user =
          interaction.options.getUser("user");

        const role =
          interaction.options.getRole("role");

        const member =
          await interaction.guild.members.fetch(user.id);

        if (sub === "add") {
          await member.roles.add(role);

          return interaction.reply({
            embeds: [
              successEmbed(
                "Role Added",
                `${role} was added to ${user}.`
              )
            ]
          });
        }

        await member.roles.remove(role);

        return interaction.reply({
          embeds: [
            successEmbed(
              "Role Removed",
              `${role} was removed from ${user}.`
            )
          ]
        });
      }

      // =================================================
      // TICKET PANEL
      // =================================================

      if (command === "ticketpanel") {

        return interaction.channel.send({
          embeds: [ticketPanelEmbed()],
          components: [ticketPanelRow()]
        }).then(() =>
          interaction.reply({
            embeds: [
              successEmbed(
                "Ticket Panel Sent",
                "The ticket panel has been created."
              )
            ],
            ephemeral: true
          })
        );
      }

      // =================================================
      // GIVEAWAY
      // =================================================

      if (command === "giveaway") {

        const minutes =
          interaction.options.getInteger("minutes");

        const prize =
          interaction.options.getString("prize");

        const end = Date.now() + minutes * 60000;

        const message = await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffc107)
              .setTitle("Giveaway")
              .setDescription(
                `## 🎁 ${prize}\n\n` +
                `Ends: <t:${Math.floor(end / 1000)}:R>\n` +
                `Hosted by: ${interaction.user}\n\n` +
                `Click the button below to enter!`
              )
              .setTimestamp(end)
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`giveaway_${Date.now()}`)
                .setLabel("Enter Giveaway")
                .setEmoji("🎉")
                .setStyle(ButtonStyle.Primary)
            )
          ]
        });

        data.giveaways[message.id] = {
          channel: interaction.channel.id,
          prize,
          end,
          entries: [],
          ended: false
        };

        saveData();

        return interaction.reply({
          embeds: [
            successEmbed(
              "Giveaway Created",
              `Giveaway started for **${prize}**.`
            )
          ],
          ephemeral: true
        });
      }

      // =================================================
      // REROLL
      // =================================================

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
            Math.floor(Math.random() * giveaway.entries.length)
          ];

        return interaction.reply({
          embeds: [
            successEmbed(
              "Giveaway Rerolled",
              `New winner: <@${winner}>\nPrize: **${giveaway.prize}**`
            )
          ]
        });
      }

      // =================================================
      // BOOSTER ROLE
      // =================================================

      if (command === "br") {

        if (!interaction.member.premiumSince) {
          return interaction.reply({
            embeds: [
              errorEmbed(
                "You must be boosting the server to use this."
              )
            ],
            ephemeral: true
          });
        }

        const name =
          interaction.options.getString("name");

        const color =
          interaction.options.getString("color") ||
          "#5865F2";

        const icon =
          interaction.options.getString("icon");

        const oldRoleId =
          data.boosters[interaction.user.id];

        if (oldRoleId) {
          const oldRole =
            interaction.guild.roles.cache.get(oldRoleId);

          if (oldRole) {
            await oldRole.delete().catch(() => {});
          }
        }

        const role =
          await interaction.guild.roles.create({
            name,
            color,
            reason: `Booster role for ${interaction.user.tag}`
          });

        if (icon) {
          await role.edit({
            unicodeEmoji: icon
          }).catch(() => {});
        }

        await interaction.member.roles.add(role);

        data.boosters[interaction.user.id] = role.id;
        saveData();

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

    // ==================================================
    // TICKET SELECT MENU
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_category"
    ) {

      const category =
        interaction.values[0];

      return interaction.showModal(
        createTicketModal(category)
      );
    }

    // ==================================================
    // TICKET MODAL
    // ==================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticket_modal_")
    ) {

      const category =
        interaction.customId.replace(
          "ticket_modal_",
          ""
        );

      return createTicket(interaction, category);
    }

    // ==================================================
    // TICKET CLAIM
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_claim"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed("Only staff can claim tickets.")
          ],
          ephemeral: true
        });
      }

      const ticket =
        data.tickets[interaction.channel.id];

      if (!ticket) {
        return interaction.reply({
          embeds: [
            errorEmbed("This is not a ticket channel.")
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

    // ==================================================
    // TICKET CLOSE
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          embeds: [
            errorEmbed("Only staff can close tickets.")
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
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(reason)
      );

      return interaction.showModal(modal);
    }

    // ==================================================
    // CLOSE MODAL
    // ==================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticket_close_modal"
    ) {

      const reason =
        interaction.fields.getTextInputValue("close_reason");

      const ticket =
        data.tickets[interaction.channel.id];

      if (ticket) {
        ticket.closedBy = interaction.user.id;
        ticket.closeReason = reason;
        ticket.closedAt = Date.now();

        saveData();
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("Ticket Closed")
            .setDescription(
              `This ticket will be deleted in **5 seconds**.`
            )
            .addFields({
              name: "Reason",
              value: reason
            })
            .setTimestamp()
        ]
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }

    // ==================================================
    // GIVEAWAY BUTTON
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("giveaway_")
    ) {

      const messageId =
        interaction.message.id;

      const giveaway =
        data.giveaways[messageId];

      if (!giveaway) {
        return interaction.reply({
          embeds: [
            errorEmbed("This giveaway no longer exists.")
          ],
          ephemeral: true
        });
      }

      if (Date.now() >= giveaway.end) {
        return interaction.reply({
          embeds: [
            errorEmbed("This giveaway has ended.")
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
          embeds: [
            errorEmbed("You are already entered.")
          ],
          ephemeral: true
        });
      }

      giveaway.entries.push(
        interaction.user.id
      );

      saveData();

      return interaction.reply({
        embeds: [
          successEmbed(
            "Entry Added",
            "You have entered the giveaway."
          )
        ],
        ephemeral: true
      });
    }

  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "An unexpected error occurred."
          )
        ],
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ======================================================
// PREFIX COMMANDS
// ======================================================

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const command =
    args.shift()?.toLowerCase();

  if (!command) return;

  if (!isStaff(message.member)) {
    return message.reply({
      embeds: [
        errorEmbed(
          "You do not have permission to use bot commands."
        )
      ]
    });
  }

  // ================================================
  // ,help
  // ================================================

  if (command === "help") {
    return message.reply({
      embeds: [helpEmbed()]
    });
  }

  // ================================================
  // ,ping
  // ================================================

  if (command === "ping") {
    return message.reply({
      embeds: [
        successEmbed(
          "Pong!",
          `Latency: **${client.ws.ping}ms**`
        )
      ]
    });
  }

  // ================================================
  // ,warn
  // ================================================

  if (command === "warn") {

    const user =
      message.mentions.users.first();

    if (!user) {
      return message.reply(
        `Usage: \`${PREFIX}warn @user reason\``
      );
    }

    const reason =
      args.slice(1).join(" ") ||
      "No reason provided.";

    const count =
      addWarning(
        message.guild.id,
        user.id,
        reason,
        message.author
      );

    return message.reply({
      embeds: [
        moderationEmbed(
          "warned",
          user,
          `${reason}\nWarnings: ${count}`,
          message.author
        )
      ]
    });
  }

  // ================================================
  // ,unwarn
  // ================================================

  if (command === "unwarn") {

    const user =
      message.mentions.users.first();

    const number =
      parseInt(args[1]);

    if (!user || !number) {
      return message.reply(
        `Usage: \`${PREFIX}unwarn @user warning-number\``
      );
    }

    const warnings =
      getWarnings(
        message.guild.id,
        user.id
      );

    if (!warnings[number - 1]) {
      return message.reply({
        embeds: [
          errorEmbed("That warning does not exist.")
        ]
      });
    }

    warnings.splice(number - 1, 1);

    saveData();

    return message.reply({
      embeds: [
        successEmbed(
          "Warning Removed",
          `Removed warning **#${number}** from ${user}.`
        )
      ]
    });
  }

  // ================================================
  // ,warnings
  // ================================================

  if (command === "warnings") {

    const user =
      message.mentions.users.first();

    if (!user) {
      return message.reply(
        `Usage: \`${PREFIX}warnings @user\``
      );
    }

    const warnings =
      getWarnings(
        message.guild.id,
        user.id
      );

    if (!warnings.length) {
      return message.reply({
        embeds: [
          successEmbed(
            "Warnings",
            `${user} has no warnings.`
          )
        ]
      });
    }

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffc107)
          .setTitle(`Warnings — ${user.tag}`)
          .setDescription(
            warnings
              .map(
                (w, i) =>
                  `**#${i + 1}** — ${w.reason}\nModerator: <@${w.moderator}>`
              )
              .join("\n\n")
          )
      ]
    });
  }

  // ================================================
  // ,kick
  // ================================================

  if (command === "kick") {

    const user =
      message.mentions.users.first();

    if (!user) {
      return message.reply(
        `Usage: \`${PREFIX}kick @user reason\``
      );
    }

    const member =
      await message.guild.members.fetch(user.id);

    const reason =
      args.slice(1).join(" ") ||
      "No reason provided.";

    await member.kick(reason);

    return message.reply({
      embeds: [
        moderationEmbed(
          "kicked",
          user,
          reason,
          message.author
        )
      ]
    });
  }

  // ================================================
  // ,ban
  // ================================================

  if (command === "ban") {

    const user =
      message.mentions.users.first();

    if (!user) {
      return message.reply(
        `Usage: \`${PREFIX}ban @user reason\``
      );
    }

    const reason =
      args.slice(1).join(" ") ||
      "No reason provided.";

    await message.guild.members.ban(
      user.id,
      { reason }
    );

    return message.reply({
      embeds: [
        moderationEmbed(
          "banned",
          user,
          reason,
          message.author
        )
      ]
    });
  }

  // ================================================
  // ,unban
  // ================================================

  if (command === "unban") {

    const userId = args[0];

    if (!userId) {
      return message.reply(
        `Usage: \`${PREFIX}unban USER_ID\``
      );
    }

    await message.guild.members.unban(userId);

    return message.reply({
      embeds: [
        successEmbed(
          "User Unbanned",
          `User ID **${userId}** was unbanned.`
        )
      ]
    });
  }

  // ================================================
  // ,mute
  // ================================================

  if (command === "mute") {

    const user =
      message.mentions.users.first();

    const minutes =
      parseInt(args[1]);

    if (!user || !minutes) {
      return message.reply(
        `Usage: \`${PREFIX}mute @user minutes reason\``
      );
    }

    const member =
      await message.guild.members.fetch(user.id);

    const reason =
      args.slice(2).join(" ") ||
      "No reason provided.";

    await member.timeout(
      minutes * 60000,
      reason
    );

    return message.reply({
      embeds: [
        moderationEmbed(
          "muted",
          user,
          `${reason}\nDuration: ${minutes} minute(s)`,
          message.author
        )
      ]
    });
  }

  // ================================================
  // ,unmute
  // ================================================

  if (command === "unmute") {

    const user =
      message.mentions.users.first();

    if (!user) {
      return message.reply(
        `Usage: \`${PREFIX}unmute @user\``
      );
    }

    const member =
      await message.guild.members.fetch(user.id);

    await member.timeout(null);

    return message.reply({
      embeds: [
        moderationEmbed(
          "unmuted",
          user,
          "No reason provided.",
          message.author
        )
      ]
    });
  }

  // ================================================
  // ,clear
  // ================================================

  if (command === "clear") {

    const amount =
      parseInt(args[0]);

    if (!amount || amount < 1 || amount > 100) {
      return message.reply(
        `Usage: \`${PREFIX}clear amount\``
      );
    }

    const deleted =
      await message.channel.bulkDelete(
        amount,
        true
      );

    return message.channel.send({
      embeds: [
        successEmbed(
          "Messages Cleared",
          `Deleted **${deleted.size}** messages.`
        )
      ]
    });
  }

  // ================================================
  // ,purge @user amount
  // ================================================

  if (command === "purge") {

    const user =
      message.mentions.users.first();

    const amount =
      parseInt(args[1]);

    if (!user || !amount) {
      return message.reply(
        `Usage: \`${PREFIX}purge @user amount\``
      );
    }

    const messages =
      await message.channel.messages.fetch({
        limit: 100
      });

    const selected =
      messages
        .filter(m => m.author.id === user.id)
        .first(amount);

    if (!selected.length) {
      return message.reply({
        embeds: [
          errorEmbed("No messages from that user were found.")
        ]
      });
    }

    await message.channel.bulkDelete(
      selected,
      true
    );

    return message.channel.send({
      embeds: [
        successEmbed(
          "User Messages Purged",
          `Deleted **${selected.length}** messages from ${user}.`
        )
      ]
    });
  }

  // ================================================
  // ,clean
  // ================================================

  if (command === "clean") {

    const amount =
      parseInt(args[0]);

    if (!amount || amount < 1 || amount > 100) {
      return message.reply(
        `Usage: \`${PREFIX}clean amount\``
      );
    }

    const messages =
      await message.channel.messages.fetch({
        limit: 100
      });

    const selected =
      messages
        .filter(m => m.author.bot)
        .first(amount);

    await message.channel.bulkDelete(
      selected,
      true
    );

    return message.channel.send({
      embeds: [
        successEmbed(
          "Bot Messages Cleared",
          `Deleted **${selected.length}** bot messages.`
        )
      ]
    });
  }

  // ================================================
  // ,lock
  // ================================================

  if (command === "lock") {

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: false }
    );

    return message.channel.send({
      embeds: [
        successEmbed(
          "Channel Locked",
          "This channel has been locked."
        )
      ]
    });
  }

  // ================================================
  // ,unlock
  // ================================================

  if (command === "unlock") {

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: null }
    );

    return message.channel.send({
      embeds: [
        successEmbed(
          "Channel Unlocked",
          "This channel has been unlocked."
        )
      ]
    });
  }

  // ================================================
  // ,slowmode
  // ================================================

  if (command === "slowmode") {

    const seconds =
      parseInt(args[0]);

    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return message.reply(
        `Usage: \`${PREFIX}slowmode seconds\``
      );
    }

    await message.channel.setRateLimitPerUser(seconds);

    return message.channel.send({
      embeds: [
        successEmbed(
          "Slowmode Updated",
          `Slowmode is now **${seconds} seconds**.`
        )
      ]
    });
  }

  // ================================================
  // ,say
  // ================================================

  if (command === "say") {

    const text =
      args.join(" ");

    if (!text) return;

    await message.delete().catch(() => {});

    return message.channel.send(text);
  }

});

// ======================================================
// BOOSTER CLEANUP
// ======================================================

client.on("guildMemberUpdate", async (oldMember, newMember) => {

  if (oldMember.premiumSince && !newMember.premiumSince) {

    const roleId =
      data.boosters[newMember.id];

    if (!roleId) return;

    const role =
      newMember.guild.roles.cache.get(roleId);

    if (role) {
      await role.delete().catch(() => {});
    }

    delete data.boosters[newMember.id];

    saveData();
  }

});

// ======================================================
// READY
// ======================================================

client.once("ready", async () => {

  console.log(
    `✅ ${client.user.tag} is online!`
  );

  await registerCommands();

});

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
