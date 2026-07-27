const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getWhitelistConfig, saveWhitelistConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-database')
    .setDescription('Configurar conexão com banco de dados MySQL para whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('host')
        .setDescription('Host do MySQL (ex: localhost ou IP)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário do MySQL')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('senha')
        .setDescription('Senha do MySQL')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('database')
        .setDescription('Nome do banco de dados')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('porta')
        .setDescription('Porta do MySQL (padrão: 3306)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const host = interaction.options.getString('host');
      const user = interaction.options.getString('usuario');
      const password = interaction.options.getString('senha');
      const database = interaction.options.getString('database');
      const port = interaction.options.getInteger('porta') || 3306;

      // Testa conexão
      let connection;
      const currentConfig = getWhitelistConfig(interaction.guildId) || {};
      const tableName = currentConfig.db_table_name || 'accounts';
      
      try {
        connection = await mysql.createConnection({
          host,
          user,
          password,
          database,
          port
        });

        // Verifica se a tabela existe (usa configuração dinâmica)
        
        // CORREÇÃO: SHOW TABLES LIKE não suporta placeholder para o valor LIKE no mysql2/promise
        // O nome da tabela deve ser inserido diretamente na string, pois é um valor seguro (vindo da config)
        const [tables] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`);
        if (tables.length === 0) {
          await connection.end();
          return await interaction.editReply({
            embeds: [errorEmbed('Erro', `Tabela \`${tableName}\` não encontrada no banco de dados. Verifique se o banco está configurado corretamente ou use \`/whitelist-config-db\` para configurar a tabela correta.`)],
            ephemeral: true
          });
        }

        await connection.end();

      } catch (dbError) {
        logger.consoleLog('error', `Erro ao conectar ao MySQL: ${dbError.message}`);
        return await interaction.editReply({
          embeds: [errorEmbed('Erro de Conexão', `Não foi possível conectar ao banco de dados:\n\`\`\`${dbError.message}\`\`\`\n\nVerifique as credenciais e tente novamente.`)],
          ephemeral: true
        });
      }

      // Salva configurações
      const config = getWhitelistConfig(interaction.guildId) || {};
      config.mysql_host = host;
      config.mysql_user = user;
      config.mysql_password = password;
      config.mysql_database = database;
      config.mysql_port = port;

      saveWhitelistConfig(interaction.guildId, config);

      const embed = successEmbed(
        'Banco de Dados Configurado',
        `Conexão com MySQL configurada e testada com sucesso!\n\n` +
        `**📊 Informações:**\n` +
        `• Host: \`${host}\`\n` +
        `• Porta: \`${port}\`\n` +
        `• Database: \`${database}\`\n` +
        `• Usuário: \`${user}\`\n\n` +
        `✅ Tabela \`${tableName}\` encontrada!\n\n` +
        `**⚠️ Próximos passos:**\n` +
        `1. Configure a estrutura do banco com \`/whitelist-config-db\`\n` +
        `2. Envie o painel com \`/whitelist panel\``
      );

      await interaction.editReply({ embeds: [embed], ephemeral: true });

      logger.logAction(
        client,
        interaction.guildId,
        'Whitelist Database Config',
        interaction.user.tag,
        `Host: ${host}, Database: ${database}`
      );

    } catch (error) {
      logger.consoleLog('error', `Erro no comando whitelist database: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao configurar o banco de dados.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};