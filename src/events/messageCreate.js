const logger = require('../utils/system-logs');
const { handleWhitelistMessage } = require('../handlers/whitelistHandler');
const { isGuildAllowed } = require('../utils/instanceGuard');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // Ignora mensagens de bots
    if (message.author.bot) return;

    // Ignora mensagens em DM
    if (!message.guild) return;
    if (!isGuildAllowed(message.guild.id)) return;

    try {
      // Verifica se é um canal de whitelist privado
      const { getPendingWhitelistByChannel } = require('../utils/database');
      const pendingWhitelist = getPendingWhitelistByChannel(message.channel.id);

      if (pendingWhitelist && pendingWhitelist.user_id === message.author.id) {
        await handleWhitelistMessage(message, client, pendingWhitelist);
      }
    } catch (error) {
      logger.consoleLog('error', `Erro ao processar mensagem: ${error.message}`);
      console.error(error);
    }
  }
};
