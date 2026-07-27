const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getTicketByChannel, getTicketConfig } = require("../../utils/database");
const { errorEmbed, successEmbed } = require("../../utils/embeds");
const logger = require('../../utils/system-logs');
// Importa TODAS as funções de ação do handler principal, incluindo as novas funções
const { 
    handleTicketClose, 
    handleTicketClaim,
    handleTicketAddUser, // ✅ NOVO: Função para adicionar usuário
    handleTicketRemoveUser // ✅ NOVO: Função para remover
} = require("../../handlers/ticketHandler");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-action')
        .setDescription('Comandos de staff para gerenciar o ticket atual')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adicionar um membro ao ticket.')
                .addUserOption(option =>
                    option
                        .setName('membro')
                        .setDescription('O membro a ser adicionado.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remover um membro do ticket.')
                .addUserOption(option =>
                    option
                        .setName('membro')
                        .setDescription('O membro a ser removido.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Fecha o ticket atual.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription('Assume a responsabilidade pelo ticket atual.')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        // 1. Verifica se o comando está sendo executado em um canal de ticket
        const ticketData = getTicketByChannel(interaction.channelId);

        if (!ticketData) {
            return interaction.editReply({
                embeds: [errorEmbed('Erro', 'Este comando só pode ser usado dentro de um canal de ticket.')],
            });
        }

        // 2. Verifica se o usuário tem permissão (configurações do ticket)
        const config = getTicketConfig(interaction.guildId);
        if (!config || !config.staff_role_id || !interaction.member.roles.cache.has(config.staff_role_id)) {
            return interaction.editReply({
                embeds: [errorEmbed('Permissão Negada', 'Você não tem o cargo de staff configurado para gerenciar tickets.')],
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'add') {
                const member = interaction.options.getUser('membro');
                
                // ✅ NOVO: Chama a função de handler para adicionar e notificar
                await handleTicketAddUser(interaction, client, member, ticketData, config);

            } else if (subcommand === 'remove') {
                const member = interaction.options.getUser('membro');
                // Chama a função de handler para remover usuário
                await handleTicketRemoveUser(interaction, client, member, ticketData, config);
                
            } else if (subcommand === 'close') {
                await handleTicketClose(interaction, client, true); // O 'true' indica que é um comando Slash
                
            } else if (subcommand === 'claim') {
                await handleTicketClaim(interaction, client, true); // O 'true' indica que é um comando Slash
            }

        } catch (error) {
            logger.consoleLog('error', `Erro no comando ticket-action (${subcommand}): ${error.message}`);
            console.error(error);
            await interaction.editReply({
                embeds: [errorEmbed('Erro', 'Ocorreu um erro ao processar a ação do ticket.')],
            }).catch(() => {});
        }
    }
};