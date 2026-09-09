const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || "";

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1506669903673950338";
const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID || "1507026446940508351";

const TRANSCRIPT_CHANNEL_ID =
  process.env.TRANSCRIPT_CHANNEL_ID || "1508417552160915518";

const PREFIX = process.env.PREFIX || ",";

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("Missing CLIENT_ID");
  process.exit(1);
}

if (!STAFF_ROLE_ID) {
  console.error("Missing STAFF_ROLE_ID");
  process.exit(1);
}

/* =========================================================
   DATA
========================================================= */

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "data.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let data = {
  prefixes: {},
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
  } catch {
    console.log("Could not read data.json, starting fresh.");
  }
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

/* =========================================================
   CLIENT
========================================================= */

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

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  red: 0xED4245,
  green: 0x57F287,
  blue: 0x5865F2,
  yellow: 0xFEE75C,
  orange: 0xF59E0B,
  purple: 0x9B59B6,
  dark: 0x202225,
  gray: 0x2B2D31
};

/* =========================================================
   EMOJI HELPER
========================================================= */

function parseEmoji(raw) {
  const match = /^<(a)?:([a-zA-Z0-9_]+):(\d+)>$/.exec(raw);

  if (!match) {
    return raw;
  }

  return {
    animated: Boolean(match[1]),
    name: match[2],
    id: match[3]
  };
}

/* =========================================================
   HELPERS
========================================================= */

function getPrefix(guildId) {
  return data.prefixes[guildId] || PREFIX;
}

function cleanText(text, max = 1024) {
  return String(text || "None provided").slice(0, max);
}

function memberMention(member) {
  return `<@${member.id}>`;
}

function moderationEmbed({
  title,
  action,
  member,
  moderator,
  reason,
  color = COLORS.red,
  extraFields = []
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `**${action}**\n\n` +
      `**User:** ${memberMention(member)}\n` +
      `**Moderator:** ${memberMention(moderator)}\n` +
      `**Reason:** ${cleanText(reason)}`
    )
    .setTimestamp()
    .setFooter({
      text: "Kenk Community • Moderation"
    });

  if (extraFields.length) {
    embed.addFields(extraFields);
  }

  return embed;
}

function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle("Action Failed")
    .setDescription(`❌ ${message}`)
    .setTimestamp()
    .setFooter({
      text: "Kenk Community"
    });
}

function successEmbed(title, message) {
  return new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle(title)
    .setDescription(`✅ ${message}`)
    .setTimestamp()
    .setFooter({
      text: "Kenk Community"
    });
}

function isStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function getWarnings(guildId, userId) {
  if (!data.warnings[guildId]) {
    data.warnings[guildId] = {};
  }

  if (!data.warnings[guildId][userId]) {
    data.warnings[guildId][userId] = [];
  }

  return data.warnings[guildId][userId];
}

async function getTargetMember(guild, user) {
  try {
    return await guild.members.fetch(user.id);
  } catch {
    return null;
  }
}

async function safeReply(interaction, payload) {
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload);
  }

  return interaction.reply(payload);
}

/* =========================================================
   DURATION PARSER
========================================================= */

function parseDuration(input) {
  if (!input) return null;

  const match = /^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i.exec(
    input.trim()
  );

  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  let multiplier;

  if (unit.startsWith("s")) multiplier = 1000;
  else if (unit.startsWith("m")) multiplier = 60 * 1000;
  else if (unit.startsWith("h")) multiplier = 60 * 60 * 1000;
  else if (unit.startsWith("d")) multiplier = 24 * 60 * 60 * 1000;
  else return null;

  const ms = amount * multiplier;

  if (ms <= 0) return null;

  return ms;
}

/* =========================================================
   TICKET TYPES
========================================================= */

const ticketTypes = {
  general: {
    label: "General Support",
    emoji: "<a:ticket:1544380950186819654>",
    description: "General questions and server help",
    fields: [
      { id: "issue", label: "What do you need help with?", style: TextInputStyle.Short, required: true },
      { id: "details", label: "What happened / what are you trying to do?", style: TextInputStyle.Paragraph, required: true },
      { id: "extra", label: "Anything else we should know?", style: TextInputStyle.Paragraph, required: false }
    ]
  },

  bug: {
    label: "Script & Bug Report",
    emoji: "🛠️",
    description: "Report scripts, bugs or technical problems",
    fields: [
      { id: "scriptName", label: "Script Name", style: TextInputStyle.Short, required: true },
      { id: "issue", label: "What bug/problem are you experiencing?", style: TextInputStyle.Paragraph, required: true },
      { id: "steps", label: "What were you doing when it happened?", style: TextInputStyle.Paragraph, required: false },
      { id: "extra", label: "Additional details / screenshot links", style: TextInputStyle.Paragraph, required: false }
    ]
  },

  booster: {
    label: "Booster Rewards",
    emoji: "<:SA_diamond:1484666181586518267>",
    description: "Questions about booster rewards",
    fields: [
      { id: "reward", label: "What booster reward is this about?", style: TextInputStyle.Short, required: true },
      { id: "boostDate", label: "When did you boost the server?", style: TextInputStyle.Short, required: false },
      { id: "extra", label: "Anything else you need help with?", style: TextInputStyle.Paragraph, required: false }
    ]
  },

  staff: {
    label: "Staff Report",
    emoji: "<:report:1020320832855228426>",
    description: "Report a staff or helper issue",
    fields: [
      { id: "reportedUser", label: "Who are you reporting?", style: TextInputStyle.Short, required: true },
      { id: "whatHappened", label: "What happened?", style: TextInputStyle.Paragraph, required: true },
      { id: "evidence", label: "Evidence or additional information?", style: TextInputStyle.Paragraph, required: false }
    ]
  },

  giveaway: {
    label: "Giveaway Support",
    emoji: "<a:GIVEAWAY:1543224209373921382>",
    description: "Host requests, claiming a prize, or giveaway issues",
    fields: [
      { id: "type", label: "Hosting a giveaway or claiming a prize?", style: TextInputStyle.Short, required: true },
      { id: "details", label: "Giveaway name / prize details", style: TextInputStyle.Paragraph, required: true },
      { id: "extra", label: "Additional information", style: TextInputStyle.Paragraph, required: false }
    ]
  },

  management: {
    label: "Management Team",
    emoji: "<a:CROWN:1543133743416352788>",
    description: "Management related support",
    fields: [
      { id: "topic", label: "What would you like to contact management about?", style: TextInputStyle.Short, required: true },
      { id: "explanation", label: "Please explain the situation", style: TextInputStyle.Paragraph, required: true },
      { id: "extra", label: "Anything else management should know?", style: TextInputStyle.Paragraph, required: false }
    ]
  }
};

/* =========================================================
   TICKET PANEL
========================================================= */

function ticketPanelEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.red)
    .setAuthor({
      name: "Kenk Community Support"
    })
    .setTitle("🎟️ Need Assistance?")
    .setDescription(
      "Select a ticket category below.\n\n" +
      "You'll be asked a few quick questions first — once you submit them, your ticket channel will be created.\n\n" +
      "Our support team will assist you as soon as possible."
    )
    .addFields(
      { name: `${ticketTypes.general.emoji} General Support`, value: "General questions and server help", inline: false },
      { name: "🛠️ Script & Bug Report", value: "Report bugs or script problems", inline: false },
      { name: `${ticketTypes.booster.emoji} Booster Rewards`, value: "Questions about booster rewards", inline: false },
      { name: `${ticketTypes.staff.emoji} Staff Report`, value: "Report a staff or helper issue", inline: false },
      { name: `${ticketTypes.giveaway.emoji} Giveaway Support`, value: "Giveaway questions and problems", inline: false },
      { name: `${ticketTypes.management.emoji} Management Team`, value: "Contact the management team", inline: false }
    )
    .setFooter({
      text: "Kenk Community • Support Team"
    });
}

function ticketPanelRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Select a ticket category")
    .addOptions(
      Object.entries(ticketTypes).map(([value, ticket]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(ticket.label)
          .setDescription(ticket.description)
          .setValue(value)
          .setEmoji(parseEmoji(ticket.emoji))
      )
    );

  return new ActionRowBuilder().addComponents(menu);
}

/* =========================================================
   TICKET MODAL
========================================================= */

function buildTicketModal(type) {
  const ticket = ticketTypes[type];

  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${type}`)
    .setTitle(ticket.label.slice(0, 45));

  const rows = ticket.fields.slice(0, 5).map(field => {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label.slice(0, 45))
      .setStyle(field.style)
      .setRequired(field.required)
      .setMaxLength(field.style === TextInputStyle.Paragraph ? 1000 : 200);

    return new ActionRowBuilder().addComponents(input);
  });

  modal.addComponents(...rows);

  return modal;
}

/* =========================================================
   TICKET OPEN
========================================================= */

async function openTicket(interaction, type, answers) {
  const guild = interaction.guild;
  const user = interaction.user;
  const ticket = ticketTypes[type];

  const category = guild.channels.cache.get(TICKET_CATEGORY_ID);

  if (!category || category.type !== ChannelType.GuildCategory) {
    return safeReply(interaction, {
      embeds: [
        errorEmbed(`Ticket category \`${TICKET_CATEGORY_ID}\` could not be found.`)
      ],
      ephemeral: true
    });
  }

  const safeName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 20);

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  const channel = await guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites,
    topic: `${ticket.label} • Opened by ${user.tag}`
  });

  const ticketId = channel.id;

  data.tickets[ticketId] = {
    guildId: guild.id,
    channelId: channel.id,
    userId: user.id,
    type,
    category: ticket.label,
    answers,
    claimedBy: null,
    openedAt: Date.now(),
    closed: false
  };

  saveData();

  const answerFields = ticket.fields.map(f => ({
    name: f.label,
    value: cleanText(answers[f.id]),
    inline: false
  }));

  const embed = new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle("Ticket Opened")
    .setDescription(
      `Thank you for contacting support, ${user}.\n` +
      `Please wait for a staff member to respond.\n\n` +
      `**Category:** ${ticket.emoji} ${ticket.label}`
    )
    .addFields(
      { name: "Status", value: "🟢 Open • Unclaimed" },
      ...answerFields
    )
    .setFooter({
      text: `Kenk Community • ${ticket.label}`
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim Ticket")
      .setEmoji("📜")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${user.id}> <@&${STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: [buttons]
  });

  const transcriptChannel = guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

  if (transcriptChannel?.isTextBased()) {
    await transcriptChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.green)
          .setTitle("🎟️ Ticket Opened")
          .addFields(
            { name: "User", value: `<@${user.id}>`, inline: true },
            { name: "Category", value: ticket.label, inline: true },
            { name: "Channel", value: `<#${channel.id}>`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: "Kenk Community • Ticket Logs" })
      ]
    });
  }

  return safeReply(interaction, {
    embeds: [
      successEmbed("Ticket Created", `Your ticket has been opened: <#${channel.id}>`)
    ],
    ephemeral: true
  });
}

/* =========================================================
   TRANSCRIPT
========================================================= */

async function getAllMessages(channel) {
  const messages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };

    if (lastId) {
      options.before = lastId;
    }

    const batch = await channel.messages.fetch(options);

    if (!batch.size) break;

    messages.push(...batch.values());

    lastId = batch.last().id;

    if (batch.size < 100) break;
  }

  return messages.reverse();
}

async function createTranscript(channel, closedBy, reason) {
  const messages = await getAllMessages(channel);

  let output = "";

  output += `Kenk Community Ticket Transcript\n`;
  output += `================================\n`;
  output += `Channel: #${channel.name}\n`;
  output += `Channel ID: ${channel.id}\n`;
  output += `Closed By: ${closedBy.tag}\n`;
  output += `Close Reason: ${reason}\n`;
  output += `Closed At: ${new Date().toISOString()}\n`;
  output += `================================\n\n`;

  for (const message of messages) {
    const time = message.createdAt.toISOString();

    let content = message.content || "[Embed / Attachment / Component]";

    if (message.attachments.size) {
      content +=
        " | Attachments: " +
        [...message.attachments.values()].map(a => a.url).join(", ");
    }

    output += `[${time}] ${message.author.tag}: ${content}\n`;
  }

  return Buffer.from(output, "utf8");
}

/* =========================================================
   CLAIM / UNCLAIM
========================================================= */

async function toggleClaim(interaction) {
  const channel = interaction.channel;
  const ticket = data.tickets[channel.id];

  if (!ticket || ticket.closed) {
    return safeReply(interaction, {
      embeds: [errorEmbed("This is not an active ticket.")],
      ephemeral: true
    });
  }

  if (!isStaff(interaction.member)) {
    return safeReply(interaction, {
      embeds: [errorEmbed("Only staff can claim tickets.")],
      ephemeral: true
    });
  }

  if (ticket.claimedBy === interaction.user.id) {
    ticket.claimedBy = null;

    await channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    saveData();

    const messages = await channel.messages.fetch({ limit: 20 });

    const ticketMessage = messages.find(
      m =>
        m.author.id === client.user.id &&
        m.components.length > 0 &&
        m.components[0].components.some(c => c.customId === "ticket_claim")
    );

    if (ticketMessage) {
      const oldEmbed = ticketMessage.embeds[0];

      const embed = EmbedBuilder.from(oldEmbed)
        .setColor(COLORS.red)
        .spliceFields(0, 1)
        .addFields({ name: "Status", value: "🟢 Open • Unclaimed" });

      await ticketMessage.edit({ embeds: [embed] });
    }

    return safeReply(interaction, {
      embeds: [
        successEmbed("Ticket Unclaimed", "The ticket is available for staff to claim again.")
      ],
      ephemeral: true
    });
  }

  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
    return safeReply(interaction, {
      embeds: [errorEmbed(`This ticket is already claimed by <@${ticket.claimedBy}>.`)],
      ephemeral: true
    });
  }

  ticket.claimedBy = interaction.user.id;

  await channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
    ViewChannel: false,
    SendMessages: false,
    ReadMessageHistory: false
  });

  await channel.permissionOverwrites.edit(interaction.user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  });

  saveData();

  const messages = await channel.messages.fetch({ limit: 20 });

  const ticketMessage = messages.find(
    m =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.components[0].components.some(c => c.customId === "ticket_claim")
  );

  if (ticketMessage) {
    const oldEmbed = ticketMessage.embeds[0];

    const embed = EmbedBuilder.from(oldEmbed)
      .setColor(COLORS.orange)
      .spliceFields(0, 1)
      .addFields({ name: "Status", value: `🟠 Claimed by <@${interaction.user.id}>` });

    await ticketMessage.edit({ embeds: [embed] });
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.orange)
        .setDescription(`📌 This ticket has been claimed by ${interaction.user}.`)
        .setFooter({ text: "Other staff members can no longer see this ticket." })
        .setTimestamp()
    ]
  });

  return safeReply(interaction, {
    embeds: [
      successEmbed(
        "Ticket Claimed",
        "You have claimed this ticket. Other staff members can no longer see it."
      )
    ],
    ephemeral: true
  });
}

/* =========================================================
   CLOSE TICKET
========================================================= */

async function showCloseModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("ticket_close_modal")
    .setTitle("Close Ticket");

  const reason = new TextInputBuilder()
    .setCustomId("close_reason")
    .setLabel("Reason for closing")
    .setPlaceholder("Enter the reason...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(reason));

  return interaction.showModal(modal);
}

async function closeTicket(interaction, reason) {
  const channel = interaction.channel;
  const ticket = data.tickets[channel.id];

  if (!ticket || ticket.closed) {
    return safeReply(interaction, {
      embeds: [errorEmbed("This is not an active ticket.")],
      ephemeral: true
    });
  }

  if (!isStaff(interaction.member)) {
    return safeReply(interaction, {
      embeds: [errorEmbed("Only staff can close tickets.")],
      ephemeral: true
    });
  }

  ticket.closed = true;
  ticket.closedBy = interaction.user.id;
  ticket.closeReason = reason;
  ticket.closedAt = Date.now();

  saveData();

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.red)
        .setTitle("🔒 Closing Ticket")
        .setDescription(`This ticket is being closed.\n\n**Reason:** ${reason}`)
        .setTimestamp()
    ]
  });

  let transcript;

  try {
    transcript = await createTranscript(channel, interaction.user, reason);
  } catch {
    transcript = Buffer.from(`Unable to generate transcript for ${channel.name}`, "utf8");
  }

  const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

  if (transcriptChannel?.isTextBased()) {
    await transcriptChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.red)
          .setTitle("🔒 Ticket Closed")
          .addFields(
            { name: "Ticket", value: `#${channel.name}`, inline: true },
            { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
            { name: "Closed By", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Category", value: ticket.category, inline: true },
            { name: "Reason", value: cleanText(reason, 1024), inline: false }
          )
          .setTimestamp()
          .setFooter({ text: "Kenk Community • Ticket Logs" })
      ],
      files: [
        {
          attachment: transcript,
          name: `${channel.name}-transcript.txt`
        }
      ]
    });
  }

  setTimeout(async () => {
    try {
      await channel.delete("Ticket closed");
    } catch {}
  }, 5000);
}

/* =========================================================
   SLASH COMMANDS
========================================================= */

const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Show the bot commands"),

  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("setupprefix")
    .setDescription("Change the server prefix")
    .addStringOption(o =>
      o.setName("prefix").setDescription("New prefix").setRequired(true).setMaxLength(5)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(o => o.setName("user").setDescription("Member to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(o => o.setName("userid").setDescription("User ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member")
    .addUserOption(o => o.setName("user").setDescription("Member to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutes").setDescription("Minutes").setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove a timeout")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove a warning")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addIntegerOption(o =>
      o.setName("number").setDescription("Warning number").setRequired(true).setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's warnings")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages from a specific member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addIntegerOption(o =>
      o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("clean")
    .setDescription("Delete bot messages")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock the current channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock the current channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode")
    .addIntegerOption(o =>
      o.setName("seconds").setDescription("Seconds").setRequired(true).setMinValue(0).setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("DM a member")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show member information")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send the ticket panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Start a giveaway")
    .addStringOption(o =>
      o.setName("duration").setDescription("Duration, e.g. 30s, 10m, 2h, 3d").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("winners").setDescription("Number of winners").setRequired(true).setMinValue(1)
    )
    .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
    .addAttachmentOption(o =>
      o.setName("image").setDescription("Optional image for the giveaway").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("reroll")
    .setDescription("Reroll a giveaway")
    .addStringOption(o =>
      o.setName("messageid").setDescription("Giveaway message ID").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

/* =========================================================
   REGISTER COMMANDS
========================================================= */

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registering slash commands...");

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`Registered ${commands.length} guild slash commands.`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log(`Registered ${commands.length} global slash commands.`);
    }
  } catch (error) {
    console.error("Slash command registration failed:", error);
  }
}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Prefix: ${PREFIX}`);
  console.log(`Ticket category: ${TICKET_CATEGORY_ID}`);
  console.log(`Transcript channel: ${TRANSCRIPT_CHANNEL_ID}`);

  client.user.setPresence({
    activities: [{ name: "Kenk Community", type: 3 }],
    status: "online"
  });

  await registerCommands();
});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
      const type = interaction.values[0];
      const ticket = ticketTypes[type];

      if (!ticket) {
        return safeReply(interaction, {
          embeds: [errorEmbed("Invalid ticket category.")],
          ephemeral: true
        });
      }

      const existing = Object.values(data.tickets).find(
        t => t.guildId === interaction.guild.id && t.userId === interaction.user.id && t.closed !== true
      );

      if (existing) {
        return safeReply(interaction, {
          embeds: [errorEmbed(`You already have an open ticket: <#${existing.channelId}>`)],
          ephemeral: true
        });
      }

      return interaction.showModal(buildTicketModal(type));
    }

    if (interaction.isButton()) {
      if (interaction.customId === "ticket_claim") {
        return toggleClaim(interaction);
      }

      if (interaction.customId === "ticket_close") {
        return showCloseModal(interaction);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal_")) {
      const type = interaction.customId.replace("ticket_modal_", "");
      const ticket = ticketTypes[type];

      if (!ticket) {
        return safeReply(interaction, {
          embeds: [errorEmbed("Invalid ticket category.")],
          ephemeral: true
        });
      }

      const answers = {};

      for (const field of ticket.fields) {
        try {
          answers[field.id] = interaction.fields.getTextInputValue(field.id);
        } catch {
          answers[field.id] = "None provided";
        }
      }

      return openTicket(interaction, type, answers);
    }

    if (interaction.isModalSubmit() && interaction.customId === "ticket_close_modal") {
      const reason = interaction.fields.getTextInputValue("close_reason");
      return closeTicket(interaction, reason);
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === "help") {
      const embed = new EmbedBuilder()
        .setColor(COLORS.red)
        .setTitle("Kenk Community • Commands")
        .setDescription(
          `Prefix: \`${getPrefix(interaction.guild.id)}\`\n\n` +
          "**Moderation**\n" +
          "`/ban` `/unban` `/kick` `/mute` `/unmute`\n" +
          "`/warn` `/unwarn` `/warnings`\n" +
          "`/clear` `/purge` `/clean`\n" +
          "`/lock` `/unlock` `/slowmode`\n\n" +
          "**Tickets**\n" +
          "`/ticketpanel`\n\n" +
          "**Server**\n" +
          "`/say` `/dm` `/userinfo` `/serverinfo` `/avatar`\n\n" +
          "**Booster (prefix only)**\n" +
          `\`${getPrefix(interaction.guild.id)}br <name>\` \`${getPrefix(interaction.guild.id)}br color <hex>\`\n` +
          `\`${getPrefix(interaction.guild.id)}br icon <emoji>\` \`${getPrefix(interaction.guild.id)}br delete\`\n\n` +
          "**Giveaways**\n" +
          "`/giveaway duration:30s|10m|2h|3d` `/reroll`"
        )
        .setFooter({ text: "Kenk Community" });

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "ping") {
      return interaction.reply({
        embeds: [successEmbed("Pong", `Latency: \`${client.ws.ping}ms\``)]
      });
    }

    if (commandName === "setupprefix") {
      const prefix = interaction.options.getString("prefix", true);

      data.prefixes[interaction.guild.id] = prefix;
      saveData();

      return interaction.reply({
        embeds: [successEmbed("Prefix Updated", `The server prefix is now \`${prefix}\``)]
      });
    }

    if (commandName === "ban") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await getTargetMember(interaction.guild, user);

      if (!member) {
        return interaction.reply({
          embeds: [errorEmbed("That member is not in this server.")],
          ephemeral: true
        });
      }

      if (member.id === interaction.user.id || !member.bannable) {
        return interaction.reply({
          embeds: [errorEmbed("I cannot ban that member. Check my role position and permissions.")],
          ephemeral: true
        });
      }

      await member.ban({ reason });

      return interaction.reply({
        embeds: [
          moderationEmbed({
            title: "Member Banned",
            action: "The member was permanently banned.",
            member,
            moderator: interaction.member,
            reason
          })
        ]
      });
    }

    if (commandName === "unban") {
      const userId = interaction.options.getString("userid", true);
      const reason = interaction.options.getString("reason") || "No reason provided";

      await interaction.guild.members.unban(userId, reason);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.green)
            .setTitle("Member Unbanned")
            .setDescription(
              `**User ID:** \`${userId}\`\n**Moderator:** ${interaction.user}\n**Reason:** ${reason}`
            )
            .setTimestamp()
            .setFooter({ text: "Kenk Community • Moderation" })
        ]
      });
    }

    if (commandName === "kick") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await getTargetMember(interaction.guild, user);

      if (!member || !member.kickable) {
        return interaction.reply({
          embeds: [errorEmbed("I cannot kick that member.")],
          ephemeral: true
        });
      }

      await member.kick(reason);

      return interaction.reply({
        embeds: [
          moderationEmbed({
            title: "Member Kicked",
            action: "The member was kicked from the server.",
            member,
            moderator: interaction.member,
            reason
          })
        ]
      });
    }

    if (commandName === "mute") {
      const user = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await getTargetMember(interaction.guild, user);

      if (!member || !member.moderatable) {
        return interaction.reply({
          embeds: [errorEmbed("I cannot mute that member.")],
          ephemeral: true
        });
      }

      await member.timeout(minutes * 60 * 1000, reason);

      return interaction.reply({
        embeds: [
          moderationEmbed({
            title: "Member Muted",
            action: `The member was timed out for **${minutes} minute(s)**.`,
            member,
            moderator: interaction.member,
            reason,
            color: COLORS.orange
          })
        ]
      });
    }

    if (commandName === "unmute") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await getTargetMember(interaction.guild, user);

      if (!member || !member.moderatable) {
        return interaction.reply({
          embeds: [errorEmbed("I cannot unmute that member.")],
          ephemeral: true
        });
      }

      await member.timeout(null, reason);

      return interaction.reply({
        embeds: [
          moderationEmbed({
            title: "Member Unmuted",
            action: "The member's timeout was removed.",
            member,
            moderator: interaction.member,
            reason,
            color: COLORS.green
          })
        ]
      });
    }

    if (commandName === "warn") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      const warnings = getWarnings(interaction.guild.id, user.id);

      warnings.push({ reason, moderator: interaction.user.id, timestamp: Date.now() });
      saveData();

      return interaction.reply({
        embeds: [
          moderationEmbed({
            title: "Member Warned",
            action: "A warning has been added to this member.",
            member: { id: user.id },
            moderator: interaction.member,
            reason,
            color: COLORS.yellow,
            extraFields: [{ name: "Total Warnings", value: String(warnings.length), inline: true }]
          })
        ]
      });
    }

    if (commandName === "unwarn") {
      const user = interaction.options.getUser("user", true);
      const number = interaction.options.getInteger("number", true);
      const warnings = getWarnings(interaction.guild.id, user.id);

      if (number > warnings.length) {
        return interaction.reply({
          embeds: [errorEmbed(`That user only has ${warnings.length} warning(s).`)],
          ephemeral: true
        });
      }

      const removed = warnings.splice(number - 1, 1)[0];
      saveData();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.green)
            .setTitle("Warning Removed")
            .setDescription(
              `**User:** <@${user.id}>\n**Removed warning:** #${number}\n` +
              `**Original reason:** ${removed.reason}\n**Moderator:** ${interaction.user}`
            )
            .setTimestamp()
            .setFooter({ text: "Kenk Community • Moderation" })
        ]
      });
    }

    if (commandName === "warnings") {
      const user = interaction.options.getUser("user", true);
      const warnings = getWarnings(interaction.guild.id, user.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.yellow)
        .setTitle(`Warnings • ${user.tag}`)
        .setDescription(
          warnings.length
            ? warnings.map((w, i) => `**#${i + 1}** — ${w.reason}\nModerator: <@${w.moderator}>`).join("\n\n")
            : "This member has no warnings."
        )
        .setFooter({ text: `Total warnings: ${warnings.length}` });

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "clear") {
      const amount = interaction.options.getInteger("amount", true);
      const deleted = await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({
        embeds: [successEmbed("Messages Cleared", `Deleted **${deleted.size}** message(s).`)],
        ephemeral: true
      });
    }

    if (commandName === "purge") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const selected = messages.filter(m => m.author.id === user.id).first(amount);

      if (!selected.length) {
        return interaction.reply({
          embeds: [errorEmbed("No messages from that user were found.")],
          ephemeral: true
        });
      }

      await interaction.channel.bulkDelete(selected, true);

      return interaction.reply({
        embeds: [
          successEmbed(
            "User Messages Purged",
            `Deleted **${selected.length}** message(s) from <@${user.id}>.`
          )
        ],
        ephemeral: true
      });
    }

    if (commandName === "clean") {
      const amount = interaction.options.getInteger("amount", true);
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const selected = messages.filter(m => m.author.bot).first(amount);

      if (!selected.length) {
        return interaction.reply({
          embeds: [errorEmbed("No bot messages were found.")],
          ephemeral: true
        });
      }

      await interaction.channel.bulkDelete(selected, true);

      return interaction.reply({
        embeds: [successEmbed("Bot Messages Cleaned", `Deleted **${selected.length}** bot message(s).`)],
        ephemeral: true
      });
    }

    if (commandName === "lock") {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });

      return interaction.reply({
        embeds: [successEmbed("Channel Locked", "Members can no longer send messages here.")]
      });
    }

    if (commandName === "unlock") {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null
      });

      return interaction.reply({
        embeds: [successEmbed("Channel Unlocked", "Members can send messages here again.")]
      });
    }

    if (commandName === "slowmode") {
      const seconds = interaction.options.getInteger("seconds", true);
      await interaction.channel.setRateLimitPerUser(seconds);

      return interaction.reply({
        embeds: [successEmbed("Slowmode Updated", `Slowmode is now **${seconds}s**.`)]
      });
    }

    if (commandName === "say") {
      const message = interaction.options.getString("message", true);
      await interaction.reply({ content: message });
    }

    if (commandName === "dm") {
      const user = interaction.options.getUser("user", true);
      const message = interaction.options.getString("message", true);

      try {
        await user.send(message);

        return interaction.reply({
          embeds: [successEmbed("DM Sent", `Message sent to **${user.tag}**.`)],
          ephemeral: true
        });
      } catch {
        return interaction.reply({
          embeds: [errorEmbed("I couldn't DM that user.")],
          ephemeral: true
        });
      }
    }

    if (commandName === "userinfo") {
      const user = interaction.options.getUser("user") || interaction.user;
      const member = await getTargetMember(interaction.guild, user);

      const embed = new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle(`User Information`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "Username", value: user.tag, inline: true },
          { name: "ID", value: user.id, inline: true },
          { name: "Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
        );

      if (member) {
        embed.addFields(
          { name: "Joined", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          {
            name: "Roles",
            value:
              member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .map(r => r.toString())
                .slice(0, 10)
                .join(", ") || "None",
            inline: false
          }
        );
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "serverinfo") {
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: "Members", value: String(guild.memberCount), inline: true },
          { name: "Channels", value: String(guild.channels.cache.size), inline: true },
          { name: "Roles", value: String(guild.roles.cache.size), inline: true },
          { name: "Owner", value: `<@${guild.ownerId}>`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "avatar") {
      const user = interaction.options.getUser("user") || interaction.user;

      const embed = new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle(`${user.tag}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 1024, extension: "png" }));

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "ticketpanel") {
      await interaction.channel.send({
        embeds: [ticketPanelEmbed()],
        components: [ticketPanelRow()]
      });

      return interaction.reply({
        embeds: [successEmbed("Ticket Panel Sent", "The support panel has been posted.")],
        ephemeral: true
      });
    }

    if (commandName === "giveaway") {
      const durationInput = interaction.options.getString("duration", true);
      const winners = interaction.options.getInteger("winners", true);
      const prize = interaction.options.getString("prize", true);
      const image = interaction.options.getAttachment("image");

      const durationMs = parseDuration(durationInput);

      if (!durationMs) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              "Invalid duration. Use a number followed by `s`, `m`, `h`, or `d` — e.g. `30s`, `10m`, `2h`, `3d`."
            )
          ],
          ephemeral: true
        });
      }

      const endAt = Date.now() + durationMs;

      const embed = new EmbedBuilder()
        .setColor(COLORS.purple)
        .setTitle("🎉 GIVEAWAY")
        .setDescription(
          `**Prize:** ${prize}\n\n` +
          `**Winners:** ${winners}\n` +
          `**Ends:** <t:${Math.floor(endAt / 1000)}:R>\n\n` +
          `Click the button below to enter!`
        )
        .setFooter({ text: "Kenk Community • Giveaway" });

      if (image) {
        embed.setImage(image.url);
      }

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_enter")
          .setLabel("Enter Giveaway")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Primary)
      );

      const message = await interaction.channel.send({
        embeds: [embed],
        components: [button]
      });

      data.giveaways[message.id] = {
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        prize,
        winners,
        endAt,
        imageUrl: image ? image.url : null,
        entries: []
      };

      saveData();

      return interaction.reply({
        embeds: [successEmbed("Giveaway Created", `Giveaway started for **${prize}**.`)],
        ephemeral: true
      });
    }

    if (commandName === "reroll") {
      const messageId = interaction.options.getString("messageid", true);
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

      const winner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.green)
            .setTitle("🎉 Giveaway Rerolled")
            .setDescription(`New winner: <@${winner}>\n\nPrize: **${giveaway.prize}**`)
        ]
      });
    }
  } catch (error) {
    console.error(error);

    try {
      await safeReply(interaction, {
        embeds: [errorEmbed("Something went wrong while processing that command.")],
        ephemeral: true
      });
    } catch {}
  }
});

/* =========================================================
   GIVEAWAY BUTTON
========================================================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "giveaway_enter") return;

  const giveaway = data.giveaways[interaction.message.id];

  if (!giveaway) {
    return interaction.reply({
      embeds: [errorEmbed("This giveaway no longer exists.")],
      ephemeral: true
    });
  }

  if (Date.now() >= giveaway.endAt) {
    return interaction.reply({
      embeds: [errorEmbed("This giveaway has already ended.")],
      ephemeral: true
    });
  }

  if (giveaway.entries.includes(interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed("You are already entered in this giveaway.")],
      ephemeral: true
    });
  }

  giveaway.entries.push(interaction.user.id);
  saveData();

  return interaction.reply({
    embeds: [successEmbed("Entry Added", "You have entered the giveaway.")],
    ephemeral: true
  });
});

/* =========================================================
   GIVEAWAY FINISHER
========================================================= */

setInterval(async () => {
  for (const [messageId, giveaway] of Object.entries(data.giveaways)) {
    if (Date.now() < giveaway.endAt) continue;

    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      if (!channel?.isTextBased()) continue;

      let message;

      try {
        message = await channel.messages.fetch(messageId);
      } catch {}

      if (!giveaway.finished) {
        giveaway.finished = true;

        if (!giveaway.entries.length) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.red)
                .setTitle("🎉 Giveaway Ended")
                .setDescription(`Prize: **${giveaway.prize}**\n\nNo valid entries were found.`)
            ]
          });

          saveData();
          continue;
        }

        const shuffled = [...giveaway.entries].sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, Math.min(giveaway.winners, shuffled.length));

        const resultEmbed = new EmbedBuilder()
          .setColor(COLORS.green)
          .setTitle("🎉 GIVEAWAY ENDED")
          .setDescription(
            `**Prize:** ${giveaway.prize}\n\n**Winner(s):** ${winners.map(id => `<@${id}>`).join(", ")}`
          )
          .setFooter({ text: "Kenk Community • Giveaway" });

        if (giveaway.imageUrl) {
          resultEmbed.setImage(giveaway.imageUrl);
        }

        await channel.send({
          content: winners.map(id => `<@${id}>`).join(", "),
          embeds: [resultEmbed]
        });

        if (message) {
          await message.edit({ components: [] });
        }

        saveData();
      }
    } catch (error) {
      console.error("Giveaway error:", error);
    }
  }
}, 15000);

/* =========================================================
   PREFIX COMMANDS
========================================================= */

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = getPrefix(message.guild.id);

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  try {
    if (command === "br") {
      let freshMember;

      try {
        freshMember = await message.guild.members.fetch({
          user: message.author.id,
          force: true
        });
      } catch {
        return message.reply({
          embeds: [errorEmbed("I couldn't verify your member data. Try again in a moment.")]
        });
      }

      if (!freshMember.premiumSince) {
        return message.reply({
          embeds: [errorEmbed("You need to be a server booster to use this.")]
        });
      }

      const botMember = message.guild.members.me;

      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply({
          embeds: [
            errorEmbed(
              "I'm missing the **Manage Roles** permission, so I can't create or edit booster roles. Ask an admin to grant it."
            )
          ]
        });
      }

      const sub = args[0]?.toLowerCase();
      const existingRoleId = data.boosterRoles[message.guild.id]?.[message.author.id];
      const existingRole = existingRoleId
        ? message.guild.roles.cache.get(existingRoleId)
        : null;

      if (sub === "delete") {
        if (!existingRole) {
          return message.reply({
            embeds: [errorEmbed("You don't have a booster custom role.")]
          });
        }

        try {
          await existingRole.delete("Booster role removed by owner");
        } catch {
          return message.reply({
            embeds: [errorEmbed("I couldn't delete that role — it may be positioned above my highest role.")]
          });
        }

        delete data.boosterRoles[message.guild.id][message.author.id];
        saveData();

        return message.reply({
          embeds: [successEmbed("Booster Role Removed", "Your booster role has been **deleted**.")]
        });
      }

      if (sub === "color") {
        const hex = args[1];

        if (!hex) {
          return message.reply({
            embeds: [errorEmbed(`Usage: \`${prefix}br color <hex>\``)]
          });
        }

        if (!existingRole) {
          return message.reply({
            embeds: [errorEmbed(`You don't have a booster role yet. Use \`${prefix}br <name>\` first.`)]
          });
        }

        try {
          await existingRole.setColor(hex);
          return message.reply({ embeds: [successEmbed("Role color updated.", " ")] });
        } catch {
          return message.reply({ embeds: [errorEmbed("Invalid hex color, or I lack permission to edit that role.")] });
        }
      }

      if (sub === "icon") {
        const emoji = args[1];

        if (!emoji) {
          return message.reply({
            embeds: [errorEmbed(`Usage: \`${prefix}br icon <emoji>\``)]
          });
        }

        if (!existingRole) {
          return message.reply({
            embeds: [errorEmbed(`You don't have a booster role yet. Use \`${prefix}br <name>\` first.`)]
          });
        }

        try {
          await existingRole.setUnicodeEmoji(emoji);
          return message.reply({ embeds: [successEmbed("Role Icon Updated", "Your role icon has been updated.")] });
        } catch {
          return message.reply({
            embeds: [
              errorEmbed(
                "Couldn't set that icon. Role icons require a higher server boost level (Level 2+), or the emoji isn't valid."
              )
            ]
          });
        }
      }

      const name = args.join(" ");

      if (!name) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.yellow)
              .setTitle("Booster Role Commands")
              .addFields(
                { name: `${prefix}br <name>`, value: "\u200b" },
                { name: `${prefix}br color <hex>`, value: "\u200b" },
                { name: `${prefix}br icon <emoji>`, value: "\u200b" },
                { name: `${prefix}br delete`, value: "\u200b" }
              )
          ]
        });
      }

      if (existingRole) {
        try {
          await existingRole.setName(name);
          return message.reply({
            embeds: [successEmbed("Booster role name set to " + name, " ")]
          });
        } catch {
          return message.reply({
            embeds: [errorEmbed("I couldn't rename your role — it may be positioned above my highest role.")]
          });
        }
      }

      let role;

      try {
        role = await message.guild.roles.create({
          name,
          color: "#5865F2",
          reason: `Booster role for ${message.author.tag}`
        });

        const botHighest = botMember.roles.highest.position;
        await role.setPosition(Math.max(1, botHighest - 1));
        await message.member.roles.add(role);
      } catch (err) {
        console.error("Booster role creation error:", err);

        if (role) {
          await role.delete("Rollback: failed to finish booster role setup").catch(() => {});
        }

        return message.reply({
          embeds: [
            errorEmbed(
              "I couldn't finish creating your booster role. Make sure my role is positioned above where booster roles should sit, and that I have **Manage Roles**."
            )
          ]
        });
      }

      if (!data.boosterRoles[message.guild.id]) {
        data.boosterRoles[message.guild.id] = {};
      }

      data.boosterRoles[message.guild.id][message.author.id] = role.id;
      saveData();

      return message.reply({
        embeds: [
          successEmbed("Booster Role Created", `Your custom role ${role} has been created and assigned to you.`)
        ]
      });
    }

    if (!isStaff(message.member)) return;

    if (command === "ban") {
      const member = message.mentions.members.first();

      if (!member) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}ban @user reason\``)] });
      }

      const reason = args.slice(1).join(" ") || "No reason provided";

      if (!member.bannable) {
        return message.reply({ embeds: [errorEmbed("I cannot ban that member.")] });
      }

      await member.ban({ reason });

      return message.channel.send({
        embeds: [
          moderationEmbed({
            title: "Member Banned",
            action: "The member was permanently banned.",
            member,
            moderator: message.member,
            reason
          })
        ]
      });
    }

    if (command === "unban") {
      const userId = args[0];

      if (!userId) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}unban USER_ID reason\``)] });
      }

      const reason = args.slice(1).join(" ") || "No reason provided";

      await message.guild.members.unban(userId, reason);

      return message.channel.send({
        embeds: [
          successEmbed(
            "Member Unbanned",
            `User ID: \`${userId}\` has been unbanned.\n\n**Reason:** ${reason}`
          )
        ]
      });
    }

    if (command === "kick") {
      const member = message.mentions.members.first();

      if (!member) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}kick @user reason\``)] });
      }

      const reason = args.slice(1).join(" ") || "No reason provided";

      if (!member.kickable) {
        return message.reply({ embeds: [errorEmbed("I cannot kick that member.")] });
      }

      await member.kick(reason);

      return message.channel.send({
        embeds: [
          moderationEmbed({
            title: "Member Kicked",
            action: "The member was kicked from the server.",
            member,
            moderator: message.member,
            reason
          })
        ]
      });
    }

    if (command === "mute") {
      const member = message.mentions.members.first();
      const minutes = Number(args[1]);

      if (!member || !minutes) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}mute @user minutes reason\``)] });
      }

      const reason = args.slice(2).join(" ") || "No reason provided";

      await member.timeout(minutes * 60 * 1000, reason);

      return message.channel.send({
        embeds: [
          moderationEmbed({
            title: "Member Muted",
            action: `The member was timed out for **${minutes} minute(s)**.`,
            member,
            moderator: message.member,
            reason,
            color: COLORS.orange
          })
        ]
      });
    }

    if (command === "unmute") {
      const member = message.mentions.members.first();
      if (!member) return;

      await member.timeout(null, "Timeout removed");

      return message.channel.send({
        embeds: [
          moderationEmbed({
            title: "Member Unmuted",
            action: "The member's timeout was removed.",
            member,
            moderator: message.member,
            reason: "Timeout removed",
            color: COLORS.green
          })
        ]
      });
    }

    if (command === "warn") {
      const member = message.mentions.members.first();

      if (!member) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}warn @user reason\``)] });
      }

      const reason = args.slice(1).join(" ") || "No reason provided";
      const warnings = getWarnings(message.guild.id, member.id);

      warnings.push({ reason, moderator: message.author.id, timestamp: Date.now() });
      saveData();

      return message.channel.send({
        embeds: [
          moderationEmbed({
            title: "Member Warned",
            action: "A warning has been added to this member.",
            member,
            moderator: message.member,
            reason,
            color: COLORS.yellow,
            extraFields: [{ name: "Total Warnings", value: String(warnings.length) }]
          })
        ]
      });
    }

    if (command === "unwarn") {
      const member = message.mentions.members.first();
      const number = Number(args[1]);

      if (!member || !number) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}unwarn @user warning-number\``)] });
      }

      const warnings = getWarnings(message.guild.id, member.id);

      if (!warnings[number - 1]) {
        return message.reply({ embeds: [errorEmbed("That warning does not exist.")] });
      }

      const removed = warnings.splice(number - 1, 1)[0];
      saveData();

      return message.channel.send({
        embeds: [
          successEmbed(
            "Warning Removed",
            `Removed warning **#${number}** from ${member}.\n\n**Reason:** ${removed.reason}`
          )
        ]
      });
    }

    if (command === "warnings") {
      const member = message.mentions.members.first();
      if (!member) return;

      const warnings = getWarnings(message.guild.id, member.id);

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.yellow)
            .setTitle(`Warnings • ${member.user.tag}`)
            .setDescription(
              warnings.length
                ? warnings.map((w, i) => `**#${i + 1}** ${w.reason}\nModerator: <@${w.moderator}>`).join("\n\n")
                : "No warnings."
            )
        ]
      });
    }

    if (command === "purge") {
      const member = message.mentions.members.first();
      const amount = Number(args[1] || args[0]);

      if (!member || !amount) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}purge @user amount\``)] });
      }

      const messages = await message.channel.messages.fetch({ limit: 100 });
      const selected = messages.filter(m => m.author.id === member.id).first(Math.min(amount, 100));

      if (!selected.length) {
        return message.reply({ embeds: [errorEmbed("No messages found.")] });
      }

      await message.channel.bulkDelete(selected, true);

      return message.channel
        .send({
          embeds: [successEmbed("Messages Purged", `Deleted **${selected.length}** messages from ${member}.`)]
        })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    if (command === "clean") {
      const amount = Number(args[0]);

      if (!amount) {
        return message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}clean amount\``)] });
      }

      const messages = await message.channel.messages.fetch({ limit: 100 });
      const selected = messages.filter(m => m.author.bot).first(Math.min(amount, 100));

      await message.channel.bulkDelete(selected, true);

      return message.channel
        .send({ embeds: [successEmbed("Bot Messages Cleaned", `Deleted **${selected.length}** bot messages.`)] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    if (command === "clear") {
      const amount = Number(args[0]);
      if (!amount) return;

      const deleted = await message.channel.bulkDelete(Math.min(amount, 100), true);

      return message.channel
        .send({ embeds: [successEmbed("Messages Cleared", `Deleted **${deleted.size}** messages.`)] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    if (command === "lock") {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });

      return message.channel.send({
        embeds: [successEmbed("Channel Locked", "Members can no longer send messages here.")]
      });
    }

    if (command === "unlock") {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });

      return message.channel.send({
        embeds: [successEmbed("Channel Unlocked", "Members can send messages here again.")]
      });
    }

    if (command === "slowmode") {
      const seconds = Number(args[0]);
      if (isNaN(seconds)) return;

      await message.channel.setRateLimitPerUser(seconds);

      return message.channel.send({
        embeds: [successEmbed("Slowmode Updated", `Slowmode is now **${seconds}s**.`)]
      });
    }

    if (command === "say") {
      const text = args.join(" ");
      if (!text) return;

      await message.delete().catch(() => {});
      return message.channel.send(text);
    }

    if (command === "dm") {
      const member = message.mentions.members.first();
      if (!member) return;

      const text = args.slice(1).join(" ");
      if (!text) return;

      try {
        await member.send(text);
        return message.reply({ embeds: [successEmbed("DM Sent", `Message sent to ${member}.`)] });
      } catch {
        return message.reply({ embeds: [errorEmbed("I couldn't DM that member.")] });
      }
    }

    if (command === "ticketpanel") {
      await message.channel.send({
        embeds: [ticketPanelEmbed()],
        components: [ticketPanelRow()]
      });

      return message.delete().catch(() => {});
    }
  } catch (error) {
    console.error("Prefix command error:", error);
  }
});

/* =========================================================
   BOOSTER CLEANUP
========================================================= */

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    if (oldMember.premiumSince && !newMember.premiumSince) {
      const roleId = data.boosterRoles[newMember.guild.id]?.[newMember.id];
      if (!roleId) return;

      const role = newMember.guild.roles.cache.get(roleId);

      if (role) {
        await role.delete("Booster stopped boosting");
      }

      delete data.boosterRoles[newMember.guild.id][newMember.id];
      saveData();
    }
  } catch (error) {
    console.error("Booster cleanup error:", error);
  }
});

/* =========================================================
   LOGIN
========================================================= */

client.login(TOKEN);
