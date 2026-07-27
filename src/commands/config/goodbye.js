const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGoodbyeConfig, saveGoodbyeConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('Configurar sistema de saída')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar canal e mensagem de saída')
        .addChannelOption(option =>
          option
            .setName('canal')
            .setDescription('Canal onde as mensagens de saída serão enviadas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('mensagem')
            .setDescription('Mensagem de saída (use {username} para nome, {server} para servidor)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('banner')
            .setDescription('URL da imagem/banner de saída (opcional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Testar mensagem de saída')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Desativar sistema de saída')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Ativar sistema de saída')
    ),

  async execute(interaction, client) {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'setup') {
        await handleSetup(interaction, client);
      } else if (subcommand === 'test') {
        await handleTest(interaction, client);
      } else if (subcommand === 'disable') {
        await handleDisable(interaction, client);
      } else if (subcommand === 'enable') {
        await handleEnable(interaction, client);
      }

    } catch (error) {
      logger.consoleLog('error', `Erro no comando goodbye: ${error.message}`);
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao executar o comando.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};

async function handleSetup(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('canal');
  const message = interaction.options.getString('mensagem');
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

  // Salva configuração
  saveGoodbyeConfig(interaction.guildId, {
    channel_id: channel.id,
    message: message,
    banner_url: banner || null,
    enabled: 1
  });

  const embed = successEmbed(
    'Saída Configurada',
    `✅ Sistema de saída configurado com sucesso!\n\n` +
    `📢 **Canal:** ${channel}\n` +
    `💬 **Mensagem:** ${message}\n` +
    `${banner ? `🖼️ **Banner:** Configurado\n` : ''}` +
    `\n**Variáveis disponíveis:**\n` +
    `• \`{username}\` - Nome do usuário\n` +
    `• \`{server}\` - Nome do servidor\n` +
    `• \`{membercount}\` - Total de membros\n\n` +
    `Use \`/goodbye test\` para testar!`
  );

  await interaction.editReply({ embeds: [embed], ephemeral: true });

  logger.logAction(
    client,
    interaction.guildId,
    'Goodbye System Configured',
    interaction.user.tag,
    `Canal: ${channel.name}`
  );
}

async function handleTest(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const config = getGoodbyeConfig(interaction.guildId);

  if (!config || !config.enabled) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Sistema de saída não configurado ou desativado. Use `/goodbye setup` primeiro.')],
      ephemeral: true
    });
  }

  const channel = await interaction.guild.channels.fetch(config.channel_id).catch(() => null);

  if (!channel) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Canal de saída não encontrado.')],
      ephemeral: true
    });
  }

  // Envia mensagem de teste
  const { sendGoodbyeMessage } = require('../../events/guildMemberRemove');
  await sendGoodbyeMessage(interaction.member, client);

  await interaction.editReply({
    embeds: [successEmbed('Teste Enviado', `Mensagem de saída de teste enviada em ${channel}!`)],
    ephemeral: true
  });
}

async function handleDisable(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const config = getGoodbyeConfig(interaction.guildId);

  if (!config) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Sistema de saída não configurado.')],
      ephemeral: true
    });
  }

  saveGoodbyeConfig(interaction.guildId, { ...config, enabled: 0 });

  await interaction.editReply({
    embeds: [successEmbed('Sistema Desativado', 'Sistema de saída desativado com sucesso.')],
    ephemeral: true
  });

  logger.logAction(
    client,
    interaction.guildId,
    'Goodbye System Disabled',
    interaction.user.tag,
    ''
  );
}

async function handleEnable(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const config = getGoodbyeConfig(interaction.guildId);

  if (!config) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Sistema de saída não configurado. Use `/goodbye setup` primeiro.')],
      ephemeral: true
    });
  }

  saveGoodbyeConfig(interaction.guildId, { ...config, enabled: 1 });

  await interaction.editReply({
    embeds: [successEmbed('Sistema Ativado', 'Sistema de saída ativado com sucesso.')],
    ephemeral: true
  });

  logger.logAction(
    client,
    interaction.guildId,
    'Goodbye System Enabled',
    interaction.user.tag,
    ''
  );
}
