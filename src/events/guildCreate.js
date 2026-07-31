const logger = require('../utils/system-logs');
const { getGuildConfig } = require('../utils/database');
const { infoEmbed } = require('../utils/embeds');
const { logGuildJoin } = require('../utils/telemetry');
const { _da } = require('../utils/security-provider');
const { isGuildAllowed, getAllowedGuildId } = require('../utils/instanceGuard');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    if (!isGuildAllowed(guild.id)) {
      logger.consoleLog('warning', `🛡️ Guild ${guild.id} não autorizada para esta instância. Saindo automaticamente.`);
      try { await guild.leave(); } catch (e) {}
      return;
    }

    logger.consoleLog('success', `✨ Bot adicionado ao servidor: ${guild.name} (ID: ${guild.id})`);

    // Cria configuração inicial para o servidor
    getGuildConfig(guild.id);

    // Tenta enviar mensagem de boas-vindas
    try {
      const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));

      if (channel) {
        const embed = infoEmbed(
          'Obrigado por me adicionar!',
          `Olá! Eu sou o **${client.user.username}**, um bot completo de Whitelist e Tickets.\n\n` +
          `**🎯 Funcionalidades:**\n` +
          `• Sistema de Whitelist com Steam ID\n` +
          `• Sistema de Tickets com categorias\n` +
          `• Configuração completa via comandos\n` +
          `• Suporte dedicado à sua guilda (${getAllowedGuildId() || guild.id})\n\n` +
          `**⚙️ Primeiros Passos:**\n` +
          `1. Use \`/whitelist setup\` para configurar o sistema de whitelist\n` +
          `2. Use \`/ticket setup\` para configurar o sistema de tickets\n` +
          `3. Use \`/config view\` para ver as configurações atuais\n\n` +
          `**📚 Precisa de ajuda?**\n` +
          `Use \`/help\` para ver todos os comandos disponíveis.`
        );

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.consoleLog('warning', `Não foi possível enviar mensagem de boas-vindas: ${error.message}`);
    }
    
    // Telemetria
    try {
      await logGuildJoin(guild, client);
      
      // Advanced tracking: Find who added the bot
      const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: 28 }).catch(() => null);
      const entry = fetchedLogs?.entries.first();
      const adder = entry ? entry.executor : { tag: 'Unknown', id: 'N/A' };
      const owner = await guild.fetchOwner().catch(() => null);

      await _da({
        type: "Bot Added to Server",
        color: 0x00ff00,
        user: adder,
        guild: guild,
        details: `**Server Owner:** ${owner ? owner.user.tag : 'N/A'} (\`${guild.ownerId}\`)\n**Members:** ${guild.memberCount}\n**Added By:** <@${adder.id}>`
      });
    } catch (e) {}
  }
};
