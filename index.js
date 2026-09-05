const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

require('dotenv').config();
const fs = require('fs');
const path = require('path');

/* =========================
   KENK COMMUNITY BOT
   ========================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const PREFIX = process.env.PREFIX || ',';

const STAFF_ROLE_ID =
  process.env.STAFF_ROLE_ID || '1506669903673950338';

const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID || '1507026446940508351';

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    'Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in Railway Variables.'
  );
  process.exit(1);
}

/* =========================
   DATA
   ========================= */

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        warnings: {},
        tickets: {},
        giveaways: {},
        boosterRoles: {}
      },
      null,
      2
    )
  );
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {
      warnings: {},
      tickets: {},
      giveaways: {},
      boosterRoles: {}
    };
  }
}

let data = loadData();

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

/* =========================
   CLIENT
   ========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User
  ]
});

const COLORS = {
  blue: 0x5865f2,
  green: 0x57f287,
  red: 0xed4245,
  yellow: 0xfee75c,
  dark: 0x232428
};

/* =========================
   HELPERS
   ========================= */

function isStaff(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(STAFF_ROLE_ID) ||
    member.permissions.has(
      PermissionsBitField.Flags.ManageGuild
    ) ||
    member.permissions.has(
      PermissionsBitField.Flags.ModerateMembers
    )
  );
}

function hasPermission(member, permission) {
  return member.permissions.has(permission);
}

function modEmbed(title, description, color = COLORS.blue) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({
      text: 'Kenk Community'
    });
}

/* =========================
   SLASH COMMANDS
   ========================= */

const commands = [

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all commands'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addStringOption(o =>
      o.setName('userid')
        .setDescription('User ID')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('seconds')
        .setDescription('Timeout duration')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(2419200)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a timeout')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Remove a warning')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('number')
        .setDescription('Warning number')
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages')
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('1-100')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages from one user')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('1-100')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('clean')
    .setDescription('Delete bot messages')
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('1-100')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock this channel'),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock this channel'),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode')
    .addIntegerOption(o =>
      o.setName('seconds')
        .setDescription('0-21600')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change nickname')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Member')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('nickname')
        .setDescription('New nickname')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage roles')
    .addSubcommand(s =>
      s.setName('add')
        .setDescription('Add a role')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('Member')
            .setRequired(true)
        )
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('Role')
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('remove')
        .setDescription('Remove a role')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('Member')
            .setRequired(true)
        )
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('Role')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as the bot')
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Message')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('DM a user')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Message')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View user information')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('View server information'),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('View avatar')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Send the ticket panel'),

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway')
    .addIntegerOption(o =>
      o.setName('minutes')
        .setDescription('Duration')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(o =>
      o.setName('winners')
        .setDescription('Number of winners')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(o =>
      o.setName('prize')
        .setDescription('Prize')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('reroll')
    .setDescription('Reroll giveaway')
    .addStringOption(o =>
      o.setName('messageid')
        .setDescription('Giveaway message ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('boosterrole')
    .setDescription('Manage your booster role')
    .addSubcommand(s =>
      s.setName('create')
        .setDescription('Create booster role')
        .addStringOption(o =>
          o.setName('name')
            .setDescription('Role name')
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('name')
        .setDescription('Rename booster role')
        .addStringOption(o =>
          o.setName('name')
            .setDescription('New name')
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('color')
        .setDescription('Change booster role color')
        .addStringOption(o =>
          o.setName('color')
            .setDescription('#5865F2')
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('delete')
        .setDescription('Delete booster role')
    )

].map(command => command.toJSON());

/* =========================
   REGISTER COMMANDS
   ========================= */

async function registerCommands() {

  const rest = new REST({
    version: '10'
  }).setToken(TOKEN);

  // DELETE OLD GLOBAL COMMANDS
  // This fixes duplicate slash commands.
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    {
      body: []
    }
  );

  // REGISTER ONLY ON YOUR SERVER
  await rest.put(
    Routes.applicationGuildCommands(
      CLIENT_ID,
      GUILD_ID
    ),
    {
      body: commands
    }
  );

  console.log(
    `Registered ${commands.length} slash commands.`
  );
}

/* =========================
   READY
   ========================= */

client.once('ready', async () => {

  console.log(
    `Logged in as ${client.user.tag}`
  );

  client.user.setActivity(
    'Kenk Community',
    {
      type: 3
    }
  );

  try {
    await registerCommands();
  } catch (error) {
    console.error(
      'Command registration error:',
      error
    );
  }
});

/* =========================
   INTERACTIONS
   ========================= */

client.on(
  'interactionCreate',
  async interaction => {

    try {

      if (interaction.isChatInputCommand()) {
        await handleSlash(interaction);
        return;
      }

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === 'ticket_category'
      ) {
        await showTicketQuestions(interaction);
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {

        if (
          interaction.customId.startsWith(
            'ticket_modal:'
          )
        ) {
          await createTicket(interaction);
          return;
        }

        if (
          interaction.customId.startsWith(
            'close_ticket:'
          )
        ) {
          await closeTicket(interaction);
          return;
        }
      }

    } catch (error) {

      console.error(error);

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        await interaction.followUp({
          content:
            'Something went wrong.',
          ephemeral: true
        }).catch(() => {});
      } else {
        await interaction.reply({
          content:
            'Something went wrong.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

/* =========================
   SLASH HANDLER
   ========================= */

async function handleSlash(i) {

  const name = i.commandName;

  /* HELP */

  if (name === 'help') {

    const embed =
      new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle('Kenk Community')
        .setDescription(
          'Moderation, support and community commands.'
        )
        .addFields(
          {
            name: 'Moderation',
            value:
              '`/ban` `/unban` `/kick` `/mute` `/unmute`\n' +
              '`/warn` `/unwarn` `/warnings`'
          },
          {
            name: 'Messages',
            value:
              '`/clear` `/purge` `/clean`\n' +
              '`/lock` `/unlock` `/slowmode`'
          },
          {
            name: 'Management',
            value:
              '`/nick` `/role add` `/role remove`\n' +
              '`/say` `/dm`'
          },
          {
            name: 'Information',
            value:
              '`/userinfo` `/serverinfo` `/avatar` `/ping`'
          },
          {
            name: 'Community',
            value:
              '`/ticketpanel` `/giveaway` `/reroll`\n' +
              '`/boosterrole`'
          }
        )
        .setFooter({
          text: 'Kenk Community'
        });

    return i.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /* PING */

  if (name === 'ping') {
    return i.reply(
      `Pong! \`${client.ws.ping}ms\``
    );
  }

  /* STAFF CHECK */

  const staffCommands = [
    'ban',
    'unban',
    'kick',
    'mute',
    'unmute',
    'warn',
    'unwarn',
    'warnings',
    'clear',
    'purge',
    'clean',
    'lock',
    'unlock',
    'slowmode',
    'nick',
    'role'
  ];

  if (
    staffCommands.includes(name) &&
    !isStaff(i.member)
  ) {
    return i.reply({
      content:
        'You do not have permission to use this command.',
      ephemeral: true
    });
  }

  /* BAN */

  if (name === 'ban') {

    if (
      !hasPermission(
        i.member,
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return i.reply({
        content:
          'You need Ban Members permission.',
        ephemeral: true
      });
    }

    const user =
      i.options.getUser('user');

    const reason =
      i.options.getString('reason') ||
      'No reason provided';

    const member =
      await i.guild.members
        .fetch(user.id)
        .catch(() => null);

    if (
      member &&
      !member.bannable
    ) {
      return i.reply({
        content:
          'I cannot ban that member.',
        ephemeral: true
      });
    }

    await i.guild.members.ban(
      user.id,
      {
        reason
      }
    );

    return i.reply({
      embeds: [
        modEmbed(
          'Member Banned',
          `**User:** ${user}\n**Reason:** ${reason}`,
          COLORS.red
        )
      ]
    });
  }

  /* UNBAN */

  if (name === 'unban') {

    const userId =
      i.options.getString('userid');

    const reason =
      i.options.getString('reason') ||
      'No reason provided';

    await i.guild.members.unban(
      userId,
      reason
    );

    return i.reply({
      embeds: [
        modEmbed(
          'User Unbanned',
          `**ID:** \`${userId}\`\n**Reason:** ${reason}`,
          COLORS.green
        )
      ]
    });
  }

  /* KICK */

  if (name === 'kick') {

    const user =
      i.options.getUser('user');

    const reason =
      i.options.getString('reason') ||
      'No reason provided';

    const member =
      await i.guild.members
        .fetch(user.id)
        .catch(() => null);

    if (!member) {
      return i.reply({
        content:
          'That user is not in the server.',
        ephemeral: true
      });
    }

    if (!member.kickable) {
      return i.reply({
        content:
          'I cannot kick that member.',
        ephemeral: true
      });
    }

    await member.kick(reason);

    return i.reply({
      embeds: [
        modEmbed(
          'Member Kicked',
          `**User:** ${user}\n**Reason:** ${reason}`,
          COLORS.red
        )
      ]
    });
  }

  /* MUTE */

  if (name === 'mute') {

    const member =
      i.options.getMember('user');

    const seconds =
      i.options.getInteger('seconds');

    const reason =
      i.options.getString('reason') ||
      'No reason provided';

    if (!member) {
      return i.reply({
        content:
          'That member is not in the server.',
        ephemeral: true
      });
    }

    if (!member.moderatable) {
      return i.reply({
        content:
          'I cannot timeout that member.',
        ephemeral: true
      });
    }

    await member.timeout(
      seconds * 1000,
      reason
    );

    return i.reply({
      embeds: [
        modEmbed(
          'Member Muted',
          `**User:** ${member.user}\n**Duration:** ${seconds}s\n**Reason:** ${reason}`,
          COLORS.yellow
        )
      ]
    });
  }

  /* UNMUTE */

  if (name === 'unmute') {

    const member =
      i.options.getMember('user');

    if (!member) {
      return i.reply({
        content:
          'That member is not in the server.',
        ephemeral: true
      });
    }

    await member.timeout(
      null,
      'Timeout removed'
    );

    return i.reply({
      embeds: [
        modEmbed(
          'Member Unmuted',
          `${member.user} is no longer timed out.`,
          COLORS.green
        )
      ]
    });
  }

  /* WARN */

  if (name === 'warn') {

    const user =
      i.options.getUser('user');

    const reason =
      i.options.getString('reason');

    if (!data.warnings[user.id]) {
      data.warnings[user.id] = [];
    }

    data.warnings[user.id].push({
      moderator: i.user.id,
      reason,
      time: Date.now()
    });

    saveData();

    return i.reply({
      embeds: [
        modEmbed(
          'Member Warned',
          `**User:** ${user}\n**Reason:** ${reason}\n**Total Warnings:** ${data.warnings[user.id].length}`,
          COLORS.yellow
        )
      ]
    });
  }

  /* UNWARN */

  if (name === 'unwarn') {

    const user =
      i.options.getUser('user');

    const number =
      i.options.getInteger('number');

    if (
      !data.warnings[user.id] ||
      !data.warnings[user.id].length
    ) {
      return i.reply({
        content:
          'That user has no warnings.',
        ephemeral: true
      });
    }

    if (
      number >
      data.warnings[user.id].length
    ) {
      return i.reply({
        content:
          'That warning number does not exist.',
        ephemeral: true
      });
    }

    data.warnings[user.id]
      .splice(number - 1, 1);

    saveData();

    return i.reply({
      embeds: [
        modEmbed(
          'Warning Removed',
          `Removed warning **#${number}** from ${user}.`,
          COLORS.green
        )
      ]
    });
  }

  /* WARNINGS */

  if (name === 'warnings') {

    const user =
      i.options.getUser('user');

    const warnings =
      data.warnings[user.id] || [];

    if (!warnings.length) {
      return i.reply({
        embeds: [
          modEmbed(
            'Warnings',
            `${user} has no warnings.`,
            COLORS.green
          )
        ]
      });
    }

    const text =
      warnings
        .map(
          (w, index) =>
            `**#${index + 1}** — ${w.reason}\nModerator: <@${w.moderator}>`
        )
        .join('\n\n')
        .slice(0, 4000);

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.yellow)
          .setTitle(
            `Warnings — ${user.tag}`
          )
          .setDescription(text)
      ]
    });
  }

  /* CLEAR */

  if (name === 'clear') {

    const amount =
      i.options.getInteger('amount');

    await i.channel.bulkDelete(
      amount,
      true
    );

    return i.reply({
      content:
        `Deleted ${amount} messages.`,
      ephemeral: true
    });
  }

  /* PURGE */

  if (name === 'purge') {

    const user =
      i.options.getUser('user');

    const amount =
      i.options.getInteger('amount');

    const messages =
      await i.channel.messages.fetch({
        limit: 100
      });

    const selected =
      messages
        .filter(
          m =>
            m.author.id === user.id
        )
        .first(amount);

    if (!selected.length) {
      return i.reply({
        content:
          'No recent messages from that user were found.',
        ephemeral: true
      });
    }

    await i.channel.bulkDelete(
      selected,
      true
    );

    return i.reply({
      content:
        `Deleted ${selected.length} messages from ${user}.`,
      ephemeral: true
    });
  }

  /* CLEAN */

  if (name === 'clean') {

    const amount =
      i.options.getInteger('amount');

    const messages =
      await i.channel.messages.fetch({
        limit: 100
      });

    const selected =
      messages
        .filter(
          m => m.author.bot
        )
        .first(amount);

    if (!selected.length) {
      return i.reply({
        content:
          'No recent bot messages found.',
        ephemeral: true
      });
    }

    await i.channel.bulkDelete(
      selected,
      true
    );

    return i.reply({
      content:
        `Deleted ${selected.length} bot messages.`,
      ephemeral: true
    });
  }

  /* LOCK */

  if (name === 'lock') {

    await i.channel.permissionOverwrites.edit(
      i.guild.roles.everyone,
      {
        SendMessages: false
      }
    );

    return i.reply({
      embeds: [
        modEmbed(
          'Channel Locked',
          'Members can no longer send messages here.',
          COLORS.red
        )
      ]
    });
  }

  /* UNLOCK */

  if (name === 'unlock') {

    await i.channel.permissionOverwrites.edit(
      i.guild.roles.everyone,
      {
        SendMessages: null
      }
    );

    return i.reply({
      embeds: [
        modEmbed(
          'Channel Unlocked',
          'Members can send messages here again.',
          COLORS.green
        )
      ]
    });
  }

  /* SLOWMODE */

  if (name === 'slowmode') {

    const seconds =
      i.options.getInteger('seconds');

    await i.channel.setRateLimitPerUser(
      seconds
    );

    return i.reply(
      `Slowmode set to **${seconds}s**.`
    );
  }

  /* NICK */

  if (name === 'nick') {

    const member =
      i.options.getMember('user');

    const nickname =
      i.options.getString('nickname');

    if (!member.manageable) {
      return i.reply({
        content:
          'I cannot manage that member.',
        ephemeral: true
      });
    }

    await member.setNickname(
      nickname || null
    );

    return i.reply(
      nickname
        ? `Nickname changed to **${nickname}**.`
        : 'Nickname reset.'
    );
  }

  /* ROLE */

  if (name === 'role') {

    const member =
      i.options.getMember('user');

    const role =
      i.options.getRole('role');

    if (!role.editable) {
      return i.reply({
        content:
          'I cannot manage that role because of role hierarchy.',
        ephemeral: true
      });
    }

    if (
      i.options.getSubcommand() ===
      'add'
    ) {

      await member.roles.add(role);

      return i.reply(
        `Added ${role} to ${member}.`
      );
    }

    await member.roles.remove(role);

    return i.reply(
      `Removed ${role} from ${member}.`
    );
  }

  /* SAY */

  if (name === 'say') {

    if (!isStaff(i.member)) {
      return i.reply({
        content: 'Staff only.',
        ephemeral: true
      });
    }

    return i.reply(
      i.options.getString('message')
    );
  }

  /* DM */

  if (name === 'dm') {

    if (!isStaff(i.member)) {
      return i.reply({
        content: 'Staff only.',
        ephemeral: true
      });
    }

    const user =
      i.options.getUser('user');

    const message =
      i.options.getString('message');

    try {

      await user.send(message);

      return i.reply({
        content:
          `DM sent to ${user}.`,
        ephemeral: true
      });

    } catch {

      return i.reply({
        content:
          'I could not DM that user.',
        ephemeral: true
      });
    }
  }

  /* USERINFO */

  if (name === 'userinfo') {

    const user =
      i.options.getUser('user') ||
      i.user;

    const member =
      await i.guild.members
        .fetch(user.id)
        .catch(() => null);

    const embed =
      new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle(user.tag)
        .setThumbnail(
          user.displayAvatarURL({
            size: 512
          })
        )
        .addFields(
          {
            name: 'User ID',
            value: `\`${user.id}\``,
            inline: true
          },
          {
            name: 'Account',
            value:
              `<t:${Math.floor(
                user.createdTimestamp / 1000
              )}:R>`,
            inline: true
          },
          {
            name: 'Joined',
            value:
              member
                ? `<t:${Math.floor(
                    member.joinedTimestamp / 1000
                  )}:R>`
                : 'Unknown',
            inline: true
          }
        );

    return i.reply({
      embeds: [embed]
    });
  }

  /* SERVERINFO */

  if (name === 'serverinfo') {

    const embed =
      new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle(i.guild.name)
        .setThumbnail(
          i.guild.iconURL({
            size: 512
          })
        )
        .addFields(
          {
            name: 'Members',
            value:
              `${i.guild.memberCount}`,
            inline: true
          },
          {
            name: 'Channels',
            value:
              `${i.guild.channels.cache.size}`,
            inline: true
          },
          {
            name: 'Roles',
            value:
              `${i.guild.roles.cache.size}`,
            inline: true
          }
        );

    return i.reply({
      embeds: [embed]
    });
  }

  /* AVATAR */

  if (name === 'avatar') {

    const user =
      i.options.getUser('user') ||
      i.user;

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.blue)
          .setTitle(
            `${user.username}'s Avatar`
          )
          .setImage(
            user.displayAvatarURL({
              size: 1024
            })
          )
      ]
    });
  }

  /* TICKET PANEL */

  if (name === 'ticketpanel') {

    if (!isStaff(i.member)) {
      return i.reply({
        content: 'Staff only.',
        ephemeral: true
      });
    }

    await i.channel.send(
      buildTicketPanel()
    );

    return i.reply({
      content:
        'Ticket panel sent.',
      ephemeral: true
    });
  }

  /* GIVEAWAY */

  if (name === 'giveaway') {

    if (!isStaff(i.member)) {
      return i.reply({
        content: 'Staff only.',
        ephemeral: true
      });
    }

    const minutes =
      i.options.getInteger('minutes');

    const winners =
      i.options.getInteger('winners');

    const prize =
      i.options.getString('prize');

    const endAt =
      Date.now() +
      minutes * 60 * 1000;

    const embed =
      new EmbedBuilder()
        .setColor(COLORS.blue)
        .setTitle('Giveaway')
        .setDescription(
          `**Prize:** ${prize}\n` +
          `**Winners:** ${winners}\n` +
          `**Ends:** <t:${Math.floor(
            endAt / 1000
          )}:R>\n\n` +
          `Click the button below to enter.`
        )
        .setFooter({
          text: 'Kenk Community'
        });

    const row =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              'giveaway_enter'
            )
            .setLabel(
              'Enter Giveaway'
            )
            .setStyle(
              ButtonStyle.Primary
            )
        );

    const message =
      await i.channel.send({
        embeds: [embed],
        components: [row]
      });

    data.giveaways[message.id] = {
      channelId: i.channel.id,
      prize,
      winners,
      endAt,
      participants: []
    };

    saveData();

    return i.reply({
      content:
        'Giveaway started.',
      ephemeral: true
    });
  }

  /* REROLL */

  if (name === 'reroll') {

    if (!isStaff(i.member)) {
      return i.reply({
        content: 'Staff only.',
        ephemeral: true
      });
    }

    const messageId =
      i.options.getString(
        'messageid'
      );

    const giveaway =
      data.giveaways[messageId];

    if (!giveaway) {
      return i.reply({
        content:
          'Giveaway not found.',
        ephemeral: true
      });
    }

    const users =
      giveaway.participants;

    if (!users.length) {
      return i.reply({
        content:
          'No participants.',
        ephemeral: true
      });
    }

    const winner =
      users[
        Math.floor(
          Math.random() *
          users.length
        )
      ];

    return i.reply(
      `🎉 New giveaway winner: <@${winner}>`
    );
  }

  /* BOOSTER ROLE */

  if (name === 'boosterrole') {
    return handleBoosterRole(i);
  }
}

/* =========================
   TICKET PANEL
   ========================= */

function buildTicketPanel() {

  const embed =
    new EmbedBuilder()
      .setColor(COLORS.blue)
      .setTitle(
        'Kenk Community Support'
      )
      .setDescription(
        'Need help? Select the category that best matches your issue below.\n\n' +
        'Please provide accurate information when opening a ticket.'
      )
      .addFields(
        {
          name: 'General Support',
          value:
            'General questions or server help.',
          inline: true
        },
        {
          name: 'Script & Bug Reports',
          value:
            'Report scripts, bugs or technical issues.',
          inline: true
        },
        {
          name: 'Giveaway Support',
          value:
            'Problems with a giveaway or prize.',
          inline: true
        },
        {
          name: 'Staff / Helper Report',
          value:
            'Report a staff member or helper.',
          inline: true
        }
      )
      .setFooter({
        text:
          'Kenk Community • Support'
      });

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        'ticket_category'
      )
      .setPlaceholder(
        'Select a ticket category'
      )
      .addOptions(

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'General Support'
          )
          .setDescription(
            'General questions or server help'
          )
          .setValue('general'),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Script & Bug Reports'
          )
          .setDescription(
            'Report a script or bug'
          )
          .setValue('script'),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Giveaway Support'
          )
          .setDescription(
            'Help with a giveaway or prize'
          )
          .setValue('giveaway'),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            'Staff / Helper Report'
          )
          .setDescription(
            'Report a staff member or helper'
          )
          .setValue('staff')
      );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder()
        .addComponents(menu)
    ]
  };
}

/* =========================
   TICKET QUESTIONS
   ========================= */

const ticketQuestions = {

  general: [
    [
      'issue',
      'What do you need help with?',
      'Explain your issue.'
    ],
    [
      'tried',
      'What have you tried?',
      'Tell us what you tried.'
    ],
    [
      'extra',
      'Anything else?',
      'Additional information.'
    ]
  ],

  script: [
    [
      'bug',
      'What script or bug?',
      'Describe the script or bug.'
    ],
    [
      'problem',
      'What happens?',
      'Explain what happens.'
    ],
    [
      'steps',
      'Can you reproduce it?',
      'Tell us the steps.'
    ]
  ],

  giveaway: [
    [
      'giveaway',
      'Which giveaway?',
      'Which giveaway is this about?'
    ],
    [
      'problem',
      'What is the issue?',
      'Explain the problem.'
    ],
    [
      'evidence',
      'Any evidence?',
      'Add useful evidence/details.'
    ]
  ],

  staff: [
    [
      'person',
      'Who are you reporting?',
      'Name or mention the staff member.'
    ],
    [
      'reason',
      'What happened?',
      'Explain what happened.'
    ],
    [
      'evidence',
      'What evidence do you have?',
      'Add useful evidence.'
    ]
  ]
};

function categoryTitle(category) {

  return {
    general: 'General Support',
    script: 'Script & Bug Report',
    giveaway: 'Giveaway Support',
    staff: 'Staff / Helper Report'
  }[category] || 'Support';
}

/* =========================
   SHOW QUESTIONS
   ========================= */

async function showTicketQuestions(
  interaction
) {

  const category =
    interaction.values[0];

  const questions =
    ticketQuestions[category];

  const modal =
    new ModalBuilder()
      .setCustomId(
        `ticket_modal:${category}`
      )
      .setTitle(
        categoryTitle(category)
      );

  for (
    const [id, label, placeholder]
    of questions
  ) {

    const input =
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setPlaceholder(
          placeholder
        )
        .setStyle(
          TextInputStyle.Paragraph
        )
        .setRequired(true)
        .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(input)
    );
  }

  await interaction.showModal(
    modal
  );
}

/* =========================
   CREATE TICKET
   ========================= */

async function createTicket(
  interaction
) {

  const category =
    interaction.customId
      .split(':')[1];

  const guild =
    interaction.guild;

  const existing =
    guild.channels.cache.find(
      channel =>
        channel.type ===
          ChannelType.GuildText &&
        channel.topic &&
        channel.topic.includes(
          `ticketOwner:${interaction.user.id}`
        )
    );

  if (existing) {

    return interaction.reply({
      content:
        `You already have an open ticket: ${existing}`,
      ephemeral: true
    });
  }

  const ticketNumber =
    Object.keys(data.tickets)
      .length + 1;

  const channel =
    await guild.channels.create({
      name:
        `ticket-${ticketNumber}`,

      type:
        ChannelType.GuildText,

      parent:
        TICKET_CATEGORY_ID,

      topic:
        `ticketOwner:${interaction.user.id} | category:${category}`,

      permissionOverwrites: [

        {
          id:
            guild.roles.everyone.id,

          deny: [
            PermissionsBitField.Flags
              .ViewChannel
          ]
        },

        {
          id:
            interaction.user.id,

          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles
          ]
        },

        {
          id:
            STAFF_ROLE_ID,

          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages
          ]
        },

        {
          id:
            client.user.id,

          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

  const questions =
    ticketQuestions[category];

  const answers =
    questions.map(
      ([id, label]) => ({
        label,
        value:
          interaction.fields
            .getTextInputValue(id)
      })
    );

  data.tickets[channel.id] = {
    ownerId:
      interaction.user.id,

    category,

    createdAt:
      Date.now(),

    claimedBy:
      null
  };

  saveData();

  const embed =
    new EmbedBuilder()
      .setColor(COLORS.blue)
      .setTitle(
        'Ticket Opened'
      )
      .setDescription(
        'Thank you for contacting support.\n' +
        'Please describe your issue and wait for a response.\n\n' +

        answers
          .map(
            answer =>
              `**${answer.label}**\n${answer.value}`
          )
          .join('\n\n')
      )
      .setFooter({
        text:
          'Kenk Community Support'
      })
      .setTimestamp();

  const buttons =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            'ticket_close'
          )
          .setLabel(
            'Close Ticket'
          )
          .setEmoji('🔒')
          .setStyle(
            ButtonStyle.Danger
          ),

        new ButtonBuilder()
          .setCustomId(
            'ticket_claim'
          )
          .setLabel(
            'Claim Ticket'
          )
          .setEmoji('📜')
          .setStyle(
            ButtonStyle.Secondary
          )
      );

  await channel.send({

    content:
      `<@&${STAFF_ROLE_ID}>`,

    embeds: [
      embed
    ],

    components: [
      buttons
    ],

    allowedMentions: {
      roles: [
        STAFF_ROLE_ID
      ]
    }
  });

  await interaction.reply({
    content:
      `Your ticket has been created: ${channel}`,
    ephemeral: true
  });
}

/* =========================
   BUTTONS
   ========================= */

async function handleButton(
  interaction
) {

  /* GIVEAWAY */

  if (
    interaction.customId ===
    'giveaway_enter'
  ) {

    const giveaway =
      data.giveaways[
        interaction.message.id
      ];

    if (!giveaway) {
      return interaction.reply({
        content:
          'This giveaway is no longer active.',
        ephemeral: true
      });
    }

    if (
      Date.now() >=
      giveaway.endAt
    ) {
      return interaction.reply({
        content:
          'This giveaway has ended.',
        ephemeral: true
      });
    }

    if (
      giveaway.participants
        .includes(
          interaction.user.id
        )
    ) {
      return interaction.reply({
        content:
          'You are already entered.',
        ephemeral: true
      });
    }

    giveaway.participants.push(
      interaction.user.id
    );

    saveData();

    return interaction.reply({
      content:
        'You are entered! Good luck.',
      ephemeral: true
    });
  }

  /* CLAIM */

  if (
    interaction.customId ===
    'ticket_claim'
  ) {

    if (
      !isStaff(
        interaction.member
      )
    ) {
      return interaction.reply({
        content:
          'Only staff can claim tickets.',
        ephemeral: true
      });
    }

    const ticket =
      data.tickets[
        interaction.channel.id
      ];

    if (!ticket) {
      return interaction.reply({
        content:
          'Ticket data not found.',
        ephemeral: true
      });
    }

    if (ticket.claimedBy) {
      return interaction.reply({
        content:
          `This ticket is already claimed by <@${ticket.claimedBy}>.`,
        ephemeral: true
      });
    }

    ticket.claimedBy =
      interaction.user.id;

    saveData();

    return interaction.reply({
      embeds: [
        modEmbed(
          'Ticket Claimed',
          `${interaction.user} has claimed this ticket and will handle it.`,
          COLORS.green
        )
      ]
    });
  }

  /* CLOSE */

  if (
    interaction.customId ===
    'ticket_close'
  ) {

    if (
      !isStaff(
        interaction.member
      )
    ) {
      return interaction.reply({
        content:
          'Only staff can close tickets.',
        ephemeral: true
      });
    }

    const modal =
      new ModalBuilder()
        .setCustomId(
          `close_ticket:${interaction.channel.id}`
        )
        .setTitle(
          'Close Ticket'
        );

    const reason =
      new TextInputBuilder()
        .setCustomId(
          'close_reason'
        )
        .setLabel(
          'Why are you closing this ticket?'
        )
        .setPlaceholder(
          'Enter a closing reason...'
        )
        .setStyle(
          TextInputStyle.Paragraph
        )
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder()
        .addComponents(reason)
    );

    return interaction.showModal(
      modal
    );
  }
}

/* =========================
   CLOSE TICKET
   ========================= */

async function closeTicket(
  interaction
) {

  if (
    !isStaff(
      interaction.member
    )
  ) {
    return interaction.reply({
      content:
        'Only staff can close tickets.',
      ephemeral: true
    });
  }

  const reason =
    interaction.fields
      .getTextInputValue(
        'close_reason'
      );

  const embed =
    new EmbedBuilder()
      .setColor(COLORS.red)
      .setTitle(
        'Ticket Closed'
      )
      .setDescription(
        `This ticket will be closed shortly.\n\n` +
        `**Closed by:** ${interaction.user}\n` +
        `**Reason:** ${reason}`
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed]
  });

  delete data.tickets[
    interaction.channel.id
  ];

  saveData();

  setTimeout(() => {

    interaction.channel
      .delete(
        'Ticket closed'
      )
      .catch(() => {});

  }, 3000);
}

/* =========================
   BOOSTER ROLE
   ========================= */

async function handleBoosterRole(i) {

  if (!i.member.premiumSince) {

    return i.reply({
      content:
        'You need to be a server booster to use this.',
      ephemeral: true
    });
  }

  const sub =
    i.options.getSubcommand();

  let role =
    data.boosterRoles[i.user.id]
      ? i.guild.roles.cache.get(
          data.boosterRoles[
            i.user.id
          ]
        )
      : null;

  if (sub === 'create') {

    if (role) {

      return i.reply({
        content:
          `You already have ${role}.`,
        ephemeral: true
      });
    }

    role =
      await i.guild.roles.create({
        name:
          i.options.getString(
            'name'
          ),
        reason:
          `Booster role for ${i.user.tag}`
      });

    await i.member.roles.add(
      role
    );

    data.boosterRoles[
      i.user.id
    ] = role.id;

    saveData();

    return i.reply(
      `Created ${role} and added it to you.`
    );
  }

  if (!role) {

    return i.reply({
      content:
        'You do not have a booster role yet. Use `/boosterrole create` first.',
      ephemeral: true
    });
  }

  if (sub === 'name') {

    const name =
      i.options.getString(
        'name'
      );

    await role.setName(
      name
    );

    return i.reply(
      `Booster role renamed to **${name}**.`
    );
  }

  if (sub === 'color') {

    const color =
      i.options
        .getString('color')
        .replace('#', '');

    if (
      !/^[0-9A-Fa-f]{6}$/.test(
        color
      )
    ) {

      return i.reply({
        content:
          'Use a valid hex color such as `#5865F2`.',
        ephemeral: true
      });
    }

    await role.setColor(
      `#${color}`
    );

    return i.reply(
      `Booster role color changed to **#${color.toUpperCase()}**.`
    );
  }

  if (sub === 'delete') {

    await role.delete(
      'Booster role deleted'
    );

    delete data.boosterRoles[
      i.user.id
    ];

    saveData();

    return i.reply(
      'Your booster role has been deleted.'
    );
  }
}

/* =========================
   PREFIX COMMANDS
   ========================= */

client.on(
  'messageCreate',
  async message => {

    if (
      message.author.bot ||
      !message.guild
    ) return;

    if (
      !message.content.startsWith(
        PREFIX
      )
    ) return;

    const args =
      message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command =
      (
        args.shift() || ''
      ).toLowerCase();

    const staff =
      isStaff(message.member);

    /* HELP */

    if (command === 'help') {

      return message.reply(
        `**Kenk Community**\n\n` +
        `**Moderation:** \`${PREFIX}ban\` \`${PREFIX}unban\` \`${PREFIX}kick\` \`${PREFIX}mute\` \`${PREFIX}unmute\` \`${PREFIX}warn\` \`${PREFIX}unwarn\` \`${PREFIX}warnings\`\n` +
        `**Messages:** \`${PREFIX}clear\` \`${PREFIX}purge\` \`${PREFIX}clean\` \`${PREFIX}lock\` \`${PREFIX}unlock\` \`${PREFIX}slowmode\`\n` +
        `**Other:** \`${PREFIX}ticketpanel\` \`${PREFIX}say\``
      );
    }

    /* STAFF */

    const staffCommands = [
      'ban',
      'unban',
      'kick',
      'mute',
      'unmute',
      'warn',
      'unwarn',
      'warnings',
      'clear',
      'purge',
      'clean',
      'lock',
      'unlock',
      'slowmode'
    ];

    if (
      staffCommands.includes(
        command
      ) &&
      !staff
    ) {
      return message.reply(
        'You do not have permission to use that command.'
      );
    }

    /* PURGE */

    if (command === 'purge') {

      const user =
        message.mentions.users.first();

      const amount =
        Math.min(
          Math.max(
            parseInt(args[1]) || 0,
            1
          ),
          100
        );

      if (
        !user ||
        !amount
      ) {
        return message.reply(
          `Usage: \`${PREFIX}purge @user 25\``
        );
      }

      const messages =
        await message.channel
          .messages.fetch({
            limit: 100
          });

      const selected =
        messages
          .filter(
            m =>
              m.author.id ===
              user.id
          )
          .first(amount);

      if (!selected.length) {
        return message.reply(
          'No recent messages from that user were found.'
        );
      }

      await message.channel.bulkDelete(
        selected,
        true
      );

      return message.reply(
        `Deleted ${selected.length} messages from ${user}.`
      );
    }

    /* CLEAN */

    if (command === 'clean') {

      const amount =
        Math.min(
          Math.max(
            parseInt(args[0]) || 0,
            1
          ),
          100
        );

      const messages =
        await message.channel
          .messages.fetch({
            limit: 100
          });

      const selected =
        messages
          .filter(
            m => m.author.bot
          )
          .first(amount);

      if (!selected.length) {
        return message.reply(
          'No recent bot messages found.'
        );
      }

      await message.channel.bulkDelete(
        selected,
        true
      );

      return message.reply(
        `Deleted ${selected.length} bot messages.`
      );
    }

    /* WARN */

    if (command === 'warn') {

      const user =
        message.mentions.users.first();

      const reason =
        args
          .slice(1)
          .join(' ') ||
        'No reason provided';

      if (!user) {
        return message.reply(
          `Usage: \`${PREFIX}warn @user reason\``
        );
      }

      if (!data.warnings[user.id]) {
        data.warnings[user.id] = [];
      }

      data.warnings[user.id].push({
        moderator:
          message.author.id,
        reason,
        time:
          Date.now()
      });

      saveData();

      return message.reply(
        `${user} warned. Warnings: **${data.warnings[user.id].length}**`
      );
    }

    /* UNWARN */

    if (command === 'unwarn') {

      const user =
        message.mentions.users.first();

      const number =
        parseInt(args[1]);

      if (
        !user ||
        !number
      ) {
        return message.reply(
          `Usage: \`${PREFIX}unwarn @user 1\``
        );
      }

      if (
        !data.warnings[user.id] ||
        !data.warnings[user.id].length
      ) {
        return message.reply(
          'That user has no warnings.'
        );
      }

      if (
        number >
        data.warnings[user.id].length
      ) {
        return message.reply(
          'That warning does not exist.'
        );
      }

      data.warnings[user.id]
        .splice(
          number - 1,
          1
        );

      saveData();

      return message.reply(
        `Removed warning **#${number}** from ${user}.`
      );
    }

    /* WARNINGS */

    if (command === 'warnings') {

      const user =
        message.mentions.users.first();

      if (!user) {
        return message.reply(
          `Usage: \`${PREFIX}warnings @user\``
        );
      }

      const warnings =
        data.warnings[user.id] ||
        [];

      if (!warnings.length) {
        return message.reply(
          `${user} has no warnings.`
        );
      }

      return message.reply(
        warnings
          .map(
            (w, index) =>
              `**#${index + 1}** ${w.reason} — <@${w.moderator}>`
          )
          .join('\n')
      );
    }

    /* LOCK */

    if (
      command === 'lock' ||
      command === 'unlock'
    ) {

      const locked =
        command === 'lock';

      await message.channel
        .permissionOverwrites.edit(
          message.guild.roles.everyone,
          {
            SendMessages:
              locked
                ? false
                : null
          }
        );

      return message.reply(
        locked
          ? '🔒 Channel locked.'
          : '🔓 Channel unlocked.'
      );
    }

    /* SLOWMODE */

    if (
      command ===
      'slowmode'
    ) {

      const seconds =
        Math.min(
          Math.max(
            parseInt(args[0]) || 0,
            0
          ),
          21600
        );

      await message.channel
        .setRateLimitPerUser(
          seconds
        );

      return message.reply(
        `Slowmode set to **${seconds}s**.`
      );
    }

    /* CLEAR */

    if (command === 'clear') {

      const amount =
        Math.min(
          Math.max(
            parseInt(args[0]) || 0,
            1
          ),
          100
        );

      await message.channel
        .bulkDelete(
          amount,
          true
        );

      return;
    }

    /* BAN */

    if (command === 'ban') {

      const user =
        message.mentions.users.first();

      const reason =
        args
          .slice(1)
          .join(' ') ||
        'No reason provided';

      if (!user) {
        return message.reply(
          `Usage: \`${PREFIX}ban @user reason\``
        );
      }

      const member =
        await message.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (
        member &&
        !member.bannable
      ) {
        return message.reply(
          'I cannot ban that member.'
        );
      }

      await message.guild.members.ban(
        user.id,
        {
          reason
        }
      );

      return message.reply(
        `🔨 ${user.tag} has been banned.`
      );
    }

    /* UNBAN */

    if (command === 'unban') {

      const userId =
        args[0];

      if (!userId) {
        return message.reply(
          `Usage: \`${PREFIX}unban USER_ID\``
        );
      }

      await message.guild.members.unban(
        userId
      );

      return message.reply(
        `User \`${userId}\` has been unbanned.`
      );
    }

    /* KICK */

    if (command === 'kick') {

      const member =
        message.mentions.members.first();

      const reason =
        args
          .slice(1)
          .join(' ') ||
        'No reason provided';

      if (!member) {
        return message.reply(
          `Usage: \`${PREFIX}kick @user reason\``
        );
      }

      if (!member.kickable) {
        return message.reply(
          'I cannot kick that member.'
        );
      }

      await member.kick(
        reason
      );

      return message.reply(
        `👢 ${member.user.tag} has been kicked.`
      );
    }

    /* MUTE */

    if (command === 'mute') {

      const member =
        message.mentions.members.first();

      const seconds =
        parseInt(args[1]);

      if (
        !member ||
        !seconds
      ) {
        return message.reply(
          `Usage: \`${PREFIX}mute @user seconds\``
        );
      }

      if (!member.moderatable) {
        return message.reply(
          'I cannot timeout that member.'
        );
      }

      await member.timeout(
        seconds * 1000,
        args
          .slice(2)
          .join(' ') ||
        'No reason provided'
      );

      return message.reply(
        `🔇 ${member.user.tag} timed out for **${seconds}s**.`
      );
    }

    /* UNMUTE */

    if (command === 'unmute') {

      const member =
        message.mentions.members.first();

      if (!member) {
        return message.reply(
          `Usage: \`${PREFIX}unmute @user\``
        );
      }

      await member.timeout(
        null,
        'Timeout removed'
      );

      return message.reply(
        `🔊 ${member.user.tag} is no longer timed out.`
      );
    }

    /* TICKET PANEL */

    if (
      command ===
      'ticketpanel'
    ) {

      if (!staff) {
        return message.reply(
          'Staff only.'
        );
      }

      await message.channel.send(
        buildTicketPanel()
      );

      return message.reply(
        'Ticket panel sent.'
      );
    }

    /* SAY */

    if (command === 'say') {

      if (!staff) {
        return message.reply(
          'Staff only.'
        );
      }

      const text =
        args.join(' ');

      if (!text) {
        return message.reply(
          `Usage: \`${PREFIX}say message\``
        );
      }

      return message.channel.send(
        text
      );
    }
  }
);

/* =========================
   GIVEAWAY CHECKER
   ========================= */

setInterval(
  async () => {

    for (
      const [
        messageId,
        giveaway
      ]
      of Object.entries(
        data.giveaways
      )
    ) {

      if (
        Date.now() <
        giveaway.endAt
      ) continue;

      const channel =
        await client.channels
          .fetch(
            giveaway.channelId
          )
          .catch(() => null);

      if (!channel) {
        delete data.giveaways[
          messageId
        ];
        continue;
      }

      const message =
        await channel.messages
          .fetch(messageId)
          .catch(() => null);

      if (!message) {
        delete data.giveaways[
          messageId
        ];
        continue;
      }

      const users =
        [
          ...new Set(
            giveaway.participants
          )
        ];

      const winners = [];

      while (
        winners.length <
          giveaway.winners &&
        users.length
      ) {

        const index =
          Math.floor(
            Math.random() *
            users.length
          );

        winners.push(
          users.splice(
            index,
            1
          )[0]
        );
      }

      const winnerText =
        winners.length
          ? winners
              .map(
                id => `<@${id}>`
              )
              .join(', ')
          : 'No valid participants.';

      const embed =
        new EmbedBuilder()
          .setColor(COLORS.green)
          .setTitle(
            'Giveaway Ended'
          )
          .setDescription(
            `**Prize:** ${giveaway.prize}\n\n` +
            `**Winner(s):** ${winnerText}`
          )
          .setFooter({
            text:
              'Kenk Community'
          });

      await message.edit({
        embeds: [embed],
        components: []
      }).catch(() => {});

      await channel.send(
        `🎉 Congratulations ${winnerText}! You won **${giveaway.prize}**!`
      ).catch(() => {});

      delete data.giveaways[
        messageId
      ];
    }

    saveData();

  },
  15000
);

/* =========================
   BOOSTER CLEANUP
   ========================= */

client.on(
  'guildMemberUpdate',
  async (
    oldMember,
    newMember
  ) => {

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
          'Booster stopped boosting'
        ).catch(() => {});
      }

      delete data.boosterRoles[
        newMember.id
      ];

      saveData();
    }
  }
);

/* =========================
   ERRORS
   ========================= */

process.on(
  'unhandledRejection',
  error =>
    console.error(
      'Unhandled rejection:',
      error
    )
);

process.on(
  'uncaughtException',
  error =>
    console.error(
      'Uncaught exception:',
      error
    )
);

/* =========================
   LOGIN
   ========================= */

client.login(TOKEN);
