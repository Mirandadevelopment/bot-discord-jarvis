const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveRecruitmentConfig, getRecruitmentConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('recrutamento')
        .setDescription('Configura o sistema de recrutamento de Staff.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configura os canais e cargo para o recrutamento.')
                .addChannelOption(option => option.setName('canal_painel').setDescription('Canal onde o botão de "Seja Staff" será enviado.').setRequired(true))
                .addChannelOption(option => option.setName('canal_logs').setDescription('Canal onde as respostas dos formulários serão enviadas.').setRequired(true))
                .addRoleOption(option => option.setName('cargo_staff').setDescription('Cargo de Staff que terá acesso aos logs.').setRequired(true))
                .addStringOption(option => option.setName('banner').setDescription('URL do banner para o painel (opcional).').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('painel')
                .setDescription('Envia o painel de recrutamento no canal configurado.')),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        try {
            await interaction.deferReply({ ephemeral: true });

            if (subcommand === 'setup') {
                const channelPanel = interaction.options.getChannel('canal_painel');
                const channelLogs = interaction.options.getChannel('canal_logs');
                const staffRole = interaction.options.getRole('cargo_staff');
                const banner = interaction.options.getString('banner');

                const defaultQuestions = [
                    "Qual seu nome completo e idade?",
                    "Quanto tempo você tem disponível por dia?",
                    "Por que você deseja fazer parte da nossa Staff?",
                    "Você já teve experiência como Staff em outros servidores?",
                    "Como você lida com situações de conflito entre jogadores?",
                    "O que você faria se visse um amigo quebrando as regras?",
                    "Qual sua maior qualidade e seu maior defeito?",
                    "Você conhece bem as regras do nosso servidor?",
                    "Como você pode ajudar o servidor a crescer?",
                    "Qual seu Discord ID e Steam Hex?"
                ];

                saveRecruitmentConfig(guildId, {
                    channel_id: channelPanel.id,
                    log_channel_id: channelLogs.id,
                    staff_role_id: staffRole.id,
                    banner_url: banner,
                    questions: defaultQuestions,
                    enabled: 1
                });

                return interaction.editReply({
                    embeds: [successEmbed('Recrutamento Configurado', `O sistema de recrutamento foi configurado com sucesso!\n\n**Painel:** ${channelPanel}\n**Logs:** ${channelLogs}\n**Cargo Staff:** ${staffRole}\n\nUse \`/recrutamento painel\` para enviar o botão.`)]
                });

            } else if (subcommand === 'painel') {
                const config = getRecruitmentConfig(guildId);

                if (!config || !config.enabled) {
                    return interaction.editReply({ embeds: [errorEmbed('Erro', 'O recrutamento não está configurado. Use `/recrutamento setup` primeiro.')] });
                }

                const channel = interaction.guild.channels.cache.get(config.channel_id);
                if (!channel) {
                    return interaction.editReply({ embeds: [errorEmbed('Erro', 'Canal do painel não encontrado.')] });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🚀 Recrutamento de Staff')
                    .setDescription('Deseja fazer parte da nossa equipe? Clique no botão abaixo para iniciar o formulário de recrutamento.\n\n**Requisitos Mínimos:**\n- Ter microfone de qualidade.\n- Conhecer as regras do servidor.\n- Ter maturidade e responsabilidade.')
                    .setColor(0x00FF00)
                    .setFooter({ text: 'Boa sorte a todos os candidatos!' });

                if (config.banner_url) embed.setImage(config.banner_url);

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('recruitment_start')
                            .setLabel('Seja Staff')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('📝')
                    );

                await channel.send({ embeds: [embed], components: [row] });

                return interaction.editReply({ content: '✅ Painel de recrutamento enviado com sucesso!' });
            }
        } catch (error) {
            logger.consoleLog('error', `Erro no comando recrutamento: ${error.message}`);
            return interaction.editReply({ embeds: [errorEmbed('Erro', 'Ocorreu um erro ao processar o comando.')] });
        }
    }
};
