const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveAIPanelConfig, getAIPanelConfig } = require('../../utils/database');
const { createAIPanelEmbed } = require('../../utils/panelUpdater');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-setup')
        .setDescription('Configura o painel unificado da IA de Atendimento')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('O canal onde o painel será enviado')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('banner')
                .setDescription('URL da imagem do banner do painel')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        // Garante que existe uma categoria de "Compras" para o exemplo
        const { getTicketCategories, addTicketCategory } = require('../../utils/database');
        const categories = getTicketCategories(interaction.guildId);
        if (!categories.find(c => c.name.toLowerCase() === 'compras')) {
            addTicketCategory(interaction.guildId, 'Compras', 'Dúvidas e problemas relacionados a compras.', '💰');
        }

        const channel = interaction.options.getChannel('canal');
        const bannerUrl = interaction.options.getString('banner');

        if (!channel.isTextBased()) {
            return await interaction.editReply({
                embeds: [errorEmbed('Erro', 'O canal selecionado deve ser um canal de texto.')]
            });
        }

        try {
            const stats = {
                openTickets: 0,
                closedTickets: 0,
                pendingWhitelists: 0
            };

            const embed = createAIPanelEmbed(interaction.guildId, stats, interaction.guild.memberCount, bannerUrl);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_ai_atendimento')
                    .setLabel('Iniciar Atendimento')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🤖')
            );

            const message = await channel.send({
                embeds: [embed],
                components: [row]
            });

            saveAIPanelConfig(interaction.guildId, {
                channel_id: channel.id,
                message_id: message.id,
                banner_url: bannerUrl,
                enabled: 1
            });

            await interaction.editReply({
                embeds: [successEmbed('Configuração Concluída', `O painel unificado da IA foi enviado para ${channel}.`)]
            });

            logger.logAction(client, interaction.guildId, 'AI Panel Setup', interaction.user.tag, `Canal: ${channel.name}`);

        } catch (error) {
            logger.consoleLog('error', `Erro ao configurar painel da IA: ${error.message}`);
            await interaction.editReply({
                embeds: [errorEmbed('Erro', 'Não foi possível enviar o painel. Verifique as permissões do bot.')]
            });
        }
    }
};
