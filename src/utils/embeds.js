const { EmbedBuilder } = require('discord.js');

/**
 * Embed de sucesso
 */
function successEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(0x2ecc71)
    .setTimestamp();
}

/**
 * Embed de erro
 */
function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(0xe74c3c)
    .setTimestamp();
}

/**
 * Embed de informação
 */
function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setColor(0x3498db)
    .setTimestamp();
}

/**
 * Embed de aviso
 */
function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setColor(0xf39c12)
    .setTimestamp();
}

/**
 * Embed de configuração
 */
function configEmbed(guildName, configs) {
  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Configurações - ${guildName}`)
    .setColor(0x3498db)
    .setTimestamp()
    .setFooter({ text: 'Use os comandos de configuração para alterar' });

  for (const [key, value] of Object.entries(configs)) {
    embed.addFields({ name: key, value: value || 'Não configurado', inline: true });
  }

  return embed;
}

/**
 * Embed do painel de whitelist
 */
function whitelistPanelEmbed(stats = null, bannerUrl = null) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Sistema de Whitelist')
    .setDescription('Clique no botão abaixo para iniciar o processo de whitelist.\n\n**Como funciona:**\n1️⃣ Clique em "Iniciar Whitelist"\n2️⃣ Um canal privado será criado para você\n3️⃣ Envie seu ID de Personagem/Sistema (apenas o número)\n4️⃣ Aguarde a aprovação\n5️⃣ Receba seu cargo e acesso!')
    .setColor(0xf1c40f)
    .setFooter({ text: 'Sistema de Whitelist' })
    .setTimestamp();

  if (stats) {
    embed.addFields(
      { name: '👥 Membros no Discord', value: `\`${stats.totalMembers || 0}\``, inline: true },
      { name: '🟢 Membros Online', value: `\`${stats.onlineMembers || 0}\``, inline: true },
      { name: '✅ Whitelists Aprovadas', value: `\`${stats.totalWhitelists || 0}\``, inline: true }
    );
  }

  // Adiciona banner se configurado
  if (bannerUrl) {
    embed.setImage(bannerUrl);
  }

  return embed;
}

/**
 * Embed do painel de tickets
 */
function ticketPanelEmbed(categories) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Sistema de Tickets')
    .setDescription('Selecione uma categoria abaixo para abrir um ticket de suporte.\n\n**Categorias disponíveis:**')
    .setColor(0x3498db)
    .setFooter({ text: 'Sistema de Tickets' })
    .setTimestamp();

  if (categories && categories.length > 0) {
    categories.forEach(cat => {
      embed.addFields({
        name: `${cat.emoji} ${cat.name}`,
        value: cat.description || 'Sem descrição',
        inline: false
      });
    });
  } else {
    embed.setDescription('Nenhuma categoria configurada. Use `/ticket category add` para adicionar categorias.');
  }

  return embed;
}

/**
 * Embed de ticket criado
 */
function ticketCreatedEmbed(user, category) {
  return new EmbedBuilder()
    .setTitle('🎫 Ticket Criado')
    .setDescription(`Olá ${user}, bem-vindo ao seu ticket!\n\n**Categoria:** ${category}\n\nUm membro da staff irá atendê-lo em breve. Por favor, descreva seu problema ou dúvida.`)
    .setColor(0x2ecc71)
    .setFooter({ text: 'Use /ticket close para fechar este ticket' })
    .setTimestamp();
}

/**
 * Embed de whitelist iniciada
 */
function whitelistStartedEmbed(user) {
  return new EmbedBuilder()
    .setTitle('📝 Whitelist Iniciada')
    .setDescription(`Olá ${user}, bem-vindo ao processo de whitelist!\n\n**Como obter seu ID de Personagem/Sistema:**\n1. Conecte no servidor e crie seu personagem (se ainda não tiver)\n2. No jogo, use o comando para ver seu ID único (Ex: \`/id\`, \n3. **Copie apenas o número do seu ID** (Ex: \`2010\`, \`1\`, \`4\`, etc.)\n\n**Envie seu ID de Personagem abaixo:** (Apenas o número)`)
    .setColor(0xf1c40f)
    .setFooter({ text: 'Formato correto: Apenas o número do ID do sistema' })
    .setTimestamp();
}

/**
 * Embed de aprovação de whitelist
 */
// CORREÇÃO: Removido 'steamId' e agora refere-se ao 'systemId' como o ID único do usuário.
function whitelistApprovedEmbed(user, systemId) {
  return new EmbedBuilder()
    .setTitle('✅ Whitelist Aprovada!')
    .setDescription(`Parabéns ${user}! Sua whitelist foi aprovada com sucesso!\n\n**Informações:**\n🆔 **ID do Sistema/Personagem:** \`${systemId}\`\n\nVocê já pode acessar o servidor! Bem-vindo à nossa comunidade! 🎉`)
    .setColor(0x2ecc71)
    .setFooter({ text: 'Divirta-se!' })
    .setTimestamp();
}

/**
 * Embed de rejeição de whitelist
 */
function whitelistRejectedEmbed(reason) {
  return new EmbedBuilder()
    .setTitle('❌ Whitelist Rejeitada')
    .setDescription(`Sua whitelist foi rejeitada.\n\n**Motivo:** ${reason}\n\nPor favor, verifique as informações e tente novamente.`)
    .setColor(0xe74c3c)
    .setFooter({ text: 'Entre em contato com a staff se tiver dúvidas' })
    .setTimestamp();
}

/**
 * Embed de status do FiveM (PAINEL AZUL CLARO ESTILIZADO, COMPACTO E LETRA MAIOR)
 */
function fivemStatusEmbed(statusData, serverName, bannerUrl, updateTime) {
    const { status, players, maxPlayers, connect } = statusData; 
    
    // Cor
    const isOnline = status === 'Online';
    const color = isOnline ? 0x2ecc71 : 0xe74c3c; // Verde para Online, Vermelho para Offline 
    
    // Conteúdo formatado
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
    const playersText = isOnline ? `${players}/${maxPlayers}` : '0/0';
    
    // Garantindo o texto de restart mais compacto (removendo os ` extras)
    const nextRestartContent = isOnline ? 'em 6h 0m 0s' : 'N/A';
    

    const embed = new EmbedBuilder()
        // Define a barra superior imitando o visual da imagem (Nome do Servidor | APP | Data)
        .setAuthor({ 
            name: `${serverName.toUpperCase()} | APP | ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
            iconURL: isOnline ? 'https://i.imgur.com/2X8gXp7.png' : 'https://i.imgur.com/q1W5M7t.png' 
        })
        .setTitle(`**${serverName.toUpperCase()} | CONNECT**`) // Título principal
        .setColor(color)
        .addFields(
            // ----------------------------------------------------
            // CAMPO 1: STATUS (Lado esquerdo)
            { 
                name: `🟢 Status:`, 
                // Usando Heading 3 (###) para a maior fonte DENTRO do bloco de código FIX
                value: `\`\`\`fix\n ${statusText}\n\`\`\``, 
                inline: true 
            },
            // CAMPO 2: JOGADORES ONLINE (Lado direito)
            { 
                name: `👤 Jogadores Online:`, 
                // Usando Heading 3 (###) para a maior fonte DENTRO do bloco de código FIX
                value: `\`\`\`fix\n ${playersText}\n\`\`\``, 
                inline: true 
            },
            // ----------------------------------------------------
            // CAMPO 3: IP CONNECT (Abaixo, na largura total)
            { 
                name: '🌐 IP FiveM:', 
                // Usando Heading 4 (####) no valor do IP
                value: `\`\`\`fix\n ${connect}\n\`\`\``, 
                inline: false 
            },
            // CAMPO 4: PRÓXIMO RESTART
            { 
                name: '⏰ Próximo Restart:', 
                // Usando Heading 4 (####) para o restart
                value: `\`\`\`fix\n ${nextRestartContent}\n\`\`\``, 
                inline: false 
            }
        )
        // Adiciona a imagem de banner
        .setImage(bannerUrl) 
        // Rodapé da imagem
        .setFooter({ text: 'Todos os direitos reservados' })
        
    return embed;
}

module.exports = {
  successEmbed,
  errorEmbed,
  infoEmbed,
  warningEmbed,
  configEmbed,
  whitelistPanelEmbed,
  ticketPanelEmbed,
  ticketCreatedEmbed,
  whitelistStartedEmbed,
  whitelistApprovedEmbed,
  whitelistRejectedEmbed,
  fivemStatusEmbed
};