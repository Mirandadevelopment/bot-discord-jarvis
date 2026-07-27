const axios = require('axios');

/**
 * Consulta o status de um servidor FiveM.
 * @param {string} ip O endereço IP do servidor.
 * @param {number} port A porta do servidor.
 * @returns {Promise<{status: 'Online' | 'Offline', players: number, maxPlayers: number, connect: string} | null>}
 */
async function getFiveMStatus(ip, port = 30120) {
    const serverAddress = `${ip}:${port}`;
    const connectAddress = `connect ${ip}`; // Formato de conexão FiveM

    try {
        // 1. Obter informações do servidor (inclui maxPlayers)
        const infoUrl = `http://${serverAddress}/info.json`;
        const infoResponse = await axios.get(infoUrl, { timeout: 10000 });
        const maxPlayers = infoResponse.data.vars.sv_maxClients || 0;

        // 2. Obter a lista de jogadores (para contar os jogadores online)
        const playersUrl = `http://${serverAddress}/players.json`;
        const playersResponse = await axios.get(playersUrl, { timeout: 10000 });
        const players = playersResponse.data.length;

        return {
            status: 'Online',
            players: players,
            maxPlayers: maxPlayers,
            connect: connectAddress
        };

    } catch (error) {
        // Se a requisição falhar, o servidor é considerado offline.
        // console.error(`Erro ao consultar FiveM API para ${serverAddress}:`, error.message);
        return {
            status: 'Offline',
            players: 0,
            maxPlayers: 0,
            connect: connectAddress
        };
    }
}

module.exports = { getFiveMStatus };
