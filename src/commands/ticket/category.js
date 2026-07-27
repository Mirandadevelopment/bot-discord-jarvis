const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addTicketCategory, removeTicketCategory, getTicketCategories } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-category')
    .setDescription('Gerenciar categorias de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Adicionar uma categoria de ticket')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome da categoria')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('descricao')
            .setDescription('Descrição da categoria')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('Emoji da categoria (opcional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remover uma categoria de ticket')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome da categoria a remover')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Listar todas as categorias de tickets')
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ ephemeral: true });

      if (subcommand === 'add') {
        const name = interaction.options.getString('nome');
        const description = interaction.options.getString('descricao');
        const emoji = interaction.options.getString('emoji') || '🎫';

        // Verifica se já existe
        const categories = getTicketCategories(interaction.guildId);
        if (categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
          return await interaction.editReply({
            embeds: [errorEmbed('Erro', 'Já existe uma categoria com este nome.')],
            ephemeral: true
          });
        }

        addTicketCategory(interaction.guildId, name, description, emoji);

        await interaction.editReply({
          embeds: [successEmbed('Categoria Adicionada', `Categoria **${emoji} ${name}** adicionada com sucesso!\n\n**Descrição:** ${description}`)],
          ephemeral: true
        });

        logger.logAction(client, interaction.guildId, 'Ticket Category Added', interaction.user.tag, `${emoji} ${name}`);

      } else if (subcommand === 'remove') {
        const name = interaction.options.getString('nome');

        const result = removeTicketCategory(interaction.guildId, name);
        if (result.changes === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('Erro', 'Categoria não encontrada.')],
            ephemeral: true
          });
        }

        await interaction.editReply({
          embeds: [successEmbed('Categoria Removida', `Categoria **${name}** removida com sucesso!`)],
          ephemeral: true
        });

        logger.logAction(client, interaction.guildId, 'Ticket Category Removed', interaction.user.tag, name);

      } else if (subcommand === 'list') {
        const categories = getTicketCategories(interaction.guildId);

        if (categories.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('Nenhuma Categoria', 'Não há categorias configuradas. Use `/ticket-category add` para adicionar.')],
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📋 Categorias de Tickets')
          .setDescription(categories.map(c => `${c.emoji} **${c.name}**\n${c.description}`).join('\n\n'))
          .setColor(0x3498db)
          .setFooter({ text: `Total: ${categories.length} categoria(s)` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      logger.consoleLog('error', `Erro no comando ticket category: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao processar o comando.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};
