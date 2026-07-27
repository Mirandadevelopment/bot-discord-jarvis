const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getWelcomeConfig, saveWelcomeConfig } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configurar sistema de boas-vindas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar canal e mensagem de boas-vindas')
        .addChannelOption(option =>
          option
            .setName('canal')
            .setDescription('Canal onde as mensagens de boas-vindas serão enviadas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('mensagem')
            .setDescription('Mensagem de boas-vindas (use {user} para mencionar, {username} para nome, {server} para servidor)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('banner')
            .setDescription('URL da imagem/banner de boas-vindas (opcional)')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('cargo')
            .setDescription('Cargo a ser atribuído ao novo membro (opcional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Testar mensagem de boas-vindas')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Desativar sistema de boas-vindas')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Ativar sistema de boas-vindas')
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
      logger.consoleLog('error', `Erro no comando welcome: ${error.message}`);
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
  const role = interaction.options.getRole('cargo');

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
  saveWelcomeConfig(interaction.guildId, {
    channel_id: channel.id,
    message: message,
    banner_url: banner || null,
    role_id: role?.id || null,
    enabled: 1
  });

  const embed = successEmbed(
    'Boas-vindas Configuradas',
    `✅ Sistema de boas-vindas configurado com sucesso!\n\n` +
    `📢 **Canal:** ${channel}\n` +
    `💬 **Mensagem:** ${message}\n` +
    `${banner ? `🖼️ **Banner:** Configurado\n` : ''}` +
    `${role ? `👑 **Cargo Automático:** ${role}\n` : ''}` +
    `\n**Variáveis disponíveis:**\n` +
    `• \`{user}\` - Menciona o usuário\n` +
    `• \`{username}\` - Nome do usuário\n` +
    `• \`{server}\` - Nome do servidor\n` +
    `• \`{membercount}\` - Total de membros\n\n` +
    `Use \`/welcome test\` para testar!`
  );

  await interaction.editReply({ embeds: [embed], ephemeral: true });

  logger.logAction(
    client,
    interaction.guildId,
    'Welcome System Configured',
    interaction.user.tag,
    `Canal: ${channel.name}`
  );
}

async function handleTest(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const config = getWelcomeConfig(interaction.guildId);

  if (!config || !config.enabled) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Sistema de boas-vindas não configurado ou desativado. Use `/welcome setup` primeiro.')],
      ephemeral: true
    });
  }

  const channel = await interaction.guild.channels.fetch(config.channel_id).catch(() => null);

  if (!channel) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Canal de boas-vindas não encontrado.')],
      ephemeral: true
    });
  }

  // Envia mensagem de teste
  const { sendWelcomeMessage } = require('../../events/guildMemberAdd');
  await sendWelcomeMessage(interaction.member, client);

  await interaction.editReply({
    embeds: [successEmbed('Teste Enviado', `Mensagem de boas-vindas de teste enviada em ${channel}!`)],
    ephemeral: true
  });
}

async function handleDisable(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const config = getWelcomeConfig(interaction.guildId);

  if (!config) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Sistema de boas-vindas não configurado.')],
      ephemeral: true
    });
  }

  saveWelcomeConfig(interaction.guildId, { ...config, enabled: 0 });

  await interaction.editReply({
    embeds: [successEmbed('Sistema Desativado', 'Sistema de boas-vindas desativado com sucesso.')],
    ephemeral: true
  });

  logger.logAction(
    client,
    interaction.guildId,
    'Welcome System Disabled',
    interaction.user.tag,
    ''
  );
}

async function handleEnable(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const config = getWelcomeConfig(interaction.guildId);

  if (!config) {
    return await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Sistema de boas-vindas não configurado. Use `/welcome setup` primeiro.')],
      ephemeral: true
    });
  }

  saveWelcomeConfig(interaction.guildId, { ...config, enabled: 1 });

  await interaction.editReply({
    embeds: [successEmbed('Sistema Ativado', 'Sistema de boas-vindas ativado com sucesso.')],
    ephemeral: true
  });

  logger.logAction(
    client,
    interaction.guildId,
    'Welcome System Enabled',
    interaction.user.tag,
    ''
  );
}
