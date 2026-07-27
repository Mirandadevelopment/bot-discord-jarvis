const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
// ✨ NOVO: Importamos saveWhitelistConfig
const { getWhitelistConfig, saveWhitelistConfig, getTotalApprovedWhitelists, getTotalPendingWhitelists } = require('../../utils/database');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');
// ✨ NOVO: Importamos a função de criação de Embed e o updater
const { createWhitelistPanelEmbed, updatePanel } = require('../../utils/panelUpdater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist-panel')
    .setDescription('Enviar painel de whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal onde enviar o painel (usa o configurado se não especificado)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const config = getWhitelistConfig(interaction.guildId);
      if (!config || !config.panel_channel_id) {
        return await interaction.editReply({
          embeds: [errorEmbed('Erro', 'Sistema de whitelist não configurado. Use `/whitelist setup` primeiro.')],
          ephemeral: true
        });
      }

      // ⚠️ Ponto de Verificação: Garante que o MySQL foi configurado 
      if (!config.mysql_host) {
        return await interaction.editReply({
          embeds: [errorEmbed('Erro', 'Banco de dados MySQL não configurado. Use `/whitelist-database` primeiro.')],
          ephemeral: true
        });
      }

      const targetChannel = interaction.options.getChannel('canal') || 
                            await client.channels.fetch(config.panel_channel_id).catch(() => null);

      if (!targetChannel) {
        return await interaction.editReply({
          embeds: [errorEmbed('Erro', 'Canal do painel não encontrado. Verifique a configuração.')],
          ephemeral: true
        });
      }
      
      // ✨ NOVO: Obtém estatísticas iniciais
      const stats = {
          approvedWhitelists: getTotalApprovedWhitelists(interaction.guildId),
          pendingWhitelists: getTotalPendingWhitelists(interaction.guildId)
      };

      // Obtém o número de membros online (usando totalMembers como fallback rápido)
      const onlineUsers = interaction.guild.members.cache.filter(m => 
          m.presence?.status === 'online' || 
          m.presence?.status === 'idle' || 
          m.presence?.status === 'dnd'
      ).size || interaction.guild.memberCount;

      // Cria botão
      const buttonRow = new ActionRowBuilder() // Nome da variável renomeado para 'buttonRow' para melhor clareza
        .addComponents(
          new ButtonBuilder()
            .setCustomId('start_whitelist')
            .setLabel('🚀 Iniciar Whitelist')
            .setStyle(ButtonStyle.Success)
        );

      // Envia painel
      // ✨ NOVO: Usamos a função de criação de embed do painel (que inclui stats)
      const message = await targetChannel.send({
        embeds: [createWhitelistPanelEmbed(interaction.guildId, stats, onlineUsers, config.banner_url)],
        components: [buttonRow]
      });
      
      // ✨ NOVO: Salva o ID da mensagem no banco de dados
      saveWhitelistConfig(interaction.guildId, {
          panel_channel_id: targetChannel.id,
          panel_message_id: message.id 
      });

      // ✨ NOVO: Executa a primeira atualização forçada (o loop cuida das próximas)
      updatePanel(client, interaction.guildId, 'whitelist');

      await interaction.editReply({
        embeds: [successEmbed('Painel Enviado', `Painel de whitelist enviado em ${targetChannel} com sucesso! O painel será atualizado automaticamente a cada minuto.`)],
        ephemeral: true
      });

      logger.logAction(
        client,
        interaction.guildId,
        'Whitelist Panel Sent',
        interaction.user.tag,
        `Canal: ${targetChannel.name}, Msg ID: ${message.id}`
      );

    } catch (error) {
      logger.consoleLog('error', `Erro no comando whitelist panel: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Ocorreu um erro ao enviar o painel.')],
        ephemeral: true
      }).catch(() => {});
    }
  }
};