const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getWhitelistConfig } = require('../../utils/database');
const { infoEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-view-config')
    .setDescription('Visualizar configurações atuais da whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const config = getWhitelistConfig(interaction.guildId);
      
      if (!config) {
        return await interaction.editReply({
          embeds: [errorEmbed('Erro', 'Sistema de whitelist não configurado. Use `/whitelist setup` para começar.')],
          ephemeral: true
        });
      }

      // Configurações do Discord
      const panelChannel = config.panel_channel_id ? `<#${config.panel_channel_id}>` : 'Não configurado';
      const approvalChannel = config.approval_channel_id ? `<#${config.approval_channel_id}>` : 'Não configurado';
      const logChannel = config.log_channel_id ? `<#${config.log_channel_id}>` : 'Não configurado';
      const approvedRole = config.approved_role_id ? `<@&${config.approved_role_id}>` : 'Não configurado';
      const pendingRole = config.pending_role_id ? `<@&${config.pending_role_id}>` : 'Não configurado';

      // Configurações do MySQL
      const mysqlHost = config.mysql_host || 'Não configurado';
      const mysqlPort = config.mysql_port || 3306;
      const mysqlDatabase = config.mysql_database || 'Não configurado';
      const mysqlUser = config.mysql_user || 'Não configurado';

      // Configurações de Estrutura do Banco
      const tableName = config.db_table_name || 'accounts (padrão)';
      const whitelistColumn = config.db_whitelist_column || 'whitelist (padrão)';
      const idType = config.db_id_type || 'numeric (padrão)';
      const idColumn = config.db_id_column || 'id (padrão)';
      const steamColumn = config.db_steam_column || 'steam (padrão)';

      const idTypeLabel = idType === 'numeric' ? '🔢 ID Numérico' : '🎮 Steam ID';

      const embed = infoEmbed(
        'Configurações da Whitelist',
        `**📋 Configurações do Discord:**\n` +
        `• Canal do Painel: ${panelChannel}\n` +
        `• Canal de Aprovação: ${approvalChannel}\n` +
        `• Canal de Logs: ${logChannel}\n` +
        `• Cargo Aprovado: ${approvedRole}\n` +
        `• Cargo Pendente: ${pendingRole}\n\n` +
        `**💾 Configurações do MySQL:**\n` +
        `• Host: \`${mysqlHost}\`\n` +
        `• Porta: \`${mysqlPort}\`\n` +
        `• Database: \`${mysqlDatabase}\`\n` +
        `• Usuário: \`${mysqlUser}\`\n\n` +
        `**🗄️ Estrutura do Banco de Dados:**\n` +
        `• Tabela: \`${tableName}\`\n` +
        `• Coluna de Whitelist: \`${whitelistColumn}\`\n` +
        `• Tipo de ID: ${idTypeLabel}\n` +
        `• Coluna de ID: \`${idColumn}\`\n` +
        `• Coluna de Steam: \`${steamColumn}\`\n\n` +
        `**ℹ️ Como o bot funciona:**\n` +
        `${idType === 'numeric' 
          ? `O bot irá buscar por ID numérico na coluna \`${idColumn}\` da tabela \`${tableName}\` e atualizar \`${whitelistColumn}\` para 1.`
          : `O bot irá buscar por Steam ID na coluna \`${steamColumn}\` da tabela \`${tableName}\` e atualizar \`${whitelistColumn}\` para 1.`
        }`
      );

      await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao buscar as configurações.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};
