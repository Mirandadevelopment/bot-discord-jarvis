const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getTicketConfig, getTicketCategories, saveTicketConfig, getTotalOpenTickets, getTotalClosedTickets } = require('../../utils/database');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');
// ✨ NOVO: Importa funções do novo módulo
const { createTicketPanelEmbed, updatePanel } = require('../../utils/panelUpdater'); 


// Função NOVO: Envia painel central com Select Menu
/**
 * Envia um painel central usando Select Menu com todas as categorias
 * Retorna o ID da mensagem enviada.
 */
async function sendCentralPanel(interaction, channel, categories, config) {
    
    // Obtém estatísticas iniciais
    const stats = {
        openTickets: getTotalOpenTickets(interaction.guildId),
        closedTickets: getTotalClosedTickets(interaction.guildId)
    };
    
    // 1. Gera o Embed usando a função do panelUpdater (inclui stats)
    const embed = createTicketPanelEmbed(
        interaction.guildId, 
        categories, 
        stats, 
        interaction.guild.memberCount, // Usamos o total de membros no lugar de 'online' na primeira vez para ser mais rápido
        config.banner_url
    );

    // 2. Criar as opções do Select Menu
    const selectOptions = categories.map(category => ({
        label: category.name,
        description: category.description.length > 50 ? category.description.substring(0, 47) + '...' : category.description,
        value: category.name.toLowerCase().replace(/\s/g, '_'), 
        emoji: category.emoji
    }));

    // 3. Criar o Select Menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_open') 
        .setPlaceholder('Selecione uma categoria')
        .addOptions(selectOptions);

    // 4. Criar a Action Row
    const row = new ActionRowBuilder().addComponents(selectMenu);

    const message = await channel.send({
        embeds: [embed],
        components: [row]
    });
    
    // 5. Salva o ID da mensagem no DB
    saveTicketConfig(interaction.guildId, { 
        panel_channel_id: channel.id, 
        panel_message_id: message.id 
    });
    
    // 6. Atualiza o painel imediatamente para garantir o onlineUsers correto
    // Opcional, mas garante que os dados estejam 100% no momento do envio.
    updatePanel(interaction.client, interaction.guildId, 'ticket');

    return message.id;
}


// Função Antiga: Envia painel individual (mantida)
/**
 * Envia painel individual de uma categoria
 */
async function sendCategoryPanel(channel, category, bannerUrl = null) {
    const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name}`)
        .setDescription(category.description)
        .setColor(0x3498db)
        .setFooter({ text: 'Clique no botão abaixo para abrir um ticket' })
        .setTimestamp();

    if (bannerUrl) {
        embed.setImage(bannerUrl);
    }

    const button = new ButtonBuilder()
        .setCustomId(`ticket_open_${category.name.toLowerCase().replace(/\s/g, '_')}`)
        .setLabel('Abrir Ticket')
        .setEmoji(category.emoji)
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({
        embeds: [embed],
        components: [row]
    });
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Enviar painel de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('categoria')
                .setDescription('Categoria específica (deixe vazio para enviar o painel central)')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addChannelOption(option =>
            option
                .setName('canal')
                .setDescription('Canal onde enviar o painel (usa o configurado se não especificado)')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        try {
            const categories = getTicketCategories(interaction.guildId);
            
            if (!categories || categories.length === 0) {
                return await interaction.respond([{
                    name: 'Nenhuma categoria configurada',
                    value: 'none'
                }]);
            }
            
            const focusedValue = interaction.options.getFocused().toLowerCase();
            
            const filtered = categories.filter(cat => 
                cat.name.toLowerCase().includes(focusedValue)
            );

            await interaction.respond(
                filtered.map(cat => ({ name: cat.name, value: cat.name }))
            );
        } catch (error) {
            await interaction.respond([{ name: 'Erro ao buscar categorias', value: 'error' }]);
        }
    },


    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const config = getTicketConfig(interaction.guildId);
            if (!config || !config.panel_channel_id) {
                return await interaction.editReply({
                    embeds: [errorEmbed('Erro', 'Sistema de tickets não configurado. Use `/ticket setup` primeiro.')],
                    ephemeral: true
                });
            }

            const categories = getTicketCategories(interaction.guildId);
            if (categories.length === 0) {
                return await interaction.editReply({
                    embeds: [errorEmbed('Erro', 'Nenhuma categoria configurada. Use `/ticket-category add` para adicionar categorias.')],
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('canal') || 
                                    await interaction.guild.channels.fetch(config.panel_channel_id).catch(() => null);

            if (!targetChannel || !targetChannel.isTextBased()) {
                return await interaction.editReply({
                    embeds: [errorEmbed('Erro', 'Canal não encontrado ou inválido.')],
                    ephemeral: true
                });
            }

            const specificCategory = interaction.options.getString('categoria');

            if (specificCategory && (specificCategory === 'none' || specificCategory === 'error')) {
                return await interaction.editReply({
                    embeds: [errorEmbed('Erro', 'Nenhuma categoria configurada. Use `/ticket-category add` para adicionar categorias.')],
                    ephemeral: true
                });
            }

            if (specificCategory) {
                // Comportamento Antigo (Painel de Botão Individual)
                const category = categories.find(cat => cat.name === specificCategory);
                
                if (!category) {
                    return await interaction.editReply({
                        embeds: [errorEmbed('Erro', 'Categoria não encontrada.')],
                        ephemeral: true
                    });
                }

                await sendCategoryPanel(targetChannel, category, config.banner_url);

                await interaction.editReply({
                    embeds: [successEmbed('Painel Enviado', `Painel da categoria **${category.name}** enviado em ${targetChannel} (Botão)!`)],
                    ephemeral: true
                });

                logger.logAction(
                    client,
                    interaction.guildId,
                    'Ticket Panel Sent',
                    interaction.user.tag,
                    `Canal: ${targetChannel.name}, Categoria: ${category.name}`
                );

            } else {
                // ✨ NOVO Comportamento (Painel Central com Select Menu) - Salva o ID da mensagem
                const messageId = await sendCentralPanel(interaction, targetChannel, categories, config);
                
                await interaction.editReply({
                    embeds: [successEmbed('Painel Central Enviado', `Painel de tickets com Menu de Seleção enviado em ${targetChannel}! O painel será atualizado automaticamente a cada minuto.`)],
                    ephemeral: true
                });
                
                logger.logAction(
                    client,
                    interaction.guildId,
                    'Central Ticket Panel Sent',
                    interaction.user.tag,
                    `Canal: ${targetChannel.name}, Tipo: Select Menu, Msg ID: ${messageId}`
                );
            }

        } catch (error) {
            logger.consoleLog('error', `Erro no comando ticket panel: ${error.message}`);
            console.error(error);
            await interaction.editReply({
                embeds: [errorEmbed('Erro', 'Ocorreu um erro ao enviar o painel.')],
                ephemeral: true
            }).catch(() => {});
        }
    }
};