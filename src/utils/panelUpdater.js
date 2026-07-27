const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
    getTicketConfig, 
    getTicketCategories, 
    getWhitelistConfig, 
    getTotalApprovedWhitelists,
    getTotalPendingWhitelists,
    getTotalOpenTickets,
    getTotalClosedTickets,
    saveTicketConfig,
    saveWhitelistConfig,
    getAIPanelConfig,
    saveAIPanelConfig
} = require('./database');
const logger = require('./system-logs');

// Mapa para armazenar os timers e evitar duplicação
const panelTimers = new Map();

/**
 * Cria o Embed do Painel de Tickets com Select Menu
 */
function createTicketPanelEmbed(guildId, categories, stats, onlineUsers = 0, bannerUrl = null) {
    const description = 
        `Seja bem-vindo(a) ao sistema de atendimento. Utilize o menu abaixo para selecionar o tipo de suporte desejado.\n\n` +
        `**Estatísticas do Servidor:**\n` +
        `> Membros Online: **${onlineUsers}**\n` +
        `> Tickets Abertos Atualmente: **${stats.openTickets}**\n` +
        `> Total de Tickets Atendidos: **${stats.closedTickets}**\n` +
        `> Total de Tickets Atendidos (Global): **${stats.globalClosedTickets}**\n` +
        `\nSelecione uma opção no menu para abrir seu ticket:`;

    const embed = new EmbedBuilder()
        .setTitle('🎫 Central de Atendimento ao Usuário')
        .setDescription(description)
        .setColor(0x3498db)
        .setImage(bannerUrl || null) 
        .setFooter({ text: 'Estatísticas atualizadas a cada 1 minuto.' })
        .setTimestamp();

    return embed;
}

/**
 * Cria o Embed do Painel de Whitelist
 */
function createWhitelistPanelEmbed(guildId, categories, stats, onlineUsers = 0, bannerUrl = null) {
    const description = 
        `Clique no botão abaixo para iniciar o processo de Whitelist e fazer parte da nossa comunidade Roleplay.\n\n` +
        `**Estatísticas da Whitelist:**\n` +
        `> Membros Online: **${onlineUsers}**\n` +
        `> Whitelists Abertas (Pendentes): **${stats.pendingWhitelists}**\n` +
        `> Whitelists Aprovadas Total: **${stats.approvedWhitelists}**\n` +
        `\n**Status:** Ativa. Clique para iniciar.`;

    const embed = new EmbedBuilder()
        .setTitle('✅ Processo de Whitelist RP')
        .setDescription(description)
        .setColor(0x2ecc71) 
        .setImage(bannerUrl || null) 
        .setFooter({ text: 'Estatísticas atualizadas a cada 1 minuto.' })
        .setTimestamp();

    return embed;
}

/**
 * Cria o Embed do Painel de IA de Atendimento Unificado
 */
function createAIPanelEmbed(guildId, stats, onlineUsers = 0, bannerUrl = null) {
    const description = 
        `Bem-vindo à nossa **Central de Atendimento Inteligente**!\n\n` +
        `Aqui você pode resolver todas as suas necessidades de forma rápida e inteligente. ` +
        `Nossa IA está pronta para guiar você pelo melhor caminho, seja para suporte, compras ou whitelist.\n\n` +
        `**Estatísticas em Tempo Real:**\n` +
        `> Membros Online: **${onlineUsers}**\n` +
        `> Tickets Ativos: **${stats.openTickets}**\n` +
        `> Whitelists Pendentes: **${stats.pendingWhitelists}**\n` +
        `> Atendimentos Concluídos: **${stats.closedTickets}**\n\n` +
        `**Como funciona?**\n` +
        `1. Clique no botão **"🤖 Iniciar Atendimento"** abaixo.\n` +
        `2. Nossa IA dará as boas-vindas e perguntará o que você precisa.\n` +
        `3. Escolha a opção desejada e siga as instruções.\n\n` +
        `---`;

    const embed = new EmbedBuilder()
        .setTitle('🤖 Assistente Jarvis - Central Unificada')
        .setDescription(description)
        .setColor(0x00AE86)
        .setImage(bannerUrl || null) 
        .setFooter({ text: 'Sistema de IA | Estatísticas atualizadas a cada 1 minuto.' })
        .setTimestamp();

    return embed;
}

/**
 * Função principal para buscar dados e atualizar o painel
 */
async function updatePanel(client, guildId, type) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    let config, channelId, messageId, createEmbedFunc, bannerUrl;
    let stats = {};
    let categories = [];
    
    const onlineUsers = guild.members.cache.filter(m => 
        m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle'
    ).size;
    
    try {
        if (type === 'ticket') {
            config = getTicketConfig(guildId);
            categories = getTicketCategories(guildId);
            stats.openTickets = getTotalOpenTickets(guildId);
            stats.closedTickets = getTotalClosedTickets(guildId);
            
            const { getTotalTicketsAtendidosGlobal } = require('./database');
            stats.globalClosedTickets = getTotalTicketsAtendidosGlobal();

            channelId = config?.panel_channel_id;
            messageId = config?.panel_message_id; 
            bannerUrl = config?.banner_url;
            createEmbedFunc = createTicketPanelEmbed;
        } else if (type === 'whitelist') {
            config = getWhitelistConfig(guildId);
            stats.approvedWhitelists = getTotalApprovedWhitelists(guildId);
            stats.pendingWhitelists = getTotalPendingWhitelists(guildId);
            channelId = config?.panel_channel_id;
            messageId = config?.panel_message_id; 
            bannerUrl = config?.banner_url;
            createEmbedFunc = createWhitelistPanelEmbed;
        } else if (type === 'ai') {
            config = getAIPanelConfig(guildId);
            stats.openTickets = getTotalOpenTickets(guildId);
            stats.closedTickets = getTotalClosedTickets(guildId);
            stats.pendingWhitelists = getTotalPendingWhitelists(guildId);
            channelId = config?.channel_id;
            messageId = config?.message_id;
            bannerUrl = config?.banner_url;
            createEmbedFunc = (gid, cats, st, ou, bu) => createAIPanelEmbed(gid, st, ou, bu);
        } else {
            return;
        }

        if (!config || !channelId || !messageId) {
            return; 
        }
        
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
             if (type === 'ticket') {
                 saveTicketConfig(guildId, { panel_message_id: null });
             } else if (type === 'whitelist') {
                 saveWhitelistConfig(guildId, { panel_message_id: null });
             } else if (type === 'ai') {
                 saveAIPanelConfig(guildId, { message_id: null });
             }
             logger.consoleLog('warn', `Painel ${type} em ${guild.name} não encontrado. Removendo ID da config.`);
             return;
        }

        const newEmbed = createEmbedFunc(guildId, categories, stats, onlineUsers, bannerUrl);
        
        await message.edit({ embeds: [newEmbed], components: message.components }).catch(e => {
            logger.consoleLog('error', `Erro ao editar painel ${type} em ${guild.name}: ${e.message}`);
        });

    } catch (error) {
        logger.consoleLog('error', `Erro crítico na atualização do painel ${type} em ${guild.name}: ${error.message}`);
    }
}

/**
 * Inicia o loop de atualização de painéis
 */
async function startPanelUpdaterLoop(client, interval = 60000) { 
    panelTimers.forEach(clearInterval);
    panelTimers.clear();

    const guildIds = client.guilds.cache.map(guild => guild.id);

    for (const guildId of guildIds) {
        const ticketConfig = getTicketConfig(guildId);
        const wlConfig = getWhitelistConfig(guildId);
        const aiConfig = getAIPanelConfig(guildId);
        
        if (ticketConfig?.panel_message_id || wlConfig?.panel_message_id || aiConfig?.message_id) {
            const timer = setInterval(() => {
                const currentTicketConfig = getTicketConfig(guildId);
                const currentWlConfig = getWhitelistConfig(guildId);
                const currentAIConfig = getAIPanelConfig(guildId);

                if (currentTicketConfig?.panel_message_id) updatePanel(client, guildId, 'ticket');
                if (currentWlConfig?.panel_message_id) updatePanel(client, guildId, 'whitelist');
                if (currentAIConfig?.message_id) updatePanel(client, guildId, 'ai');
            }, interval);
            
            panelTimers.set(guildId, timer);

            if (ticketConfig?.panel_message_id) updatePanel(client, guildId, 'ticket');
            if (wlConfig?.panel_message_id) updatePanel(client, guildId, 'whitelist');
            if (aiConfig?.message_id) updatePanel(client, guildId, 'ai');
        }
    }
    
    logger.consoleLog('info', `Loop de atualização de painéis iniciado para ${panelTimers.size} servidores.`);
}

module.exports = {
    startPanelUpdaterLoop,
    updatePanel, 
    createTicketPanelEmbed, 
    createWhitelistPanelEmbed,
    createAIPanelEmbed
};
