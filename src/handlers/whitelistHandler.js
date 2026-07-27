const { PermissionFlagsBits, ChannelType } = require('discord.js');
const mysql = require('mysql2/promise');
const {
  getWhitelistConfig,
  createPendingWhitelist,
  getPendingWhitelistByChannel,
  updatePendingWhitelist
} = require('../utils/database');
const {
  whitelistApprovedEmbed,
  whitelistRejectedEmbed,
  errorEmbed,
  successEmbed
} = require('../utils/embeds');
const { whitelistStartedEmbedDynamic } = require('../utils/dynamicEmbeds');
const logger = require('../utils/system-logs');

/**
 * Cria conexão com MySQL usando configurações do servidor
 */
async function getMySQLConnection(config) {
  if (!config || !config.mysql_host) {
    throw new Error('Configuração de banco de dados MySQL não encontrada. Use `/whitelist database` para configurar.');
  }

  return await mysql.createConnection({
    host: config.mysql_host,
    user: config.mysql_user,
    password: config.mysql_password,
    database: config.mysql_database,
    port: config.mysql_port || 3306
  });
}

/**
 * Valida formato do ID baseado no tipo configurado
 */
function isValidIdFormat(id, idType) {
  const trimmedId = id.trim();
  
  if (idType === 'numeric') {
    // Verifica se é um número e se é positivo
    return /^\d+$/.test(trimmedId) && parseInt(trimmedId) > 0;
  } else if (idType === 'steam') {
    // Verifica formato Steam ID (steam:XXXXXXXXXXXXX)
    return /^steam:[0-9a-fA-F]{15}$/.test(trimmedId);
  }
  
  return false;
}

/**
 * Verifica se ID existe no banco (consulta dinâmica baseada na configuração)
 */
async function checkIdInDatabase(connection, id, config) {
  try {
    const tableName = config.db_table_name || 'accounts';
    const idType = config.db_id_type || 'numeric';
    const idColumn = idType === 'numeric' ? (config.db_id_column || 'id') : (config.db_steam_column || 'steam');
    const whitelistColumn = config.db_whitelist_column || 'whitelist';
    
    // Query dinâmica
    const query = `SELECT * FROM ${tableName} WHERE ${idColumn} = ?`;
    const [rows] = await connection.execute(query, [id.trim()]);
    
    if (rows.length > 0) {
      return {
        ...rows[0],
        _whitelist_value: rows[0][whitelistColumn]
      };
    }
    
    return null;
  } catch (error) {
    logger.consoleLog('error', `Erro ao verificar ID no banco: ${error.message}`);
    throw error;
  }
}

/**
 * Aprova whitelist no banco de dados (update dinâmico)
 */
async function approveWhitelist(connection, id, config) {
  try {
    const tableName = config.db_table_name || 'accounts';
    const idType = config.db_id_type || 'numeric';
    const idColumn = idType === 'numeric' ? (config.db_id_column || 'id') : (config.db_steam_column || 'steam');
    const whitelistColumn = config.db_whitelist_column || 'whitelist';
    
    // Query dinâmica
    const query = `UPDATE ${tableName} SET ${whitelistColumn} = 1 WHERE ${idColumn} = ?`;
    await connection.execute(query, [id.trim()]);
  } catch (error) {
    logger.consoleLog('error', `Erro ao aprovar whitelist: ${error.message}`);
    throw error;
  }
}

/**
 * Atribui cargos ao usuário aprovado
 */
async function assignRoles(member, config) {
  try {
    // Remove o cargo de visitante se configurado
    if (config.visitor_role_id) { 
      const visitorRole = member.guild.roles.cache.get(config.visitor_role_id);
      if (visitorRole && member.roles.cache.has(visitorRole.id)) {
        await member.roles.remove(visitorRole);
      }
    }
    
    // Remove cargo pendente se existir
    if (config.pending_role_id) {
      const pendingRole = member.guild.roles.cache.get(config.pending_role_id);
      if (pendingRole && member.roles.cache.has(pendingRole.id)) {
        await member.roles.remove(pendingRole);
      }
    }

    // Adiciona cargo aprovado
    if (config.approved_role_id) {
      const approvedRole = member.guild.roles.cache.get(config.approved_role_id);
      if (approvedRole) {
        await member.roles.add(approvedRole);
      }
    }
  } catch (error) {
    logger.consoleLog('error', `Erro ao atribuir cargos: ${error.message}`);
  }
}

/**
 * Envia notificação de aprovação
 */
async function sendApprovalNotification(guild, config, user, userInput, displayId) { 
  try {
    if (!config.approval_channel_id) return;

    const channel = guild.channels.cache.get(config.approval_channel_id);
    if (!channel) return;

    const idType = config.db_id_type || 'numeric';
    const idTypeLabel = idType === 'numeric' ? 'ID Numérico' : 'Steam ID';

    const embed = successEmbed(
      '✅ Nova Whitelist Aprovada',
      `**Usuário:** ${user}\n` +
      `**${idTypeLabel} Informado:** \`${userInput}\`\n` +
      `**ID de Exibição:** \`${displayId}\`\n` +
      `**Data:** ${new Date().toLocaleString('pt-BR')}`
    );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.consoleLog('error', `Erro ao enviar notificação: ${error.message}`);
  }
}

/**
 * Handler do botão de iniciar whitelist
 */
async function handleWhitelistButton(interaction, client, isAI = false) {
  try {
    if (!isAI) {
      await interaction.deferReply({ ephemeral: true });
    }

    const config = getWhitelistConfig(interaction.guildId);
    if (!config || !config.category_id) {
      return await interaction.editReply({
        embeds: [errorEmbed('Erro', 'Sistema de whitelist não configurado. Peça a um administrador para usar `/whitelist setup`.')],
        ephemeral: true
      });
    }

    // Verifica se já tem canal aberto
    const existingChannel = interaction.guild.channels.cache.find(
      c => c.name === `whitelist-${interaction.user.username.toLowerCase()}` && c.parentId === config.category_id
    );

    if (existingChannel) {
      return await interaction.editReply({
        content: `Você já tem um canal de whitelist aberto: ${existingChannel}`,
        ephemeral: true
      });
    }

    // Cria canal privado
    const channel = await interaction.guild.channels.create({
      name: `whitelist-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: config.category_id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });

    // Registra no banco
    createPendingWhitelist(interaction.guildId, interaction.user.id, channel.id);

    // Envia mensagem inicial
    await channel.send({
      content: `${interaction.user}`,
      embeds: [whitelistStartedEmbedDynamic(interaction.user, interaction.guildId)]
    });

    await interaction.editReply({
      content: `Canal de whitelist criado: ${channel}\n\nO bot agora continuará o atendimento lá.`,
      components: [],
      ephemeral: true
    });

    // Se for via IA, atualiza a conversa
    const { getActiveAIConversation, updateAIConversation } = require('../utils/database');
    const conversation = getActiveAIConversation(interaction.guildId, interaction.user.id);
    if (conversation) {
        updateAIConversation(conversation.id, { 
            status: 'closed', 
            associated_channel_id: channel.id,
            current_state: { step: 'completed', result: 'whitelist_opened', channel_id: channel.id }
        });
    }

    logger.logAction(client, interaction.guildId, 'Whitelist iniciada', interaction.user.tag);

  } catch (error) {
    logger.consoleLog('error', `Erro ao criar canal de whitelist: ${error.message}`);
    await interaction.editReply({
      embeds: [errorEmbed('Erro', 'Não foi possível criar o canal de whitelist. Tente novamente.')],
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * Handler de mensagens no canal de whitelist
 */
async function handleWhitelistMessage(message, client, pendingWhitelist) {
  const config = getWhitelistConfig(message.guildId);
  if (!config) return;

  const userInput = message.content.trim();
  const idType = config.db_id_type || 'numeric';
  const idTypeLabel = idType === 'numeric' ? 'ID Numérico' : 'Steam ID';
  const exampleFormat = idType === 'numeric' ? '2010' : 'steam:11000013c14b01f';

  // Valida formato
  if (!isValidIdFormat(userInput, idType)) {
    return await message.reply({
      embeds: [errorEmbed(
        'Formato Inválido',
        `O ${idTypeLabel} deve estar no formato correto (Ex: \`${exampleFormat}\`).\n\nPor favor, envie novamente no formato correto.`
      )]
    });
  }

  try {
    // Conecta ao MySQL
    const connection = await getMySQLConnection(config);

    // Verifica no banco
    const userData = await checkIdInDatabase(connection, userInput, config);

    if (!userData) {
      await connection.end();
      return await message.reply({
        embeds: [whitelistRejectedEmbed(`${idTypeLabel} não encontrado no banco de dados. Verifique se você digitou corretamente.`)]
      });
    }

    // Verifica se já está aprovado
    if (userData._whitelist_value === 1) {
      await connection.end();
      await message.reply({
        embeds: [errorEmbed('Já Aprovado', `Este ${idTypeLabel} já possui whitelist aprovada!`)]
      });

      // Deleta canal após 5 segundos
      setTimeout(async () => {
        await message.channel.delete().catch(() => {});
      }, 5000);

      return;
    }

    // Aprova whitelist
    await approveWhitelist(connection, userInput, config);
    await connection.end();

    // Determina o ID de exibição (para nickname)
    const displayIdColumn = config.db_id_column || 'id';
    const displayId = userData[displayIdColumn];

    // Atualiza registro local
    updatePendingWhitelist(pendingWhitelist.id, {
      steam_id: userInput, 
      status: 'approved'
    });

    // IA: Analisa o encerramento para aprendizado
    const { getActiveAIConversation } = require('../utils/database');
    const learningModule = require('../utils/learningModule');
    const conversation = getActiveAIConversation(message.guildId, message.author.id);
    if (conversation) {
        learningModule.analyzeConversation(conversation.id);
    }

    // Atribui cargos
    const member = message.guild.members.cache.get(message.author.id);
    if (member) {
      await assignRoles(member, config);

      // Adiciona o ID ao apelido/nome de exibição
      try {
        const newNickname = `${member.displayName} #${displayId}`; 
        
        // Verifica o limite de caracteres do Discord (32)
        if (newNickname.length > 32) {
          await member.setNickname(newNickname.substring(0, 32));
          logger.consoleLog('warning', `Nickname muito longo para ${message.author.tag} e foi truncado.`);
        } else {
          await member.setNickname(newNickname);
        }

      } catch (error) {
        logger.consoleLog('warning', `Não foi possível alterar nickname para ${message.author.tag}: ${error.message}. Verifique as permissões do bot.`);
      }
    }

    // Envia mensagem de aprovação 
    await message.channel.send({
      embeds: [whitelistApprovedEmbed(message.author, displayId)]
    });

    // Envia DM
    try {
      await message.author.send({
        embeds: [whitelistApprovedEmbed(message.author, displayId)]
      });
    } catch (error) {
      logger.consoleLog('warning', `Não foi possível enviar DM: ${error.message}`);
    }

    // Notifica canal de aprovação
    await sendApprovalNotification(message.guild, config, message.author, userInput, displayId);

    // Log
    logger.logWhitelist(client, message.guildId, message.author, userInput, 'approved');

    // Deleta canal após 10 segundos
    setTimeout(async () => {
      await message.channel.delete().catch(() => {});
    }, 10000);

  } catch (error) {
    logger.consoleLog('error', `Erro ao processar whitelist: ${error.message}`);
    await message.reply({
      embeds: [errorEmbed('Erro', 'Ocorreu um erro ao processar sua whitelist. Tente novamente ou contate um administrador.')]
    });
  }
}

module.exports = {
  handleWhitelistButton,
  handleWhitelistMessage
};
