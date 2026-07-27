const { EmbedBuilder } = require('discord.js');
const { getRatingPanelConfig, getRatingStats, saveRatingPanelConfig, getAllRatingConfigs } = require('../utils/database');
const logger = require('../utils/system-logs');

// Variável para armazenar o objeto client
let botClient; 

// Função para setar o client
function setClient(client) {
    botClient = client;
}

// Função auxiliar para criar o Embed
function createRatingPanelEmbed(stats, guildName) {
    const average = stats.average ? stats.average.toFixed(2) : '0.00';
    // Repetir a estrela, arredondando a média
    const stars = '⭐'.repeat(Math.round(stats.average || 0)); 
    
    // Verifica se há avaliações para definir a cor
    const color = stats.total > 0 ? 0x2ecc71 : 0x7f8c8d; // Verde ou Cinza

    const embed = new EmbedBuilder()
        .setTitle('📊 Painel de Estatísticas de Avaliações')
        .setColor(color) 
        .setDescription(`Estatísticas do servidor **${guildName}** atualizadas em tempo real.`)
        .addFields(
            { 
                name: `Média Geral: ${stars}`, 
                // USANDO O BLOCO DE CÓDIGO FIX CORRETO:
                value: `\`\`\`fix\n${average}\n\`\`\``, 
                inline: true 
            },
            { 
                name: 'Total de Feedbacks', 
                // USANDO O BLOCO DE CÓDIGO FIX CORRETO:
                value: `\`\`\`fix\n${stats.total}\n\`\`\``, 
                inline: true 
            },
            { name: '\u200b', value: '\u200b', inline: true }, // Campo Vazio
            
            // Destaque nas contagens de estrelas
            { name: '⭐⭐⭐⭐⭐ (Ótimo)', value: `\`\`\`fix\n${stats.five_stars || 0}\n\`\`\``, inline: true },
            { name: '⭐⭐⭐⭐ (Muito Bom)', value: `\`\`\`fix\n${stats.four_stars || 0}\n\`\`\``, inline: true },
            { name: '⭐⭐⭐ (Bom)', value: `\`\`\`fix\n${stats.three_stars || 0}\n\`\`\``, inline: true },
            { name: '⭐⭐ (Regular)', value: `\`\`\`fix\n${stats.two_stars || 0}\n\`\`\``, inline: true },
            { name: '⭐ (Ruim)', value: `\`\`\`fix\n${stats.one_star || 0}\n\`\`\``, inline: true },
            
            { name: '\u200b', value: '\u200b', inline: true }
        )
        .setFooter({ text: `Última atualização:` })
        .setTimestamp();
        
    return embed;
}

/**
 * Função principal para atualizar o painel de avaliações em um servidor.
 */
async function updateRatingPanel(guildId) { 
    const client = botClient;
    if (!client) {
        logger.consoleLog('error', 'Bot client não está definido no Rating Panel Handler.');
        return;
    }

    const config = getRatingPanelConfig(guildId);
    
    if (!config || config.enabled === 0 || !config.channel_id || !config.message_id) {
        return;
    }

    try {
        const stats = getRatingStats(guildId);
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return logger.consoleLog('error', `Servidor ${guildId} não encontrado no cache para atualização do painel.`);

        const channel = guild.channels.cache.get(config.channel_id);
        if (!channel) {
            logger.consoleLog('warn', `Canal ${config.channel_id} não encontrado. Desabilitando painel de avaliações para ${guild.name}.`);
            saveRatingPanelConfig(guildId, { enabled: 0, channel_id: null, message_id: null });
            return;
        }

        const embed = createRatingPanelEmbed(stats, guild.name);
        
        let message;
        try {
            message = await channel.messages.fetch(config.message_id);
        } catch (e) {
            logger.consoleLog('warn', `Mensagem do Painel de Avaliações ${config.message_id} não encontrada em ${channel.name}. Enviando uma nova.`);
            message = await channel.send({ embeds: [embed] });

            saveRatingPanelConfig(guildId, { message_id: message.id });
            return;
        }

        await message.edit({ embeds: [embed] });

        logger.consoleLog('info', `Painel de Avaliações atualizado com sucesso no servidor ${guild.name}.`);

    } catch (error) {
        logger.consoleLog('error', `Erro ao atualizar Painel de Avaliações para ${guildId}: ${error.message}`);
        console.error(error);
    }
}

// -----------------------------------------------------
// FUNÇÃO USADA NO COMANDO (PARA CRIAR O PAINEL INICIAL)
// -----------------------------------------------------

/**
 * Cria o painel de avaliações pela primeira vez (chamado no comando de setup).
 */
async function createInitialRatingPanel(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const stats = getRatingStats(guildId);
    const embed = createRatingPanelEmbed(stats, interaction.guild.name);
    
    try {
        const message = await interaction.channel.send({ embeds: [embed] });

        // Salva a configuração no DB
        saveRatingPanelConfig(guildId, {
            channel_id: interaction.channelId,
            message_id: message.id,
            enabled: 1
        });

        await interaction.editReply({ 
            content: `✅ Painel de Avaliações criado com sucesso em ${interaction.channel}! Ele será atualizado automaticamente ao receber novos feedbacks.`, 
            ephemeral: true 
        });

    } catch (error) {
        logger.consoleLog('error', `Erro ao criar Painel de Avaliações para ${guildId}: ${error.message}`);
        await interaction.editReply({ content: '❌ Erro ao criar o painel. Verifique se o bot tem permissão para enviar embeds neste canal.', ephemeral: true });
    }
}


/**
 * Inicia o loop de atualização automática do painel de avaliações.
 * @param {Client} client O cliente do Discord.js.
 */
function startRatingPanelUpdaterLoop(client) {
    setClient(client);
    
    // Executa a primeira atualização imediatamente
    const configs = getAllRatingConfigs();
    configs.forEach(config => {
        if (config.enabled && config.channel_id && config.message_id) {
            updateRatingPanel(config.guild_id);
        }
    });

    // Configura o loop de 1 minuto
    setInterval(() => {
        const allConfigs = getAllRatingConfigs();
        allConfigs.forEach(config => {
            if (config.enabled && config.channel_id && config.message_id) {
                updateRatingPanel(config.guild_id);
            }
        });
    }, 60000);

    logger.consoleLog('info', 'Loop de atualização do painel de avaliações iniciado (1 minuto).');
}

module.exports = {
    setClient, 
    updateRatingPanel,
    createInitialRatingPanel,
    createRatingPanelEmbed,
    startRatingPanelUpdaterLoop
};