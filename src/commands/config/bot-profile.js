const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateBotProfile } = require('../../utils/botProfile');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/system-logs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-profile')
        .setDescription('Configura o nome de usuário e o avatar do bot (Apenas para o servidor atual)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('nome')
                .setDescription('Novo nome de usuário do bot (limite de 2 mudanças por hora)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('avatar_url')
                .setDescription('URL da nova imagem de perfil do bot')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('banner_url')
                .setDescription('URL do novo banner do perfil do bot (Requer bot verificado)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const newUsername = interaction.options.getString('nome');
            const newAvatarUrl = interaction.options.getString('avatar_url');
            const newBannerUrl = interaction.options.getString('banner_url');

            if (!newUsername && !newAvatarUrl && !newBannerUrl) {
                return await interaction.editReply({
                    embeds: [errorEmbed('Erro', 'Você deve fornecer um novo nome, uma URL de avatar ou uma URL de banner.')],
                    ephemeral: true
                });
            }

            // Valida URLs se fornecidas
            const urlsToValidate = [newAvatarUrl, newBannerUrl].filter(url => url);
            for (const url of urlsToValidate) {
                try {
                    new URL(url);
                } catch {
                    return await interaction.editReply({
                        embeds: [errorEmbed('Erro', `URL inválida: ${url}. Forneça uma URL válida de imagem.`)],
                        ephemeral: true
                    });
                }
            }

            const result = await updateBotProfile(client, newUsername, newAvatarUrl, newBannerUrl);

            const embed = successEmbed(
                'Perfil do Bot Atualizado',
                `As seguintes alterações foram aplicadas:\n\n${result}\n\n**Atenção:** O Discord limita a mudança de nome de usuário a 2 vezes por hora.`
            );

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            logger.logAction(
                client,
                interaction.guildId,
                'Bot Profile Update',
                interaction.user.tag,
                `Nome: ${newUsername || 'N/A'}, Avatar: ${newAvatarUrl ? 'Sim' : 'Não'}, Banner: ${newBannerUrl ? 'Sim' : 'Não'}`
            );

        } catch (error) {
            logger.consoleLog('error', `Erro no comando bot-profile: ${error.message}`);
            console.error(error);
            await interaction.editReply({
                embeds: [errorEmbed('Erro', `Ocorreu um erro ao configurar o perfil do bot. Detalhes: ${error.message}`)],
                ephemeral: true
            }).catch(() => {});
        }
    }
};
