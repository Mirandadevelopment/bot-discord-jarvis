const { EmbedBuilder } = require('discord.js');
const { getWelcomeConfig } = require('../utils/database');
const logger = require('../utils/system-logs');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      await sendWelcomeMessage(member, client);
    } catch (error) {
      logger.consoleLog('error', `Erro ao enviar mensagem de boas-vindas: ${error.message}`);
      console.error(error);
    }
  }
};

/**
 * Envia mensagem de boas-vindas personalizada
 */
async function sendWelcomeMessage(member, client) {
  const config = getWelcomeConfig(member.guild.id);

  if (!config || !config.enabled) {
    return;
  }

  const channel = await member.guild.channels.fetch(config.channel_id).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    logger.consoleLog('warning', `Canal de boas-vindas não encontrado: ${member.guild.name}`);
    return;
  }

  // Atribui cargo se configurado
  if (config.role_id) {
    try {
      const role = member.guild.roles.cache.get(config.role_id);
      if (role) {
        await member.roles.add(role);
        logger.consoleLog('info', `Cargo ${role.name} atribuído a ${member.user.tag} em ${member.guild.name}`);
      } else {
        logger.consoleLog('warning', `Cargo configurado (${config.role_id}) não encontrado em ${member.guild.name}`);
      }
    } catch (error) {
      logger.consoleLog('error', `Erro ao atribuir cargo de boas-vindas a ${member.user.tag}: ${error.message}`);
      console.error(error);
    }
  }

  // Substitui variáveis na mensagem
  let message = config.message
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{membercount}/g, member.guild.memberCount.toString());

  // Cria embed
  const embed = new EmbedBuilder()
    .setTitle('📥 Novo Membro!')
    .setDescription(message)
    .setColor(0x2ecc71)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `Membro #${member.guild.memberCount}` })
    .setTimestamp();

  // Adiciona banner se configurado
  if (config.banner_url) {
    embed.setImage(config.banner_url);
  }

  await channel.send({ embeds: [embed] });

  logger.consoleLog('info', `Mensagem de boas-vindas enviada para ${member.user.tag} em ${member.guild.name}`);
}

module.exports.sendWelcomeMessage = sendWelcomeMessage;
