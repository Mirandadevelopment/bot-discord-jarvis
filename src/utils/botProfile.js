const axios = require('axios');
const logger = require('./system-logs');

/**
 * Converte uma URL de imagem em uma string Base64 Data URI.
 * @param {string} url URL da imagem.
 * @returns {Promise<string>} Data URI Base64.
 */
async function urlToBase64(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer'
        });

        const contentType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        logger.consoleLog('error', `Erro ao converter URL para Base64: ${error.message}`);
        throw new Error('Não foi possível buscar ou converter a imagem. Verifique a URL.');
    }
}

/**
 * Atualiza o nome de usuário e/ou o avatar do bot.
 * @param {Client} client O cliente Discord.
 * @param {string} newUsername Novo nome de usuário (opcional).
 * @param {string} newAvatarUrl Nova URL do avatar (opcional).
 * @param {string} newBannerUrl Nova URL do banner (opcional).
 */
async function updateBotProfile(client, newUsername, newAvatarUrl, newBannerUrl) {
    let successMessage = '';

    // 1. Atualizar Nome de Usuário
    if (newUsername) {
        try {
            await client.user.setUsername(newUsername);
            successMessage += `✅ Nome de usuário atualizado para **${newUsername}**.\n`;
        } catch (error) {
            logger.consoleLog('error', `Erro ao atualizar nome de usuário: ${error.message}`);
            // O Discord tem limite de 2 mudanças de nome por hora
            successMessage += `❌ Erro ao atualizar nome de usuário: ${error.message}. (Limite de taxa do Discord?)\n`;
        }
    }

    // 2. Atualizar Avatar
    if (newAvatarUrl) {
        try {
            const base64Avatar = await urlToBase64(newAvatarUrl);
            await client.user.setAvatar(base64Avatar);
            successMessage += `✅ Avatar atualizado com sucesso.\n`;
        } catch (error) {
            logger.consoleLog('error', `Erro ao atualizar avatar: ${error.message}`);
            successMessage += `❌ Erro ao atualizar avatar: ${error.message}. (Verifique a URL ou o limite de taxa do Discord?)\n`;
        }
    }

    // 3. Atualizar Banner
    if (newBannerUrl) {
        try {
            const base64Banner = await urlToBase64(newBannerUrl);
            // A API do Discord.js não tem um método setBanner direto no client.user
            // Precisamos usar a API REST diretamente.
            // No entanto, a forma mais simples e suportada é usando client.user.edit()
            await client.user.edit({ banner: base64Banner });
            successMessage += `✅ Banner atualizado com sucesso.\n`;
        } catch (error) {
            logger.consoleLog('error', `Erro ao atualizar banner: ${error.message}`);
            successMessage += `❌ Erro ao atualizar banner: ${error.message}. (O bot precisa ser verificado e ter o Perfil Aprimorado ativado para isso funcionar).\n`;
        }
    }

    if (!newUsername && !newAvatarUrl && !newBannerUrl) {
        return 'Nenhuma alteração solicitada.';
    }

    return successMessage;
}

module.exports = {
    updateBotProfile
};
