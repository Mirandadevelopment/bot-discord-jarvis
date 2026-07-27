const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getRecruitmentConfig } = require('../utils/database');
const logger = require('../utils/system-logs');

/**
 * Inicia o formulário de recrutamento (abre o modal com as primeiras perguntas)
 */
async function startRecruitment(interaction) {
    const config = getRecruitmentConfig(interaction.guildId);
    if (!config || !config.enabled) {
        return interaction.reply({ content: '❌ O sistema de recrutamento está desativado no momento.', ephemeral: true });
    }

    // Como o Discord limita a 5 campos por modal, vamos dividir em 2 partes ou usar uma abordagem simplificada.
    // Para 10 perguntas, o ideal seria um sistema de mensagens sequenciais ou 2 modais.
    // Vamos usar 2 modais: o primeiro abre agora, e o segundo abre após o envio do primeiro.
    
    const modal = new ModalBuilder()
        .setCustomId('recruitment_modal_1')
        .setTitle('Recrutamento Staff - Parte 1/2');

    const rows = [];
    // Primeiras 5 perguntas
    for (let i = 0; i < 5; i++) {
        const question = config.questions[i];
        const input = new TextInputBuilder()
            .setCustomId(`q_${i}`)
            .setLabel(question.substring(0, 45))
            .setPlaceholder('Responda aqui...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        
        rows.push(new ActionRowBuilder().addComponents(input));
    }

    modal.addComponents(rows);
    await interaction.showModal(modal);
}

/**
 * Lida com o envio do primeiro modal e abre o segundo
 */
async function handleModal1(interaction) {
    const config = getRecruitmentConfig(interaction.guildId);
    
    // Armazena as respostas temporariamente (em um Map ou no próprio objeto client)
    if (!interaction.client.recruitmentCache) interaction.client.recruitmentCache = new Map();
    
    const answers = [];
    for (let i = 0; i < 5; i++) {
        answers.push(interaction.fields.getTextInputValue(`q_${i}`));
    }
    
    interaction.client.recruitmentCache.set(interaction.user.id, answers);

    const modal = new ModalBuilder()
        .setCustomId('recruitment_modal_2')
        .setTitle('Recrutamento Staff - Parte 2/2');

    const rows = [];
    // Próximas 5 perguntas
    for (let i = 5; i < 10; i++) {
        const question = config.questions[i];
        const input = new TextInputBuilder()
            .setCustomId(`q_${i}`)
            .setLabel(question.substring(0, 45))
            .setPlaceholder('Responda aqui...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        
        rows.push(new ActionRowBuilder().addComponents(input));
    }

    modal.addComponents(rows);
    await interaction.showModal(modal);
}

/**
 * Lida com o envio do segundo modal e finaliza o formulário
 */
async function handleModal2(interaction) {
    const config = getRecruitmentConfig(interaction.guildId);
    const cache = interaction.client.recruitmentCache;
    
    if (!cache.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ Ocorreu um erro ao processar suas respostas. Tente novamente.', ephemeral: true });
    }

    const answersPart1 = cache.get(interaction.user.id);
    const answersPart2 = [];
    for (let i = 5; i < 10; i++) {
        answersPart2.push(interaction.fields.getTextInputValue(`q_${i}`));
    }
    
    const allAnswers = [...answersPart1, ...answersPart2];
    cache.delete(interaction.user.id); // Limpa o cache

    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
    if (!logChannel) {
        return interaction.reply({ content: '❌ Erro: Canal de logs não encontrado. Avise a administração.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('📝 Novo Formulário de Recrutamento')
        .setColor(0x3498db)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(`**Candidato:** ${interaction.user} (${interaction.user.tag})\n**ID:** \`${interaction.user.id}\``)
        .setTimestamp();

    // Adiciona as perguntas e respostas ao embed
    for (let i = 0; i < 10; i++) {
        embed.addFields({ name: `${i + 1}. ${config.questions[i]}`, value: allAnswers[i] || 'Sem resposta' });
    }

    await logChannel.send({ 
        content: config.staff_role_id ? `<@&${config.staff_role_id}>` : null,
        embeds: [embed] 
    });

    await interaction.reply({ content: '✅ Seu formulário foi enviado com sucesso! Nossa equipe irá analisar e entrará em contato se for selecionado.', ephemeral: true });
    
    logger.consoleLog('info', `Formulário de recrutamento enviado por ${interaction.user.tag} em ${interaction.guild.name}`);
}

module.exports = {
    startRecruitment,
    handleModal1,
    handleModal2
};
