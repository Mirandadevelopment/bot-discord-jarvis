const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveWhitelistConfig, updateGuildConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Gerenciar sistema de whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar sistema de whitelist')
        .addChannelOption(option =>
          option
            .setName('painel')
            .setDescription('Canal onde o painel de whitelist será enviado')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('aprovacao')
            .setDescription('Canal para notificações de aprovação')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('categoria')
            .setDescription('Categoria para canais privados de whitelist')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('cargo_aprovado')
            .setDescription('Cargo para usuários aprovados')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('cargo_pendente')
            .setDescription('Cargo para usuários pendentes (opcional)')
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
            .setDescription('URL da imagem/banner para o painel de whitelist (opcional)')
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const panelChannel = interaction.options.getChannel('painel');
      const approvalChannel = interaction.options.getChannel('aprovacao');
      const category = interaction.options.getChannel('categoria');
      const approvedRole = interaction.options.getRole('cargo_aprovado');
      const pendingRole = interaction.options.getRole('cargo_pendente');
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
        approval_channel_id: approvalChannel.id,
        category_id: category.id,
        approved_role_id: approvedRole.id,
        pending_role_id: pendingRole?.id || null,
        log_channel_id: logChannel?.id || null,
        banner_url: banner || null
      };

      saveWhitelistConfig(interaction.guildId, config);
      updateGuildConfig(interaction.guildId, { whitelist_enabled: 1 });

      const embed = successEmbed(
        'Whitelist Configurada',
        `Sistema de whitelist configurado com sucesso!\n\n` +
        `**📋 Configurações:**\n` +
        `• Painel: ${panelChannel}\n` +
        `• Aprovações: ${approvalChannel}\n` +
        `• Categoria: ${category.name}\n` +
        `• Cargo Aprovado: ${approvedRole}\n` +
        `${pendingRole ? `• Cargo Pendente: ${pendingRole}\n` : ''}` +
        `${logChannel ? `• Logs: ${logChannel}\n` : ''}\n\n` +
        `**⚠️ Próximos passos:**\n` +
        `1. Configure o banco de dados MySQL com \`/whitelist database\`\n` +
        `2. Envie o painel com \`/whitelist panel\``
      );

      await interaction.editReply({ embeds: [embed], ephemeral: true });

      logger.logAction(
        client,
        interaction.guildId,
        'Whitelist Setup',
        interaction.user.tag,
        `Painel: ${panelChannel.name}, Categoria: ${category.name}`
      );

    } catch (error) {
      logger.consoleLog('error', `Erro no comando whitelist setup: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao configurar o sistema de whitelist.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};
