 const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setStaffConfig, getStaffConfig } = require('../../utils/staffDatabase');
const { generateStaffPanelEmbed } = require('../../utils/staffPanelUpdater');
const logger = require('../../utils/system-logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staffconfig')
        .setDescription('Configura o sistema de controle de Staff e o painel de hierarquia.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cargos')
                .setDescription('Define os cargos que compõem a Staff (serão exibidos no painel).')
                .addStringOption(option =>
                    option.setName('cargos_ids')
                        .setDescription('IDs dos cargos de Staff, separados por vírgula (ex: 123,456,789).')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('painelpublico')
                .setDescription('Configura o canal onde o painel de hierarquia da Staff será exibido.')
                .addRoleOption(option =>
                    option.setName('cargo_admin')
                        .setDescription('Cargo que terá permissão para usar o painel de controle (adicionar/remover staff).')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('O canal de texto onde o painel será enviado e atualizado.')
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('canais')
                .setDescription('Configura os canais de controle e log.')
                .addChannelOption(option =>
                    option.setName('canal_controle')
                        .setDescription('Canal onde o painel de controle (botões) será enviado.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('canal_log')
                        .setDescription('Canal onde serão registradas as contratações e demissões.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        // 🚨 CORREÇÃO: Removida verificação de ID fixo. O comando agora usa setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // e verificamos manualmente apenas por segurança extra.
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ content: '❌ Apenas administradores podem usar este comando.' });
        }

        try {
            let config = getStaffConfig(guildId) || { guild_id: guildId };

            if (subcommand === 'cargos') {
                const cargosIdsString = interaction.options.getString('cargos_ids');
                const cargosIds = cargosIdsString.split(',').map(id => id.trim()).filter(id => id.length > 0);

                if (cargosIds.length === 0) {
                    return interaction.editReply({ content: '❌ Por favor, forneça pelo menos um ID de cargo válido.' });
                }

                // Validação básica se os IDs são de cargos existentes
                const invalidRoles = cargosIds.filter(id => !interaction.guild.roles.cache.has(id));
                if (invalidRoles.length > 0) {
                    return interaction.editReply({ content: `⚠️ Os seguintes IDs de cargo não foram encontrados no servidor: \`${invalidRoles.join(', ')}\`. Por favor, verifique e tente novamente.` });
                }

                setStaffConfig(guildId, { staff_role_ids: cargosIds });
                return interaction.editReply({ content: `✅ Cargos de Staff configurados com sucesso: ${cargosIds.map(id => `<@&${id}>`).join(', ')}.` });

            } else if (subcommand === 'painelpublico') {
                const channel = interaction.options.getChannel('canal');
                const adminRole = interaction.options.getRole('cargo_admin');

                // 1. Salva a configuração
                setStaffConfig(guildId, { 
                    public_panel_channel_id: channel ? channel.id : config.public_panel_channel_id,
                    admin_role_id: adminRole.id
                });

                // 2. Envia a mensagem inicial do painel se o canal foi fornecido
                if (channel) {
                    const embed = generateStaffPanelEmbed(interaction.guild, [], config.staff_role_ids);
                    const message = await channel.send({ embeds: [embed] });

                    // 3. Salva o ID da mensagem no banco de dados
                    setStaffConfig(guildId, { public_panel_message_id: message.id });
                    
                    return interaction.editReply({ content: `✅ Painel de Hierarquia configurado com sucesso no canal ${channel}. O cargo <@&${adminRole.id}> agora pode gerenciar a staff.` });
                }

                return interaction.editReply({ content: `✅ Cargo administrador de staff atualizado para <@&${adminRole.id}>.` });

            } else if (subcommand === 'canais') {
                const controlChannel = interaction.options.getChannel('canal_controle');
                const logChannel = interaction.options.getChannel('canal_log');

                setStaffConfig(guildId, { 
                    control_channel_id: controlChannel.id,
                    log_channel_id: logChannel.id
                });

                return interaction.editReply({ content: `✅ Canais de controle e log configurados com sucesso:
- **Controle:** ${controlChannel}
- **Log:** ${logChannel}` });
            }

        } catch (error) {
            logger.consoleLog('error', `Erro no comando staffconfig: ${error.message}`);
            return interaction.editReply({ content: '❌ Ocorreu um erro ao processar a configuração. Verifique as permissões do bot e tente novamente.' });
        }
    }
};
