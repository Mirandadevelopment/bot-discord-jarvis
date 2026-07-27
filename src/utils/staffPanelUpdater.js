const { EmbedBuilder, ChannelType } = require('discord.js');
const { getStaffConfig, getManagedStaff, getAllStaffConfigs } = require('./staffDatabase');
const logger = require('./system-logs');

let client;

/**
 * Define o objeto client do Discord.js.
 * @param {Client} discordClient O cliente do Discord.js.
 */
function setClient(discordClient) {
    client = discordClient;
}

/**
 * Gera o Embed para o painel de staff.
 * @param {Guild} guild O objeto Guild.
 * @param {Array<object>} managedStaff A lista de membros da staff gerenciados.
 * @param {Array<string>} staffRoleIds Os IDs dos cargos de staff configurados.
 * @returns {EmbedBuilder} O Embed do painel.
 */
function generateStaffPanelEmbed(guild, managedStaff, staffRoleIds) {
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`📋 Painel de Hierarquia da Staff - ${guild.name}`)
        .setDescription('Esta lista é atualizada automaticamente e contém todos os membros da nossa equipe de Staff.')
        .setTimestamp();

    if (!staffRoleIds || staffRoleIds.length === 0) {
        embed.addFields({
            name: '⚠️ Configuração Pendente',
            value: 'Nenhum cargo de Staff foi configurado. Use o comando `/staff config` para configurar os cargos que compõem a Staff.'
        });
        return embed;
    }

    // 1. Coletar todos os membros que possuem pelo menos um dos cargos de staff configurados
    const staffMembers = guild.members.cache.filter(member => 
        staffRoleIds.some(roleId => member.roles.cache.has(roleId))
    );

    // 2. Agrupar os membros por cargo (o cargo mais alto na hierarquia configurada)
    const staffByRole = new Map();
    
    // Mapear cargos configurados para seus objetos Role e ordenar por posição (do mais alto para o mais baixo)
    const roles = staffRoleIds
        .map(id => guild.roles.cache.get(id))
        .filter(role => role)
        .sort((a, b) => b.position - a.position);

    for (const role of roles) {
        staffByRole.set(role.id, { role, members: [] });
    }

    // Adicionar membros ao cargo mais alto que eles possuem na lista configurada
    staffMembers.forEach(member => {
        for (const role of roles) {
            if (member.roles.cache.has(role.id)) {
                staffByRole.get(role.id).members.push(member);
                break; // Adiciona ao cargo mais alto e passa para o próximo membro
            }
        }
    });

    // 3. Construir o campo de hierarquia
    let totalStaff = 0;
    let description = '';

    for (const [roleId, data] of staffByRole) {
        const { role, members } = data;
        if (members.length > 0) {
            const memberList = members.map(member => `${member.user}`).join(', ');
            
            // Mencionar o cargo e os membros
            description += `\n**${role}** (${members.length} Membros):\n${memberList}\n`;
            totalStaff += members.length;
        }
    }

    if (totalStaff === 0) {
        description = 'Nenhum membro da Staff encontrado com os cargos configurados.';
    }

    embed.setDescription(description);
    embed.setFooter({ text: `Total de Staff: ${totalStaff} | Última Atualização:` });

    return embed;
}

/**
 * Atualiza o painel de staff em uma guilda específica.
 * @param {string} guildId O ID da guilda.
 */
async function updateStaffPanel(guildId) {
    if (!client) {
        logger.consoleLog('error', 'Client não definido em staffPanelUpdater.');
        return;
    }

    const config = getStaffConfig(guildId);
    if (!config || !config.public_panel_channel_id || !config.public_panel_message_id) {
        // Painel não configurado
        return;
    }

    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            logger.consoleLog('warning', `Guilda ${guildId} não encontrada para atualização do painel de staff.`);
            return;
        }

        const channel = guild.channels.cache.get(config.public_panel_channel_id);
        if (!channel || channel.type !== ChannelType.GuildText) {
            logger.consoleLog('warning', `Canal de painel de staff inválido ou não encontrado em ${guild.name}.`);
            return;
        }

        const message = await channel.messages.fetch(config.public_panel_message_id).catch(() => null);
        if (!message) {
            logger.consoleLog('warning', `Mensagem de painel de staff não encontrada em ${channel.name} (${guild.name}).`);
            // Opcional: Limpar a config do message_id aqui se a mensagem não existir
            return;
        }

        // A lista de managedStaff não é usada diretamente no painel público, mas a lógica
        // do painel público deve refletir a hierarquia de cargos.
        // A lista managedStaff será usada apenas para o painel de controle (adicionar/remover).
        const managedStaff = getManagedStaff(guildId); 
        const embed = generateStaffPanelEmbed(guild, managedStaff, config.staff_role_ids);

        await message.edit({ embeds: [embed] });
        logger.consoleLog('success', `Painel de staff atualizado com sucesso em ${guild.name}.`);

    } catch (error) {
        logger.consoleLog('error', `Erro ao atualizar painel de staff para ${guildId}: ${error.message}`);
    }
}

/**
 * Inicia o loop de atualização periódica dos painéis de staff.
 * @param {Client} discordClient O cliente do Discord.js.
 */
function startStaffPanelUpdaterLoop(discordClient) {
    setClient(discordClient);
    
    // Executa a primeira atualização imediatamente para todas as guildas configuradas
    const configs = getAllStaffConfigs();
    configs.forEach(config => {
        if (config.public_panel_channel_id && config.public_panel_message_id) {
            updateStaffPanel(config.guild_id);
        }
    });

    // Configura o loop de atualização a cada 1 minuto (60000ms)
    // Mantém consistência com os outros painéis do bot
    setInterval(() => {
        const allConfigs = getAllStaffConfigs();
        allConfigs.forEach(config => {
            if (config.public_panel_channel_id && config.public_panel_message_id) {
                updateStaffPanel(config.guild_id);
            }
        });
    }, 60000); // 1 minuto
    
    logger.consoleLog('info', 'Loop de atualização do painel de staff iniciado (intervalo: 1 minuto).');
}

/**
 * Função para ser chamada quando um membro da staff é adicionado/removido
 * para forçar a atualização imediata do painel.
 * @param {string} guildId O ID da guilda.
 */
function forceStaffPanelUpdate(guildId) {
    if (client) {
        updateStaffPanel(guildId);
    }
}

module.exports = {
    setClient,
    startStaffPanelUpdaterLoop,
    forceStaffPanelUpdate,
    generateStaffPanelEmbed
};
