const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getStaffConfig, getManagedStaff, addManagedStaff, removeManagedStaff } = require('../../utils/staffDatabase');
const { forceStaffPanelUpdate } = require('../../utils/staffPanelUpdater');
const logger = require('../../utils/system-logs');

// IDs de botões
const ADD_STAFF_ID = 'staff_add';
const REMOVE_STAFF_ID = 'staff_remove';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Comandos de gerenciamento de Staff.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) // Permissão padrão para quem pode usar
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel de controle de Staff no canal configurado.')),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const config = getStaffConfig(guildId);

        if (!config || !config.control_channel_id || !config.admin_role_id) {
            return interaction.reply({ 
                content: '❌ O sistema de Staff não está totalmente configurado. Use `/staffconfig canais` e `/staffconfig painelpublico` para configurar o canal de controle e o cargo administrador.', 
                ephemeral: true 
            });
        }

        // Verifica se o usuário tem o cargo de administrador configurado ou permissão de Administrador
        // O admin_role_id é configurado via /staffconfig canais
        if (config.admin_role_id && !interaction.member.roles.cache.has(config.admin_role_id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: `❌ Você não tem permissão para usar este comando. Apenas membros com o cargo <@&${config.admin_role_id}> ou Administradores podem usá-lo.`, 
                ephemeral: true 
            });
        }

        if (interaction.options.getSubcommand() === 'painel') {
            const controlChannel = interaction.guild.channels.cache.get(config.control_channel_id);

            if (!controlChannel) {
                return interaction.reply({ 
                    content: '❌ O canal de controle configurado não foi encontrado. Verifique a configuração com `/staffconfig canais`.', 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚙️ Painel de Controle de Staff')
                .setDescription('Use os botões abaixo para adicionar ou remover membros da Staff gerenciada. Esta ação será registrada no canal de log.')
                .setFooter({ text: 'Apenas usuários com o cargo administrador configurado podem interagir.' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(ADD_STAFF_ID)
                        .setLabel('➕ Adicionar Staff')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(REMOVE_STAFF_ID)
                        .setLabel('➖ Remover Staff')
                        .setStyle(ButtonStyle.Danger),
                );

            await controlChannel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: `✅ Painel de controle enviado para ${controlChannel}.`, ephemeral: true });
        }
    },

    // Exporta os IDs dos botões para uso no event handler
    ADD_STAFF_ID,
    REMOVE_STAFF_ID
};
