const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { 
    createAIConversation, 
    getActiveAIConversation, 
    updateAIConversation, 
    closeAIConversation,
    getTicketCategories,
    getTicketConfig,
    getWhitelistConfig,
    saveAILearningData,
    getTopCategories
} = require('../utils/database');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const logger = require('../utils/system-logs');

/**
 * Inicia ou recupera uma conversa com a IA
 */
async function handleAIStart(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    let conversation = getActiveAIConversation(interaction.guildId, interaction.user.id);
    
    if (!conversation) {
        const conversationId = createAIConversation(interaction.guildId, interaction.user.id);
        conversation = { id: conversationId, guild_id: interaction.guildId, user_id: interaction.user.id, current_state: JSON.stringify({ step: 'welcome' }) };
    }

    const state = JSON.parse(conversation.current_state);

    // IA: Rastreia identidade e mudanças de nome
    const { getRecentMemories, addRecentMemory, trackUserIdentity } = require('../utils/database');
    const identity = trackUserIdentity(interaction.user.id, interaction.guildId, interaction.member.displayName);
    
    const memories = getRecentMemories(interaction.user.id, interaction.guildId, 1);
    let personalTouch = "";

    if (identity.changed) {
        personalTouch = `\n\nQue bom ver você novamente, **${identity.current}**! Notei que você mudou seu nome, antes eu o conhecia como **${identity.previous}**. Ficou excelente, combina muito com você!`;
    } else if (!identity.is_new) {
        personalTouch = `\n\nQue bom ver você novamente, **${identity.current}**! É um prazer atendê-lo mais uma vez.`;
    }

    if (memories.length > 0) {
        personalTouch += `\nDa última vez que nos falamos, estávamos tratando de: *${memories[0].interaction_type}*.`;
    }
    
    // Se já estiver em um fluxo, avisa o usuário
    if (state.step !== 'welcome') {
        return await interaction.editReply({
            embeds: [errorEmbed('Atendimento em Curso', 'Você já possui um atendimento iniciado. Por favor, siga as instruções no canal correspondente.')]
        });
    }

    // Apresenta as boas-vindas e opções
    await sendWelcomeMessage(interaction, client, conversation.id);
}

/**
 * Envia a mensagem de boas-vindas com botões de categoria
 */
async function sendWelcomeMessage(interaction, client, conversationId) {
    const categories = getTicketCategories(interaction.guildId);
    const topCategories = getTopCategories(interaction.guildId, 3);
    
    // IA: Busca saudações personalizadas na Base de Conhecimento (HeidiSQL)
    const { getAIKnowledge } = require('../utils/database');
    const helpKnowledge = getAIKnowledge('ajuda');
    const welcomeText = helpKnowledge ? helpKnowledge.response_data : 'Estou aqui para unificar e facilitar o seu atendimento. Como posso ajudar você hoje?';

    // IA: Recupera o toque pessoal gerado no handleAIStart (passado via contexto se necessário, ou recalculado)
    const { trackUserIdentity, getRecentMemories } = require('../utils/database');
    const identity = trackUserIdentity(interaction.user.id, interaction.guildId, interaction.member.displayName);
    const memories = getRecentMemories(interaction.user.id, interaction.guildId, 1);
    
    let personalGreeting = `Olá, **${identity.current}**!`;
    if (identity.changed) {
        personalGreeting += `\nNotei sua mudança de nome (anteriormente **${identity.previous}**), ficou fantástico!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🤖 Protocolo Jarvis - Atendimento de Elite')
        .setDescription(
            `${personalGreeting}\n\n` +
            `*É uma honra tê-lo conosco novamente. Estou processando sua solicitação com prioridade máxima.*\n\n` +
            `${welcomeText}\n\n` +
            (memories.length > 0 ? `*Lembro-me perfeitamente de nossa última interação sobre ${memories[0].interaction_type}. Gostaria de continuar ou iniciar algo novo?*\n\n` : '') +
            `**Em que posso ser útil neste momento? Por favor, selecione uma diretriz:**`
        )
        .setColor(0x00FFFF) // Ciano estilo holograma Jarvis
        .setTimestamp()
        .setFooter({ text: 'IA de Atendimento | Evoluindo sempre para melhor atendê-lo.' });

    if (topCategories.length > 0) {
        const recommended = topCategories.map(c => `• ${c.category_chosen}`).join('\n');
        embed.addFields({ name: '🌟 Recomendações (Mais pedidos)', value: recommended });
    }

    const rows = [];
    let currentRow = new ActionRowBuilder();

    // IA: Adiciona botão de controle de áudio
    const voiceStatusEmoji = identity.voice_enabled === 1 ? '🔊' : '🔇';
    const voiceStatusLabel = identity.voice_enabled === 1 ? 'Silenciar Jarvis' : 'Ativar Voz do Jarvis';
    
    currentRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`ai_toggle_voice_${conversationId}`)
            .setLabel(voiceStatusLabel)
            .setEmoji(voiceStatusEmoji)
            .setStyle(identity.voice_enabled === 1 ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    // Adiciona botão de Whitelist se configurado
    const whitelistConfig = getWhitelistConfig(interaction.guildId);
    if (whitelistConfig && whitelistConfig.category_id) {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`ai_choice_whitelist_${conversationId}`)
                .setLabel('Whitelist')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Primary)
        );
    }

    // Adiciona botões de categorias de ticket
    categories.forEach((cat, index) => {
        if (currentRow.components.length >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
        
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`ai_choice_ticket_${cat.name}_${conversationId}`)
                .setLabel(cat.name)
                .setEmoji(cat.emoji || '🎫')
                .setStyle(ButtonStyle.Secondary)
        );
    });

    if (currentRow.components.length > 0) rows.push(currentRow);

    await interaction.editReply({
        embeds: [embed],
        components: rows
    });

    // IA: Se o usuário estiver em um canal de voz e com áudio ativado, o Jarvis fala com ele
    const voiceChannel = interaction.member.voice.channel;
    if (voiceChannel && identity.voice_enabled === 1) {
        const voiceSystem = require('../utils/voice-system');
        const speechText = `Olá ${identity.current}. ${welcomeText.replace(/<@!?\d+>/g, '')}`;
        await voiceSystem.speak(speechText, voiceChannel);
    }
}

/**
 * Processa a escolha do usuário
 */
async function handleAIChoice(interaction, client) {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // whitelist ou ticket
    const value = parts[3]; // nome da categoria ou ID da conversa
    const conversationId = parts[parts.length - 1];

    await interaction.deferUpdate();

    // Atualiza o estado da conversa
    updateAIConversation(conversationId, { 
        current_state: { step: 'routing', choice: type, value: value }
    });

    // Registra dados de aprendizado
    saveAILearningData({
        guild_id: interaction.guildId,
        conversation_id: conversationId,
        category_chosen: type === 'whitelist' ? 'Whitelist' : value,
        resolution_status: 'routing'
    });

    // IA: Adiciona memória recente (Cérebro)
    const { addRecentMemory } = require('../utils/database');
    addRecentMemory(interaction.user.id, interaction.guildId, type === 'whitelist' ? 'Whitelist' : `Ticket (${value})`, `O usuário escolheu a categoria ${value || type}.`);

    if (type === 'whitelist') {
        // Redireciona para o handler de whitelist (precisamos adaptar o handler para aceitar o redirecionamento)
        const { handleWhitelistButton } = require('./whitelistHandler');
        await handleWhitelistButton(interaction, client, true);
    } else if (type === 'ticket') {
        // Redireciona para o handler de ticket
        const { handleTicketOpen } = require('./ticketHandler');
        await handleTicketOpen(interaction, client, value, true);
    }
}

module.exports = {
    handleAIStart,
    handleAIChoice
};

/**
 * Alterna a preferência de voz do usuário
 */
async function handleAIVoiceToggle(interaction, client) {
    const { toggleUserVoice } = require('../utils/database');
    const newState = toggleUserVoice(interaction.user.id, interaction.guildId);
    
    const parts = interaction.customId.split('_');
    const conversationId = parts[parts.length - 1];

    await interaction.deferUpdate();
    
    // Recarrega a mensagem de boas-vindas com o novo estado do botão
    await sendWelcomeMessage(interaction, client, conversationId);
}

module.exports = {
    ...module.exports,
    handleAIVoiceToggle
};
