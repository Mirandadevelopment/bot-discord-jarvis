const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveTicketConfig, updateGuildConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gerenciar sistema de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar sistema de tickets')
        .addChannelOption(option =>
          option
            .setName('painel')
            .setDescription('Canal onde o painel de tickets será enviado')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('categoria')
            .setDescription('Categoria do Discord onde os tickets serão criados')
            .addChannelTypes(4) // Apenas categorias
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('cargo_staff')
            .setDescription('Cargo da staff que terá acesso aos tickets')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('transcricoes')
            .setDescription('Canal para enviar transcrições de tickets fechados (opcional)')
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('logs')
            .setDescription('Canal para logs do sistema (opcional)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('banner')
            .setDescription('URL da imagem/banner para o painel de tickets (opcional)')
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const panelChannel = interaction.options.getChannel('painel');
      const category = interaction.options.getChannel('categoria');
      const staffRole = interaction.options.getRole('cargo_staff');
      const transcriptChannel = interaction.options.getChannel('transcricoes');
      const logChannel = interaction.options.getChannel('logs');

      // Validações
      if (panelChannel.type !== 0) {
        return await interaction.editReply({
          embeds: [errorEmbed('Erro', 'O canal do painel deve ser um canal de texto.')],
          ephemeral: true
        });
      }

      if (category.type !== 4) {
        return await interaction.editReply({
          embeds: [errorEmbed('Erro', 'A categoria deve ser uma categoria de canal.')],
          ephemeral: true
        });
      }

      const banner = interaction.options.getString('banner');

      // Valida URL do banner se fornecido
      if (banner) {
        try {
          new URL(banner);
        } catch {
          return await interaction.editReply({
            embeds: [errorEmbed('Erro', 'URL do banner inválida. Forneça uma URL válida de imagem.')],
            ephemeral: true
          });
        }
      }

      // Salva configurações
      const config = {
        panel_channel_id: panelChannel.id,
        category_id: category.id,
        staff_role_id: staffRole.id,
        transcript_channel_id: transcriptChannel?.id || null,
        log_channel_id: logChannel?.id || null,
        banner_url: banner || null
      };

      saveTicketConfig(interaction.guildId, config);
      updateGuildConfig(interaction.guildId, { ticket_enabled: 1 });

      const embed = successEmbed(
        'Tickets Configurados',
        `Sistema de tickets configurado com sucesso!\n\n` +
        `**📋 Configurações:**\n` +
        `• Painel: ${panelChannel}\n` +
        `• Categoria: ${category.name}\n` +
        `• Cargo Staff: ${staffRole}\n` +
        `${transcriptChannel ? `• Transcrições: ${transcriptChannel}\n` : ''}` +
        `${logChannel ? `• Logs: ${logChannel}\n` : ''}\n\n` +
        `**⚠️ Próximos passos:**\n` +
        `1. Adicione categorias de ticket com \`/ticket-category add\`\n` +
        `2. Envie o painel com \`/ticket-panel\``
      );

      await interaction.editReply({ embeds: [embed], ephemeral: true });

      logger.logAction(
        client,
        interaction.guildId,
        'Ticket Setup',
        interaction.user.tag,
        `Painel: ${panelChannel.name}, Categoria: ${category.name}`
      );

    } catch (error) {
      logger.consoleLog('error', `Erro no comando ticket setup: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao configurar o sistema de tickets.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};
