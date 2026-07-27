const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getWhitelistConfig, saveWhitelistConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-config-db')
    .setDescription('Configurar estrutura do banco de dados para whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('tabela')
        .setDescription('Nome da tabela onde está a whitelist (ex: accounts, id_users, vrp_users)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('coluna_whitelist')
        .setDescription('Nome da coluna de whitelist (ex: whitelist, whitelisted)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('tipo_id')
        .setDescription('Tipo de ID para liberação')
        .setRequired(true)
        .addChoices(
          { name: 'ID Numérico (ex: 1, 2, 3)', value: 'numeric' },
          { name: 'Steam ID (ex: steam:11000013c14b01f)', value: 'steam' }
        )
    )
    .addStringOption(option =>
      option
        .setName('coluna_id')
        .setDescription('Nome da coluna de ID numérico (padrão: id)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('coluna_steam')
        .setDescription('Nome da coluna de Steam ID (padrão: steam)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const tableName = interaction.options.getString('tabela');
      const whitelistColumn = interaction.options.getString('coluna_whitelist');
      const idType = interaction.options.getString('tipo_id');
      const idColumn = interaction.options.getString('coluna_id') || 'id';
      const steamColumn = interaction.options.getString('coluna_steam') || 'steam';

      // Obtém configuração existente
      const config = getWhitelistConfig(interaction.guildId) || {};

      // Atualiza com as novas configurações
      config.db_table_name = tableName;
      config.db_whitelist_column = whitelistColumn;
      config.db_id_type = idType;
      config.db_id_column = idColumn;
      config.db_steam_column = steamColumn;

      // Salva configurações
      saveWhitelistConfig(interaction.guildId, config);

      const embed = successEmbed(
        '⚙️ Estrutura do Banco Configurada',
        `Configurações de estrutura do banco de dados salvas com sucesso!\n\n` +
        `**📊 Configurações:**\n` +
        `• Tabela: \`${tableName}\`\n` +
        `• Coluna de Whitelist: \`${whitelistColumn}\`\n` +
        `• Tipo de ID: \`${idType === 'numeric' ? 'ID Numérico' : 'Steam ID'}\`\n` +
        `• Coluna de ID: \`${idColumn}\`\n` +
        `• Coluna de Steam: \`${steamColumn}\`\n\n` +
        `**✅ O bot agora irá:**\n` +
        `${idType === 'numeric' 
          ? `• Buscar por ID numérico na coluna \`${idColumn}\` da tabela \`${tableName}\`\n` +
            `• Atualizar a coluna \`${whitelistColumn}\` para 1 quando aprovado`
          : `• Buscar por Steam ID na coluna \`${steamColumn}\` da tabela \`${tableName}\`\n` +
            `• Atualizar a coluna \`${whitelistColumn}\` para 1 quando aprovado`
        }`
      );

      await interaction.editReply({ embeds: [embed], ephemeral: true });

      logger.logAction(
        client,
        interaction.guildId,
        'Whitelist DB Config',
        interaction.user.tag,
        `Tabela: ${tableName}, Tipo: ${idType}`
      );

    } catch (error) {
      logger.consoleLog('error', `Erro no comando whitelist-config-db: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao configurar a estrutura do banco de dados.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};
