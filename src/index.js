/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║                    DISCORD BOT PROFESSIONAL V3.0                      ║
 * ║                                                                       ║
 * ║  Sistema Completo de Whitelist, Tickets e Gerenciamento FiveM        ║
 * ║                                                                       ║
 * ║  Desenvolvedor: mirandadeveloper                                     ║
 * ║  Discord: mirandadeveloper                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

// Core System Initialization
const { _v, _g } = require('./utils/core-system');
_v();

require('dotenv').config();

// Força o Node a preferir IPv4 na resolução de DNS. Em muitas redes (principalmente
// no Brasil), o IPv6 está mal configurado/quebrado e o Node tenta conectar por IPv6
// primeiro, travando até dar timeout antes de cair pro IPv4 que funciona. Isso causa
// erros intermitentes tipo "ConnectTimeoutError" e "Unknown interaction" ao falar com
// a API do Discord.
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Client, GatewayIntentBits, Partials, Collection, ActivityType, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Internal Modules
const { initializeDatabase, setRatingPanelHandler } = require('./utils/database');
const logger = require('./utils/system-logs');
const { startPanelUpdaterLoop } = require('./utils/panelUpdater');
const { startStaffPanelUpdaterLoop } = require('./utils/staffPanelUpdater');
const { getAllFiveMConfigs } = require('./utils/database');
const { updateFiveMStatus } = require('./commands/fivem/setup');

// Handlers
const ratingPanelHandler = require('./handlers/ratingPanelHandler');
const { startRatingPanelUpdaterLoop } = require('./handlers/ratingPanelHandler');

// Network Management
// Internal module removed for security optimization

if (!process.env.TOKEN) {
  console.error('\n❌ ERRO: TOKEN não encontrado no arquivo .env!\n');
  process.exit(1);
}

function displayBanner() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', `
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ██████╗                   ║
║   ██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗                  ║
║   ██║  ██║██║███████╗██║     ██║   ██║██████╔╝██║  ██║                  ║
║   ██║  ██║██║╚════██║██║     ██║   ██║██╔══██╗██║  ██║                  ║
║   ██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║██████╔╝                  ║
║   ╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝                   ║
║                                                                           ║
║              ██████╗  ██████╗ ████████╗    ██╗   ██╗██████╗              ║
║              ██╔══██╗██╔═══██╗╚══██╔══╝    ██║   ██║╚════██╗             ║
║              ██████╔╝██║   ██║   ██║       ██║   ██║ █████╔╝             ║
║              ██╔══██╗██║   ██║   ██║       ╚██╗ ██╔╝ ╚═══██╗             ║
║              ██████╔╝╚██████╔╝   ██║        ╚████╔╝ ██████╔╝             ║
║              ╚═════╝  ╚═════╝    ╚═╝         ╚═══╝  ╚═════╝              ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  🎯 Sistema Profissional de Gerenciamento Discord                        ║
║  👨‍💻 Desenvolvedor: mirandadeveloper                                      ║
║  💬 Discord: mirandadeveloper                                            ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

client.commands = new Collection();
client.tickets = new Collection();
const fivemTimers = new Collection();
const GUILD_ID = process.env.GUILD_ID;

function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  
  function readCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        readCommands(filePath);
      } else if (file.endsWith('.js')) {
        try {
          delete require.cache[require.resolve(filePath)];
          const command = require(filePath);

          if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
          } else {
            logger.consoleLog('error', `⚠️ Comando em ${filePath} não tem "data" ou "execute" e foi ignorado.`);
          }
        } catch (error) {
          logger.consoleLog('error', `❌ Falha ao carregar o comando ${filePath}: ${error.message}`);
          console.error(error);
        }
      }
    }
  }

  if (fs.existsSync(commandsPath)) readCommands(commandsPath);
  return commands;
}

function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    try {
      const filePath = path.join(eventsPath, file);
      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    } catch (error) {
      logger.consoleLog('error', `❌ Falha ao carregar o evento ${file}: ${error.message}`);
      console.error(error);
    }
  }
}

async function registerCommands(commands) {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    }
    logger.consoleLog('success', `📤 ${commands.length} comando(s) registrado(s) no Discord com sucesso.`);
  } catch (error) {
    logger.consoleLog('error', `❌ Falha ao registrar comandos no Discord: ${error.message}`);
    console.error(error);
  }
}

function updatePresence() {
  const totalGuilds = client.guilds.cache.size;
  const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

  client.user.setPresence({
    activities: [{
      name: `${totalGuilds} servidores | ${totalUsers} usuários`,
      type: ActivityType.Watching
    }],
    status: 'online'
  });
}

async function startFiveMUpdateLoop(client) {
  const configs = getAllFiveMConfigs();
  for (const config of configs) {
    if (!config.guild_id) continue;
    if (fivemTimers.has(config.guild_id)) clearInterval(fivemTimers.get(config.guild_id));
    await updateFiveMStatus(client, config);
    const timer = setInterval(() => updateFiveMStatus(client, config), config.interval);
    fivemTimers.set(config.guild_id, timer);
  }
}

async function initialize() {
  try {
    displayBanner();
    _v();
    initializeDatabase();
    setRatingPanelHandler(ratingPanelHandler);
    const commands = loadCommands();
    loadEvents();
    await client.login(process.env.TOKEN);
    await new Promise(resolve => client.once('clientReady', resolve));
    ratingPanelHandler.setClient(client);
    await registerCommands(commands);
    updatePresence();
    setInterval(updatePresence, 60000);
    
    // IA Jarvis: Evolução e Aprendizado
    const learningModule = require('./utils/learningModule');
    learningModule.evolve(client);
    setInterval(() => learningModule.evolve(client), 24 * 60 * 60 * 1000); // Evolução diária

    startFiveMUpdateLoop(client);
    startPanelUpdaterLoop(client);
    startStaffPanelUpdaterLoop(client);
    startRatingPanelUpdaterLoop(client);

    console.log('\x1b[32m%s\x1b[0m', `✅ System Online | Dev: ${_g()}`);
    // await _i(client);

  } catch (error) {
    process.exit(1);
  }
}

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => process.exit(1));

// client.on('guildCreate', async (guild) => await _j(guild, client));
// client.on('guildDelete', async (guild) => await _l(guild, client));

initialize();
module.exports.startFiveMUpdateLoop = startFiveMUpdateLoop;
