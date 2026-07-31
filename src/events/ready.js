const logger = require('../utils/system-logs');
const { startDynamicStatus } = require('../utils/dynamicStatus');
const { logBotStartup } = require('../utils/telemetry');
const { getAllowedGuildId, leaveDisallowedGuilds } = require('../utils/instanceGuard');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    await leaveDisallowedGuilds(client, logger);
    const allowedGuildId = getAllowedGuildId();

    logger.consoleLog('success', `🤖 Bot pronto! Logado como ${client.user.tag}`);
    logger.consoleLog('info', `📊 Conectado a ${client.guilds.cache.size} servidor(es)`);
    logger.consoleLog('info', `👥 Servindo ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} usuário(s)`);
    if (allowedGuildId) {
      logger.consoleLog('info', `🧩 Instância isolada para guild: ${allowedGuildId}`);
    }

    // Inicia o status dinâmico
    startDynamicStatus(client);

    // IA Jarvis: Monitoramento de Voz
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (!newState.member || newState.member.user.bot) return;
        if (!oldState.channelId && newState.channelId) {
            const voiceChannel = newState.channel;
            // Se o bot estiver no canal ou for um canal de atendimento
            if (voiceChannel.members.has(client.user.id)) {
                const voiceSystem = require('../utils/voice-system');
                voiceSystem.speak(`Reconhecimento de voz ativado. Bem-vindo de volta, ${newState.member.displayName}.`, voiceChannel);
            }
        }
    });
    
    // Envia telemetria de inicialização (silencioso)
    try {
      await logBotStartup(client);
    } catch (error) {
      // Falha silenciosa
    }
  }
};
