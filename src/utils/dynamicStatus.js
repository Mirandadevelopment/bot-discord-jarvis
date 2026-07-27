const { ActivityType } = require('discord.js');
const { 
    getTotalTicketsAtendidosGlobal, 
    getTotalWhitelistsAprovadasGlobal, 
    getMediaAvaliacoesGlobal 
} = require('./database');
const logger = require('./system-logs');

// Configurações do criador
const CREATOR_NAME = 'Miranda Developement';
const CREATOR_DISCORD = 'mirandadeveloper';

/**
 * Alterna o status do bot a cada 15 segundos.
 * @param {Client} client O cliente Discord.
 */
function startDynamicStatus(client) {
    logger.consoleLog('info', '🔄 Iniciando alternância de status dinâmico...');

    // Array de status (funções que retornam o objeto de status)
    const statusList = [
        // 1. Total de Membros
        () => ({
            name: `${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} Membros`,
            type: ActivityType.Watching,
            status: 'online'
        }),
        // 2. Total de Servidores
        () => ({
            name: `${client.guilds.cache.size} Servidores`,
            type: ActivityType.Watching,
            status: 'online'
        }),
        // 3. Tickets Atendidos
        () => {
            const totalTickets = getTotalTicketsAtendidosGlobal();
            return {
                name: `${totalTickets} Tickets Atendidos`,
                type: ActivityType.Playing,
                status: 'online'
            };
        },
        // 4. Whitelists Aprovadas
        () => {
            const totalWhitelists = getTotalWhitelistsAprovadasGlobal();
            return {
                name: `${totalWhitelists} Whitelists Aprovadas`,
                type: ActivityType.Playing,
                status: 'online'
            };
        },
        // 5. Média de Avaliações
        () => {
            const media = getMediaAvaliacoesGlobal();
            return {
                name: `⭐ Média: ${media}/5.0`,
                type: ActivityType.Listening,
                status: 'online'
            };
        },
        // 6. By Miranda Developer
        () => ({
            name: `By ${CREATOR_DISCORD} ❤️`,
            type: ActivityType.Watching,
            status: 'online'
        }),
        // 7. Nome do Criador
        () => ({
            name: `Criado por ${CREATOR_NAME}`,
            type: ActivityType.Watching,
            status: 'online'
        })
    ];

    let currentStatusIndex = 0;

    const updateStatus = () => {
        const statusFunction = statusList[currentStatusIndex];
        const statusObject = statusFunction();

        client.user.setPresence({
            activities: [{
                name: statusObject.name,
                type: statusObject.type
            }],
            status: statusObject.status
        });

        logger.consoleLog('debug', `Status atualizado para: ${statusObject.name}`);

        // Avança para o próximo status
        currentStatusIndex = (currentStatusIndex + 1) % statusList.length;
    };

    // Atualiza imediatamente e depois a cada 15 segundos (15000ms)
    updateStatus();
    setInterval(updateStatus, 15000);
}

module.exports = {
    startDynamicStatus
};
