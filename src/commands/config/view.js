const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig, getWhitelistConfig, getTicketConfig, getTicketCategories } = require('../../utils/database');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Ver configurações do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildConfig = getGuildConfig(interaction.guildId);
      const whitelistConfig = getWhitelistConfig(interaction.guildId);
      const ticketConfig = getTicketConfig(interaction.guildId);
      const ticketCategories = getTicketCategories(interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configurações - ${interaction.guild.name}`)
        .setColor(0x3498db)
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp()
        .setFooter({ text: 'Use os comandos de configuração para alterar' });

      // Status geral
      embed.addFields({
        name: '📊 Status Geral',
        value: `**Whitelist:** ${guildConfig.whitelist_enabled ? '✅ Ativo' : '❌ Inativo'}\n` +
               `**Tickets:** ${guildConfig.ticket_enabled ? '✅ Ativo' : '❌ Inativo'}`,
        inline: false
      });

      // Configurações de Whitelist
      if (whitelistConfig) {
        const wlFields = [];
        if (whitelistConfig.panel_channel_id) wlFields.push(`Painel: <#${whitelistConfig.panel_channel_id}>`);
        if (whitelistConfig.approval_channel_id) wlFields.push(`Aprovações: <#${whitelistConfig.approval_channel_id}>`);
        if (whitelistConfig.category_id) wlFields.push(`Categoria: <#${whitelistConfig.category_id}>`);
        if (whitelistConfig.approved_role_id) wlFields.push(`Cargo Aprovado: <@&${whitelistConfig.approved_role_id}>`);
        if (whitelistConfig.mysql_host) wlFields.push(`MySQL: \`${whitelistConfig.mysql_host}\``);

        embed.addFields({
          name: '📝 Whitelist',
          value: wlFields.length > 0 ? wlFields.join('\n') : 'Não configurado',
          inline: false
        });
      }

      // Configurações de Tickets
      if (ticketConfig) {
        const tkFields = [];
        if (ticketConfig.panel_channel_id) tkFields.push(`Painel: <#${ticketConfig.panel_channel_id}>`);
        if (ticketConfig.category_id) tkFields.push(`Categoria: <#${ticketConfig.category_id}>`);
        if (ticketConfig.staff_role_id) tkFields.push(`Staff: <@&${ticketConfig.staff_role_id}>`);
        if (ticketConfig.transcript_channel_id) tkFields.push(`Transcrições: <#${ticketConfig.transcript_channel_id}>`);
        tkFields.push(`Categorias: ${ticketCategories.length}`);

        embed.addFields({
          name: '🎫 Tickets',
          value: tkFields.length > 0 ? tkFields.join('\n') : 'Não configurado',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      logger.consoleLog('error', `Erro no comando config: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        content: '❌ Erro ao carregar configurações.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};
