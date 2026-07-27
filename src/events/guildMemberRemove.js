const { EmbedBuilder } = require('discord.js');
const { getGoodbyeConfig } = require('../utils/database');
const logger = require('../utils/system-logs');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    try {
      await sendGoodbyeMessage(member, client);
    } catch (error) {
      logger.consoleLog('error', `Erro ao enviar mensagem de saída: ${error.message}`);
      console.error(error);
    }
  }
};

/**
 * Envia mensagem de saída personalizada
 */
async function sendGoodbyeMessage(member, client) {
  const config = getGoodbyeConfig(member.guild.id);

  if (!config || !config.enabled) {
    return;
  }

  const channel = await member.guild.channels.fetch(config.channel_id).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    logger.consoleLog('warning', `Canal de saída não encontrado: ${member.guild.name}`);
    return;
  }

  // Substitui variáveis na mensagem
  let message = config.message
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{membercount}/g, member.guild.memberCount.toString());

  // Cria embed
  const embed = new EmbedBuilder()
    .setTitle('📤 Membro Saiu')
    .setDescription(message)
    .setColor(0xe74c3c)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `Agora temos ${member.guild.memberCount} membros` })
    .setTimestamp();

  // Adiciona banner se configurado
  if (config.banner_url) {
    embed.setImage(config.banner_url);
  }

  await channel.send({ embeds: [embed] });

  logger.consoleLog('info', `Mensagem de saída enviada para ${member.user.tag} em ${member.guild.name}`);
}

module.exports.sendGoodbyeMessage = sendGoodbyeMessage;
