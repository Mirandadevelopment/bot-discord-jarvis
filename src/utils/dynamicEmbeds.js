const { EmbedBuilder } = require('discord.js');
const { getWhitelistConfig } = require('./database');

/**
 * Embed de whitelist iniciada (dinâmico baseado na configuração)
 */
function whitelistStartedEmbedDynamic(user, guildId) {
  const config = getWhitelistConfig(guildId) || {};
  const idType = config.db_id_type || 'numeric';
  
  let instructions = '';
  let exampleFormat = '';
  let footerText = '';
  
  if (idType === 'numeric') {
    instructions = `**Como obter seu ID:**\n1. Conecte no servidor e crie seu personagem (se ainda não tiver)\n2. No jogo, vai abrir uma tela apos criar o personagem, façao seu registro e e copie o seu ID(Ex: \`/id\`)\n3. **Copie apenas o número do seu ID** (Ex: \`2010\`, \`1\`, \`4\`, etc.)\n\n**Envie seu ID de Personagem abaixo:** (Apenas o número)`;
    exampleFormat = 'Apenas o número do ID';
    footerText = 'Formato correto: Apenas números (ex: 2025)';
  } else if (idType === 'steam') {
    instructions = `**Como obter seu  ID:**\n1. entre na cidade, crie seu personagem e ID**\n\n**Envie seu ID abaixo:**`;
    exampleFormat = '2025';
    footerText = 'Formato correto: 2025';
  }
  
  return new EmbedBuilder()
    .setTitle('📝 Whitelist Iniciada')
    .setDescription(`Olá ${user}, bem-vindo ao processo de whitelist!\n\n${instructions}`)
    .setColor(0xf1c40f)
    .setFooter({ text: footerText })
    .setTimestamp();
}

module.exports = {
  whitelistStartedEmbedDynamic
};
