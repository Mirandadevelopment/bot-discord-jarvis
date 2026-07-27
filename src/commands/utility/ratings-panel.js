const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getRatingPanelConfig, saveRatingPanelConfig, getRatingStats } = require('../../utils/database');
const { createInitialRatingPanel } = require('../../handlers/ratingPanelHandler'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ratings-panel')
        .setDescription('Gerencia o painel de estatísticas de avaliações de tickets.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Cria e configura o painel de avaliações neste canal.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Desabilita o painel de avaliações.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Força a atualização imediata do painel de avaliações.')
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        let config = getRatingPanelConfig(guildId);

        if (subcommand === 'setup') {
            // Verifica se o painel já existe
            if (config && config.enabled === 1) {
                return interaction.reply({ 
                    content: `⚠️ O painel de avaliações já está ativo em <#${config.channel_id}>. Use \`/ratings-panel disable\` para desabilitar antes de criar um novo.`, 
                    ephemeral: true 
                });
            }

            // Chama a função do handler para criar e enviar a mensagem inicial
            await createInitialRatingPanel(interaction);

        } else if (subcommand === 'disable') {
            if (!config || config.enabled === 0) {
                return interaction.reply({ 
                    content: '⚠️ O painel de avaliações já está desabilitado.', 
                    ephemeral: true 
                });
            }

            // Desabilita no DB
            saveRatingPanelConfig(guildId, { enabled: 0, channel_id: null, message_id: null });
            
            await interaction.reply({ 
                content: '✅ Painel de Avaliações desabilitado com sucesso. A mensagem não será mais atualizada.', 
                ephemeral: true 
            });

        } else if (subcommand === 'update') {
            if (!config || config.enabled === 0) {
                return interaction.reply({ 
                    content: '❌ O painel não está configurado. Use \`/ratings-panel setup\` primeiro.', 
                    ephemeral: true 
                });
            }
            
            // Re-importa a função de atualização do handler (o gatilho no DB só funciona após o bot iniciar)
            const { updateRatingPanel } = require('../../handlers/ratingPanelHandler');
            
            await interaction.deferReply({ ephemeral: true });
            
            // Força a atualização
            await updateRatingPanel(guildId, client);

            await interaction.editReply({ content: '✅ Painel de Avaliações atualizado com sucesso (Forçado).', ephemeral: true });
        }
    }
};