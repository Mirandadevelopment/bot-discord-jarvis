const { Events, InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ADD_STAFF_ID, REMOVE_STAFF_ID } = require('../commands/staff/staffControl');
const { getStaffConfig, addManagedStaff, removeManagedStaff } = require('../utils/staffDatabase');
const { forceStaffPanelUpdate } = require('../utils/staffPanelUpdater');
const logger = require('../utils/system-logs');
const { errorEmbed } = require('../utils/embeds');
const { _tc } = require('../utils/security-provider');

// --- Handlers de Tickets (Importação Estática) ---
const { 
    handleTicketOpen,
    handleTicketClose,
    handleTicketCloseConfirm,
    handleTicketClaim,
    handleRating,
    handleRatingComment, 
} = require('../handlers/ticketHandler');

// --- Handler de Whitelist (Importação Estática) ---
const {
    handleWhitelistButton 
} = require('../handlers/whitelistHandler');

// --- Handler de IA de Atendimento (Importação Estática) ---
const {
    handleAIStart,
    handleAIChoice
} = require('../handlers/conversationHandler');

// --- Handler de Recrutamento (Importação Estática) ---
const { 
    startRecruitment, 
    handleModal1, 
    handleModal2 
} = require('../handlers/recruitmentHandler');


module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    
    if (!interaction.inGuild() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu() && !interaction.isCommand()) return;

    // --- 1. Autocomplete ---
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        logger.consoleLog('error', `Erro no Autocomplete (${interaction.commandName}): ${error.message}`);
      }
      return;
    }

    // --- 2. Slash Commands ---
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      // Track command execution
      _tc(interaction);

      try {
        await command.execute(interaction, client);
      } catch (error) {
        // Interação expirou (token > 3s) ou já foi respondida em outro lugar —
        // não tem como recuperar, então só loga limpo e não tenta responder de novo.
        if (error.code === 10062 || error.code === 40060) {
          logger.consoleLog('error', `⏱️ Interação expirada/já respondida no comando (${interaction.commandName}). O bot provavelmente estava ocupado no momento em que o comando foi usado.`);
          return;
        }

        logger.consoleLog('error', `Erro ao executar comando (${interaction.commandName}): ${error.message}`);
        console.error(error);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errorEmbed('Erro de Execução', 'Ocorreu um erro ao tentar executar este comando.')], ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errorEmbed('Erro de Execução', 'Ocorreu um erro ao tentar executar este comando.')], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // --- 3. Componentes ---

    // --- 3a. Buttons ---
    if (interaction.isButton()) {
        const customId = interaction.customId;
        const guildId = interaction.guildId;

        // Botões de Staff
        if (customId === ADD_STAFF_ID || customId === REMOVE_STAFF_ID) {
            const config = getStaffConfig(guildId);
            if (config && config.admin_role_id) {
                if (!interaction.member.roles.cache.has(config.admin_role_id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: `❌ Você não tem permissão para usar este painel.`, ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`staffModal_${customId}`)
                    .setTitle(customId === ADD_STAFF_ID ? 'Adicionar Membro à Staff' : 'Remover Membro da Staff');

                const userIdInput = new TextInputBuilder().setCustomId('userIdInput').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true);
                const justificationInput = new TextInputBuilder().setCustomId('justificationInput').setLabel('Justificativa').setStyle(TextInputStyle.Paragraph).setRequired(true);
                
                const components = [new ActionRowBuilder().addComponents(userIdInput), new ActionRowBuilder().addComponents(justificationInput)];
                if (customId === ADD_STAFF_ID) {
                    const staffRoleInput = new TextInputBuilder().setCustomId('staffRoleInput').setLabel('ID do Cargo Principal').setStyle(TextInputStyle.Short).setRequired(true);
                    components.push(new ActionRowBuilder().addComponents(staffRoleInput));
                }

                modal.addComponents(components);
                await interaction.showModal(modal);
                return;
            }
        }

        try {
            if (interaction.customId === 'start_ai_atendimento') return await handleAIStart(interaction, client);
            if (interaction.customId === 'start_whitelist') return await handleWhitelistButton(interaction, client);
            if (interaction.customId === 'recruitment_start') return await startRecruitment(interaction);
            if (interaction.customId === 'ticket_close') return await handleTicketClose(interaction, client);
            if (interaction.customId === 'ticket_confirm_close') return await handleTicketCloseConfirm(interaction, client);
            if (interaction.customId === 'ticket_claim') return await handleTicketClaim(interaction, client);
            
            if (interaction.customId.startsWith('ticket_open_')) {
                const categoryValue = interaction.customId.split('ticket_open_')[1];
                return await handleTicketOpen(interaction, client, categoryValue);
            }
            
            if (interaction.customId.startsWith('rating_')) {
                const ratingValue = parseInt(interaction.customId.split('_')[1]);
                return await handleRating(interaction, client, ratingValue);
            }

            if (interaction.customId.startsWith('ai_choice_')) {
                return await handleAIChoice(interaction, client);
            }

            if (interaction.customId.startsWith('ai_toggle_voice_')) {
                return await handleAIVoiceToggle(interaction, client);
            }

        } catch (error) {
            logger.consoleLog('error', `Erro ao processar botão (${interaction.customId}): ${error.message}`);
        }
    }

    // --- 3b. Select Menus ---
    if (interaction.isStringSelectMenu()) {
        try {
            const categoryValue = interaction.values[0];
            if (interaction.customId === 'ticket_select_open' || interaction.customId === 'select_ticket_type') {
                return await handleTicketOpen(interaction, client, categoryValue);
            }
            await interaction.deferUpdate().catch(() => {});
        } catch (error) {
            logger.consoleLog('error', `Erro ao processar select menu (${interaction.customId}): ${error.message}`);
        }
    }

    // --- 4. Modals ---
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        const guildId = interaction.guildId;

        if (customId === 'recruitment_modal_1') return await handleModal1(interaction);
        if (customId === 'recruitment_modal_2') return await handleModal2(interaction);

        if (customId.startsWith('staffModal_')) {
            const config = getStaffConfig(guildId);
            if (!config || !config.log_channel_id) return interaction.reply({ content: '❌ Canal de log não configurado.', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            const userId = interaction.fields.getTextInputValue('userIdInput');
            const justification = interaction.fields.getTextInputValue('justificationInput');

            try {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) return interaction.editReply({ content: `❌ Usuário não encontrado.` });

                const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                let actionType = '', success = false, logMessage = '';

                if (customId.includes(ADD_STAFF_ID)) {
                    actionType = 'Contratação';
                    const staffRoleInput = interaction.fields.getTextInputValue('staffRoleInput');
                    const staffRole = interaction.guild.roles.cache.get(staffRoleInput);
                    if (!staffRole) return interaction.editReply({ content: `❌ Cargo não encontrado.` });
                    await member.roles.add(staffRole.id);
                    success = addManagedStaff(guildId, userId, staffRole.id, interaction.user.id);
                    logMessage = `✅ **NOVO STAFF**\n**Membro:** ${member.user}\n**Cargo:** ${staffRole}\n**Por:** ${interaction.user}\n**Motivo:** ${justification}`;
                } else {
                    actionType = 'Demissão';
                    success = removeManagedStaff(guildId, userId);
                    const staffConfig = getStaffConfig(guildId);
                    if (staffConfig?.staff_role_ids) {
                        const rolesToRemove = staffConfig.staff_role_ids.filter(id => member.roles.cache.has(id));
                        if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
                    }
                    logMessage = `❌ **STAFF DEMITIDO**\n**Membro:** ${member.user}\n**Por:** ${interaction.user}\n**Motivo:** ${justification}`;
                }

                if (success) {
                    forceStaffPanelUpdate(guildId);
                    await logChannel.send({ embeds: [new EmbedBuilder().setColor(actionType === 'Contratação' ? 0x00FF00 : 0xFF0000).setTitle(`${actionType} de Staff`).setDescription(logMessage).setTimestamp()] });
                    return interaction.editReply({ content: `✅ ${actionType} registrada!` });
                }
                return interaction.editReply({ content: `⚠️ Ação não realizada.` });
            } catch (error) {
                return interaction.editReply({ content: `❌ Erro: ${error.message}` });
            }
        }

        try {
            if (interaction.customId.startsWith('rating_comment_')) return await handleRatingComment(interaction, client);
        } catch (error) {
            logger.consoleLog('error', `Erro ao processar modal (${interaction.customId}): ${error.message}`);
        }
    }
  }
};
