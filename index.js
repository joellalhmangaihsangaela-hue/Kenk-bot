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

// Ticket staff/helper role
const STAFF_ROLE_ID = "1506669903673950338";

// Default prefix
const DEFAULT_PREFIX = ",";

// Data file
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

if (!TOKEN) {
    console.error("ERROR: DISCORD_TOKEN is missing.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("ERROR: CLIENT_ID is missing.");
    process.exit(1);
}

/* =========================================================
   DATABASE
========================================================= */

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let data = {
    prefixes: {},
    warnings: {},
    tickets: {},
    giveaways: {},
    boosterRoles: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const saved = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        data = {
            prefixes: saved.prefixes || {},
            warnings: saved.warnings || {},
            tickets: saved.tickets || {},
            giveaways: saved.giveaways || {},
            boosterRoles: saved.boosterRoles || {}
        };
    } catch (error) {
        console.error("Could not read data.json. Starting fresh.");
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.error("Could not save data:", error);
    }
}

function getPrefix(guildId) {
    return data.prefixes[guildId] || DEFAULT_PREFIX;
}

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.GuildMember
    ]
});

/* =========================================================
   HELPERS
========================================================= */

function embed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x5865F2)
        .setTimestamp();
}

function isStaff(member) {
    if (!member) return false;

    return (
        member.permissions.has(
            PermissionsBitField.Flags.Administrator
        ) ||
        member.permissions.has(
            PermissionsBitField.Flags.ManageGuild
        ) ||
        member.roles.cache.has(STAFF_ROLE_ID)
    );
}

function cleanId(value) {
    return String(value).replace(/[<@!#&>]/g, "");
}

function findMember(message, value) {
    if (!value) return null;

    const id = cleanId(value);

    return (
        message.mentions.members.first() ||
        message.guild.members.cache.get(id) ||
        null
    );
}

function parseDuration(value) {
    if (!value) return null;

    const match = String(value)
        .trim()
        .match(/^(\d+)(s|m|h|d|w)$/i);

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const units = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
    };

    return amount * units[unit];
}

function getRandomWinners(entries, amount) {
    const shuffled = [...entries];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [
            shuffled[j],
            shuffled[i]
        ];
    }

    return shuffled.slice(0, amount);
}

async function requireStaff(interaction) {
    if (isStaff(interaction.member)) return true;

    await interaction.reply({
        embeds: [
            embed(
                "Permission Denied",
                "You do not have permission to use this command."
            )
        ],
        ephemeral: true
    });

    return false;
}

/* =========================================================
   SLASH COMMANDS
========================================================= */

const slashCommands = [
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all commands"),

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check bot latency"),

    new SlashCommandBuilder()
        .setName("setupprefix")
        .setDescription("Change the server prefix")
        .addStringOption(option =>
            option
                .setName("prefix")
                .setDescription("New prefix")
                .setRequired(true)
                .setMaxLength(5)
        ),

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
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user")
        .addStringOption(option =>
            option
                .setName("userid")
                .setDescription("User ID")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
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
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a member")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duration")
                .setDescription("Example: 10m, 1h, 1d")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a timeout")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View warnings")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete messages")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("1-
