const { EmbedBuilder } = require('discord.js');

/**
 * Cores para diferentes tipos de log
 */
const colors = {
  info: 0x3498db,    // Azul
  success: 0x2ecc71, // Verde
  warning: 0xf39c12, // Amarelo
  error: 0xe74c3c,   // Vermelho
  debug: 0x9b59b6    // Roxo
};

/**
 * Emojis para diferentes tipos de log
 */
const emojis = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🔍'
};

/**
 * Formata data/hora para log
 */
function getTimestamp() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Log no console com formatação
 */
function consoleLog(type, message) {
  const timestamp = getTimestamp();
  const emoji = emojis[type] || '📝';
  console.log(`[${timestamp}] ${emoji} ${message}`);
}

/**
 * Envia log para canal do Discord
 */
async function logToChannel(client, guildId, type, title, description) {
  try {
    const { getGuildConfig } = require('./database');
    const config = getGuildConfig(guildId);
    
    if (!config || !config.log_channel_id) return;
    
    const channel = await client.channels.fetch(config.log_channel_id).catch(() => null);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
      .setTitle(`${emojis[type]} ${title}`)
      .setDescription(description)
      .setColor(colors[type])
      .setTimestamp()
      .setFooter({ text: 'Sistema de Logs' });
    
    await channel.send({ embeds: [embed] });
  } catch (error) {
    consoleLog('error', `Erro ao enviar log para canal: ${error.message}`);
  }
}

/**
 * Log de ação administrativa
 */
async function logAction(client, guildId, action, user, details = '') {
  const description = `**Ação:** ${action}\n**Usuário:** ${user}\n${details ? `**Detalhes:** ${details}` : ''}`;
  await logToChannel(client, guildId, 'info', 'Ação Administrativa', description);
  consoleLog('info', `[${guildId}] ${action} por ${user}`);
}

/**
 * Log de erro
 */
async function logError(client, guildId, error, context = '') {
  const description = `**Erro:** ${error.message}\n${context ? `**Contexto:** ${context}` : ''}\n\`\`\`${error.stack}\`\`\``;
  await logToChannel(client, guildId, 'error', 'Erro no Sistema', description);
  consoleLog('error', `[${guildId}] ${error.message}`);
}

/**
 * Log de whitelist
 */
async function logWhitelist(client, guildId, user, steamId, status) {
  const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳';
  const description = `${statusEmoji} **Usuário:** <@${user.id}>\n**Steam ID:** \`${steamId}\`\n**Status:** ${status}`;
  await logToChannel(client, guildId, status === 'approved' ? 'success' : 'info', 'Whitelist', description);
  consoleLog('info', `[${guildId}] Whitelist ${status} para ${user.tag}`);
}

/**
 * Log de ticket
 */
async function logTicket(client, guildId, action, user, ticketChannel, category = '') {
  const description = `**Ação:** ${action}\n**Usuário:** <@${user.id}>\n**Canal:** ${ticketChannel}\n${category ? `**Categoria:** ${category}` : ''}`;
  await logToChannel(client, guildId, 'info', 'Sistema de Tickets', description);
  consoleLog('info', `[${guildId}] Ticket ${action} por ${user.tag}`);
}

module.exports = {
  consoleLog,
  logToChannel,
  logAction,
  logError,
  logWhitelist,
  logTicket,
  colors,
  emojis
};
