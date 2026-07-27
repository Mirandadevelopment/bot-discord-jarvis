const { 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { 
    getTicketConfig, 
    getTicketCategories, 
    createTicket, 
    getTicketByChannel, 
    closeTicket,
    getTicketRating,
    saveTicketRating,
    claimTicket,
    getTicketById 
} = require('../utils/database');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const logger = require('../utils/system-logs');
const { createTranscript } = require('discord-html-transcripts'); 

/**
 * Encontra a categoria de ticket pelo valor (name em minúsculas com _).
 * Tenta múltiplas lógicas de sanitização para garantir o match,
 * lidando com acentos, espaços e caracteres especiais.
 * @param {string} guildId 
 * @param {string} categoryValue 
 * @returns {object | null}
 */
function getCategoryByValue(guildId, categoryValue) {
    const categories = getTicketCategories(guildId);
    
    // Funções de sanitização
    // 1. Sanitização SIMPLES: Apenas lowercase e substitui espaços por _ (mantém acentos e emojis)
    const simpleSanitize = (text) => text.toLowerCase().replace(/\s+/g, '_');

    // 2. Sanitização AGRESSIVA: Remove acentos e caracteres especiais (limpa para ASCII puro)
    const aggressiveSanitize = (text) => text.toLowerCase()
        .replace(/\s+/g, '_')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9_]/g, ''); // Remove caracteres especiais/emojis

    // --- TENTATIVA 1: Simples Match (Funciona se o valor de interação MANTÉM acentos) ---
    // Verifica se o valor (categoryValue) corresponde à versão simples do nome do DB.
    let foundCategory = categories.find(cat => 
        simpleSanitize(cat.name) === categoryValue
    );

    if (foundCategory) return foundCategory;
    
    // --- TENTATIVA 2: Agressiva Match (A mais robusta, funciona se o valor de interação REMOVE acentos) ---
    // Sanitiza ambos os lados (DB Name e Valor de Entrada) agressivamente antes de comparar.
    const aggressiveCategoryValue = aggressiveSanitize(categoryValue);
    
    foundCategory = categories.find(cat => 
        aggressiveSanitize(cat.name) === aggressiveCategoryValue
    );
    
    return foundCategory || null;
}

// --- Funções de Abertura (Mantidas) ---

async function handleTicketOpen(interaction, client, categoryValue, isAI = false) {
    if (!isAI) {
        await interaction.deferReply({ ephemeral: true });
    }

    const config = getTicketConfig(interaction.guildId);
    if (!config || !config.category_id || !config.staff_role_id) {
        return await interaction.editReply({ 
            embeds: [errorEmbed('Erro de Configuração', 'O sistema de tickets não está totalmente configurado. Contate um administrador.')]
        });
    }

    const category = getCategoryByValue(interaction.guildId, categoryValue);
    if (!category) {
        return await interaction.editReply({ 
            embeds: [errorEmbed('Erro', 'Categoria de ticket não encontrada. Verifique a configuração com `/ticket-category list`.')] 
        });
    }

    const userTickets = client.tickets.get(interaction.user.id);
    if (userTickets && userTickets.size > 0) {
        const firstTicketChannelId = userTickets.keys().next().value;
        return await interaction.editReply({
            embeds: [errorEmbed('Ticket Já Aberto', `Você já possui um ticket ativo: <#${firstTicketChannelId}>. Feche-o antes de abrir um novo.`)],
        });
    }

    try {
        const channel = await interaction.guild.channels.create({
            name: `${category.name.toLowerCase().replace(/\s/g, '-')}-${interaction.user.username.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
            type: ChannelType.GuildText,
            parent: config.category_id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: config.staff_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
            ],
        });

        const ticketId = createTicket(interaction.guildId, channel.id, interaction.user.id, category.name);
        
        // Adiciona o ticket à coleção de tickets abertos
        if (client.tickets instanceof Map) {
            client.tickets.set(interaction.user.id, new Map([[channel.id, { id: ticketId, user_id: interaction.user.id, category: category.name }]]));
        }

        const initialEmbed = new EmbedBuilder()
            .setTitle(`${category.emoji} Ticket: ${category.name}`)
            .setDescription(
                `Bem-vindo(a) ao seu ticket, ${interaction.user}!\n\n` +
                `**Assunto:** ${category.description}\n\n` +
                `Aguarde, nossa equipe Staff (<@&${config.staff_role_id}>) será notificada e atenderá você em breve.\n` +
                `Para fechar, use o botão "🔒 Fechar Ticket".`
            )
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: `ID do Ticket: #${ticketId} | Criado por: ${interaction.user.tag}` });
        
        const closeButton = new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Fechar Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

        const claimButton = new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Assumir (Claim)')
            .setEmoji('🙋‍♂️')
            .setStyle(ButtonStyle.Secondary);
            
        const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

        await channel.send({
            content: `**<@&${config.staff_role_id}>** | ${interaction.user}`,
            embeds: [initialEmbed],
            components: [row]
        });

        await interaction.editReply({
            embeds: [successEmbed('Ticket Aberto', `Seu ticket foi aberto em ${channel}.\n\nO bot agora continuará o atendimento lá.`)],
            components: []
        });

        // Se for via IA, atualiza a conversa
        const { getActiveAIConversation, updateAIConversation } = require('../utils/database');
        const conversation = getActiveAIConversation(interaction.guildId, interaction.user.id);
        if (conversation) {
            updateAIConversation(conversation.id, { 
                status: 'closed', 
                associated_channel_id: channel.id,
                current_state: { step: 'completed', result: 'ticket_opened', channel_id: channel.id }
            });
        }

        logger.logAction(client, interaction.guildId, 'Ticket Opened', interaction.user.tag, 
            `Canal: ${channel.name}, Categoria: ${category.name}`);

    } catch (error) {
        logger.consoleLog('error', `Erro ao abrir ticket: ${error.message}`);
        await interaction.editReply({ 
            embeds: [errorEmbed('Erro', 'Não foi possível abrir o ticket. Verifique as permissões do bot.')] 
        });
    }
}

// --- Funções de Fechamento (Mantidas) ---

async function handleTicketClose(interaction, client) {
    // Garante que a interação seja respondida imediatamente para evitar o erro 10062 (Unknown interaction)
    if (interaction.isButton() && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(error => {
            if (error.code !== 10062) {
                logger.consoleLog('error', `Erro ao deferReply em handleTicketClose: ${error.message}`);
            }
        });
    }

    // Se o defer não deu certo, evita tentar editReply (causaria outro erro fatal).
    if (!interaction.deferred && !interaction.replied) return;

    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket) {
        return await interaction.editReply({
            embeds: [errorEmbed('Erro', 'Este canal não é um ticket aberto.')],
            ephemeral: true
        }).catch(() => {});
    }

    const config = getTicketConfig(interaction.guildId);
    const isStaff = config && config.staff_role_id && interaction.member.roles.cache.has(config.staff_role_id);
    const isCreator = ticket.user_id === interaction.user.id;
    
    if (!isCreator && !isStaff) {
        return await interaction.editReply({
            embeds: [errorEmbed('Acesso Negado', 'Apenas o criador do ticket ou um membro Staff pode fechar.')],
            ephemeral: true
        }).catch(() => {});
    }
    
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('Confirmação de Fechamento')
            .setDescription('Tem certeza de que deseja fechar este ticket? Esta ação é irreversível.')
            .setColor(0xe74c3c)
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_confirm_close')
                    .setLabel('Confirmar Fechamento')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_cancel_close')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            )
        ],
        ephemeral: true
    }).catch(() => {});
}

async function handleTicketCloseConfirm(interaction, client) {
    // Garante que a interação seja respondida imediatamente para evitar o erro 10062 (Unknown interaction)
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(error => {
            // Ignora o erro 10062 se a interação já expirou, mas registra outros erros
            if (error.code !== 10062) {
                logger.consoleLog('error', `Erro ao deferUpdate em handleTicketCloseConfirm: ${error.message}`);
            }
        });
    }

    // Se o defer/reply não deu certo (ex: interação duplicada, já expirada), não tem
    // como usar editReply mais pra frente — evita o erro "not been sent or deferred".
    const canReplyToInteraction = interaction.deferred || interaction.replied;
    const safeEditReply = async (payload) => {
        if (!canReplyToInteraction) return;
        await interaction.editReply(payload).catch(err => {
            logger.consoleLog('error', `Erro ao editReply em handleTicketCloseConfirm: ${err.message}`);
        });
    };

    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket) {
        return await safeEditReply({
            embeds: [errorEmbed('Erro', 'Este ticket já foi fechado ou é inválido.')],
            components: []
        });
    }

    const config = getTicketConfig(interaction.guildId);

    try {
        await interaction.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🔒 Ticket Fechado')
                    .setDescription(`Este ticket foi fechado por ${interaction.user}.`)
                    .setColor(0xe74c3c)
                    .setTimestamp()
            ]
        });
        
        let transcriptAttachment = null;
        if (config && config.transcript_channel_id) {
            const transcriptChannel = await interaction.guild.channels.fetch(config.transcript_channel_id).catch(() => null);
            if (transcriptChannel) {
                transcriptAttachment = await createTranscript(interaction.channel, {
                    limit: -1,
                    returnBuffer: false,
                    fileName: `ticket-${ticket.id}-${new Date().getTime()}.html`,
                });
                
                const logEmbed = new EmbedBuilder()
                    .setTitle('📄 Transcrição de Ticket')
                    .addFields(
                        { name: 'ID do Ticket', value: `#${ticket.id}`, inline: true },
                        { name: 'Criador', value: `<@${ticket.user_id}>`, inline: true },
                        { name: 'Fechado por', value: `${interaction.user}`, inline: true },
                        { name: 'Categoria', value: ticket.category || 'N/A', inline: true },
                        { name: 'Assumido por', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'N/A', inline: true },
                    )
                    .setColor(0x2980b9)
                    .setTimestamp();
                
                await transcriptChannel.send({
                    embeds: [logEmbed],
                    files: [transcriptAttachment]
                }).catch(err => logger.consoleLog('error', `Erro ao enviar transcrição: ${err.message}`));
            }
        }
        
        closeTicket(interaction.channelId, interaction.user.id);
        
        // IA: Analisa o encerramento para aprendizado
        const { getActiveAIConversation } = require('../utils/database');
        const learningModule = require('../utils/learningModule');
        const conversation = getActiveAIConversation(interaction.guildId, ticket.user_id);
        if (conversation) {
            learningModule.analyzeConversation(conversation.id);
        }

        if (client.tickets instanceof Map && client.tickets.has(ticket.user_id)) {
            client.tickets.delete(ticket.user_id);
        }

        const closedByStaff = config && config.staff_role_id && interaction.member.roles.cache.has(config.staff_role_id);
        const claimedByStaff = ticket.claimed_by;

        if (claimedByStaff || closedByStaff) {
            const staffResponsibleId = ticket.claimed_by || interaction.user.id;
            const ticketCreator = await client.users.fetch(ticket.user_id).catch(() => null);
            if (ticketCreator) {
                await sendRatingPanel(ticketCreator, ticket, staffResponsibleId);
            }
        }

        await safeEditReply({
            embeds: [successEmbed('Ticket Fechado com sucesso!', `O canal será deletado em 5 segundos.`)],
            components: [],
        });
        
        setTimeout(async () => {
            await interaction.channel.delete().catch(err => logger.consoleLog('error', `Erro ao deletar canal: ${err.message}`));
        }, 5000);

        logger.logAction(client, interaction.guildId, 'Ticket Closed', interaction.user.tag, 
            `Ticket ID: ${ticket.id}, Criador: <@${ticket.user_id}>`);

    } catch (error) {
        logger.consoleLog('error', `Erro ao fechar ticket: ${error.message}`);
        await interaction.channel.send({ 
            embeds: [errorEmbed('Erro Fatal', `Ocorreu um erro ao finalizar o ticket. O canal não será deletado automaticamente. Por favor, remova-o manualmente.\nErro: \`${error.message}\``)]
        }).catch(() => {});
        await safeEditReply({ components: [] });
    }
}

// --- Funções de Claim (Mantidas) ---

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticket = getTicketByChannel(interaction.channelId);
    const config = getTicketConfig(interaction.guildId);

    if (!ticket) {
        return await interaction.editReply({ 
            embeds: [errorEmbed('Erro', 'Este canal não é um ticket aberto.')], 
            ephemeral: true 
        });
    }
    
    if (!config || !config.staff_role_id || !interaction.member.roles.cache.has(config.staff_role_id)) {
        return await interaction.editReply({
            embeds: [errorEmbed('Acesso Negado', 'Você não tem permissão para assumir este ticket.')],
            ephemeral: true
        });
    }
    
    if (ticket.claimed_by) {
        return await interaction.editReply({ 
            embeds: [errorEmbed('Já Assumido', `Este ticket já foi assumido por <@${ticket.claimed_by}>.`)], 
            ephemeral: true 
        });
    }
    
    claimTicket(interaction.channelId, interaction.user.id);
    
    await interaction.editReply({
        embeds: [successEmbed('Ticket Assumido', `Você assumiu a responsabilidade por este ticket.`)],
    });
    
    await interaction.channel.send({
        embeds: [
            new EmbedBuilder()
                .setDescription(`✅ **Ticket Assumido:** ${interaction.user} assumiu a responsabilidade por este atendimento.`)
                .setColor(0x2ecc71)
        ]
    }).catch(() => {});

    logger.logAction(client, interaction.guildId, 'Ticket Claimed', interaction.user.tag, 
        `Ticket ID: ${ticket.id}`);

    try {
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const initialMessage = messages.find(m => 
            m.author.id === client.user.id && 
            m.components.length > 0 && 
            m.components[0].components.some(c => c.customId === 'ticket_claim')
        );

        if (initialMessage) {
            const newComponents = initialMessage.components.map(row => {
                const newRow = new ActionRowBuilder().addComponents(
                    row.components.filter(c => c.customId !== 'ticket_claim')
                );
                return newRow;
            }).filter(row => row.components.length > 0);
            
            await initialMessage.edit({ components: newComponents }).catch(() => {});
        }
    } catch (e) {
        logger.consoleLog('error', `Erro ao remover botão Claim: ${e.message}`);
    }
}


// --- Funções de Avaliação (Com Logs e UX Melhorada) ---

/**
 * Envia um painel de avaliação para o criador do ticket no DM.
 * @param {object} user - O usuário que criou o ticket
 * @param {object} ticket - Os dados do ticket
 * @param {string} staffId - O ID do Staff que fechou ou assumiu
 */
async function sendRatingPanel(user, ticket, staffId) {
    const embed = new EmbedBuilder()
        .setTitle('⭐ Avalie seu Atendimento')
        .setDescription(
            `Olá, ${user.username}! Seu ticket sobre **${ticket.category}** foi fechado.\n\n` +
            `Gostaríamos de saber como foi sua experiência com nosso Staff (**<@${staffId}>**).\n` +
            `Por favor, use os botões abaixo para dar uma nota de 1 a 5 estrelas.`
        )
        .setColor(0xf1c40f)
        .setFooter({ text: `Ticket ID: #${ticket.id}` });
        
    // Custom ID: rating_<rating>_<ticketId>_<staffId>
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rating_1_${ticket.id}_${staffId}`).setLabel('1 ⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rating_2_${ticket.id}_${staffId}`).setLabel('2 ⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rating_3_${ticket.id}_${staffId}`).setLabel('3 ⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rating_4_${ticket.id}_${staffId}`).setLabel('4 ⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rating_5_${ticket.id}_${staffId}`).setLabel('5 ⭐').setStyle(ButtonStyle.Primary)
    );

    await user.send({ embeds: [embed], components: [row] }).catch(() => 
        logger.consoleLog('warn', `Não foi possível enviar painel de rating para ${user.tag}. DMs bloqueadas.`)
    );
}

/**
 * Envia o Modal para coletar o comentário do usuário.
 * @param {object} interaction - A interação de botão (Rating)
 * @param {number} rating - A nota (1 a 5)
 * @param {number} ticketId - O ID do ticket
 * @param {string} staffId - O ID do Staff
 */
async function sendRatingCommentModal(interaction, rating, ticketId, staffId) {
    const modal = new ModalBuilder()
        .setCustomId(`rating_comment_${ticketId}_${rating}_${staffId}`)
        .setTitle(`Comentário para ${rating} Estrela(s)`);

    const commentInput = new TextInputBuilder()
        .setCustomId('ratingCommentInput')
        // ✅ CORREÇÃO AQUI: Rótulo encurtado para <= 45 caracteres
        .setLabel('Comentário sobre o atendimento (Opcional)') 
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Ex: Fui atendido(a) rapidamente e meu problema foi resolvido.');

    const firstActionRow = new ActionRowBuilder().addComponents(commentInput);

    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
}

/**
 * Lida com o recebimento de avaliação de ticket via DM (AGORA CHAMA O MODAL).
 * @param {object} interaction - A interação de botão (Rating)
 * @param {object} client - O cliente Discord
 */
async function handleRating(interaction, client) {
    
    // rating_<rating>_<ticketId>_<staffId>
    const parts = interaction.customId.split('_');
    if (parts.length < 4) {
        await interaction.reply({ embeds: [errorEmbed('Erro', 'Interação de avaliação inválida.')], ephemeral: true });
        return;
    }
    
    const rating = parseInt(parts[1]);
    const ticketId = parseInt(parts[2]);
    const staffId = parts[3];
    
    // 1. Verifica se já avaliou
    if (getTicketRating(ticketId)) {
        await interaction.deferUpdate();
        // Edita a mensagem original para remover botões e informar (UX fix)
        if (interaction.message) {
             await interaction.message.edit({
                 embeds: [errorEmbed('Já Avaliado', 'Você já avaliou este ticket. Botões removidos.')],
                 components: []
             }).catch(() => {});
        }
        return await interaction.editReply({
            embeds: [errorEmbed('Já Avaliado', 'Você já avaliou este ticket.')],
            components: []
        });
    }

    // 2. Envia o modal de comentário
    await sendRatingCommentModal(interaction, rating, ticketId, staffId);
}

/**
 * Lida com o envio do Modal de Comentário (Finaliza o processo de avaliação).
 * @param {object} interaction - A interação de envio do Modal
 * @param {object} client - O cliente Discord
 */
async function handleRatingComment(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    // rating_comment_<ticketId>_<rating>_<staffId>
    const parts = interaction.customId.split('_');
    if (parts.length < 5) {
        return await interaction.editReply({ embeds: [errorEmbed('Erro', 'Formulário de avaliação inválido.')] });
    }

    const ticketId = parseInt(parts[2]);
    const rating = parseInt(parts[3]);
    const staffId = parts[4];
    const comment = interaction.fields.getTextInputValue('ratingCommentInput');
    const userId = interaction.user.id;
    
    let ticketData = null; 
    let guildId = null;

    try {
        // 1. Verifica se já avaliou novamente (evita double submit)
        if (getTicketRating(ticketId)) {
            // Edita a mensagem original para evitar a repetição
            if (interaction.message) {
                await interaction.message.edit({
                    embeds: [errorEmbed('Já Avaliado', 'Você já avaliou este ticket. Botões removidos.')],
                    components: []
                }).catch(() => {});
            }
            return await interaction.editReply({
                embeds: [errorEmbed('Já Avaliado', 'Você já avaliou este ticket.')],
            });
        }
        
        // Tenta obter os dados completos do ticket para fins de log
        ticketData = getTicketById(ticketId); 
        if (ticketData && ticketData.guild_id) {
            guildId = ticketData.guild_id;
        }
        
        // 2. Salva a avaliação (Nota + Comentário)
        saveTicketRating(guildId, ticketId, userId, rating, comment, staffId); // Passa guildId para a função de salvamento

        // 3. Notificação no Log Channel do Servidor (LOGIC: OK)
        if (guildId) {
            const config = getTicketConfig(guildId);
            if (config && config.log_channel_id) {
                // Tenta buscar a Guild e o canal (necessário pois a interação foi em DM)
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (guild) {
                    const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
                    
                    if (logChannel) {
                        const ratingEmbed = new EmbedBuilder()
                            .setTitle('⭐ Nova Avaliação de Atendimento')
                            .addFields(
                                { name: 'ID do Ticket', value: `#${ticketId}`, inline: true },
                                { name: 'Nota', value: '⭐'.repeat(rating) || 'N/A', inline: true },
                                { name: 'Staff Avaliado', value: `<@${staffId}>`, inline: true },
                                { name: 'Comentário', value: comment || '*Nenhum comentário fornecido.*', inline: false },
                                { name: 'Avaliado por', value: `${interaction.user.tag} (\`${userId}\`)`, inline: false },
                            )
                            // Colore o embed baseado na nota
                            .setColor(rating >= 4 ? 0x2ecc71 : rating <= 2 ? 0xe74c3c : 0xf1c40f) 
                            .setTimestamp();
                        
                        await logChannel.send({ embeds: [ratingEmbed] }).catch(err => 
                            logger.consoleLog('error', `Erro ao enviar log de rating para ${guild.name}: ${err.message}`)
                        );
                    }
                }
            }
        }

        // 4. Edita a MENSAGEM ORIGINAL no DM para remover os botões e dar a confirmação final. (UX FIX: OK)
        if (interaction.message) {
            const finalEmbed = new EmbedBuilder()
                .setTitle('⭐ Avaliação Registrada!')
                .setDescription(
                    `Obrigado por avaliar! Sua nota de **${rating} Estrela(s)** e seu comentário foram registrados.` + 
                    `\n\nEste atendimento foi realizado por <@${staffId}>.`
                )
                .setColor(0x2ecc71) // Verde para sucesso
                .setFooter({ text: `Ticket ID: #${ticketId}` });

            await interaction.message.edit({
                embeds: [finalEmbed],
                components: [] // Remove todos os botões (CRUCIAL para UX)
            }).catch(e => logger.consoleLog('error', `Erro ao editar mensagem de rating no DM: ${e.message}`));
        }
        
        // Log simples no console
        logger.consoleLog('info', `Rating Received: Ticket #${ticketId}, Rating: ${rating}, Comment: ${comment}`);


        // 5. Edita a resposta de deferReply (a mensagem de confirmação do Modal)
        await interaction.editReply({
            embeds: [successEmbed('Avaliação Finalizada!', `Agradecemos pelo seu feedback.`)],
        });

    } catch (error) {
        logger.consoleLog('error', `Erro ao finalizar o salvamento da avaliação de ticket: ${error.message}`);
        await interaction.editReply({
            embeds: [errorEmbed('Erro', 'Ocorreu um erro ao registrar sua avaliação final.')],
        });
    }
}


/**
 * Adiciona um membro ao canal de ticket atual, concedendo permissão de visualizar/enviar mensagens.
 */
async function handleTicketAddUser(interaction, client, member, ticketData, config) {
    const channel = interaction.channel;

    const existingOverwrite = channel.permissionOverwrites.cache.get(member.id);
    if (existingOverwrite && existingOverwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
        return await interaction.editReply({
            embeds: [errorEmbed('Aviso', `${member} já tem acesso a este ticket.`)]
        });
    }

    await channel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true
    });

    await interaction.editReply({
        embeds: [successEmbed('Membro Adicionado', `${member} foi adicionado a este ticket.`)]
    });

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setDescription(`➕ **Membro Adicionado:** ${interaction.user} adicionou ${member} a este ticket.`)
                .setColor(0x2ecc71)
        ]
    }).catch(() => {});

    logger.logAction(client, interaction.guildId, 'Ticket - Membro Adicionado', interaction.user.tag,
        `Ticket ID: ${ticketData.id} | Membro adicionado: ${member.tag} (${member.id})`);
}

/**
 * Remove um membro do canal de ticket atual, revogando o acesso ao canal.
 */
async function handleTicketRemoveUser(interaction, client, member, ticketData, config) {
    const channel = interaction.channel;

    if (member.id === ticketData.user_id) {
        return await interaction.editReply({
            embeds: [errorEmbed('Ação Bloqueada', 'Não é possível remover o criador do ticket.')]
        });
    }

    const existingOverwrite = channel.permissionOverwrites.cache.get(member.id);
    if (!existingOverwrite) {
        return await interaction.editReply({
            embeds: [errorEmbed('Aviso', `${member} não tem acesso a este ticket.`)]
        });
    }

    await channel.permissionOverwrites.delete(member.id).catch(() => {});

    await interaction.editReply({
        embeds: [successEmbed('Membro Removido', `${member} foi removido deste ticket.`)]
    });

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setDescription(`➖ **Membro Removido:** ${interaction.user} removeu ${member} deste ticket.`)
                .setColor(0xe74c3c)
        ]
    }).catch(() => {});

    logger.logAction(client, interaction.guildId, 'Ticket - Membro Removido', interaction.user.tag,
        `Ticket ID: ${ticketData.id} | Membro removido: ${member.tag} (${member.id})`);
}

// Exporta as funções principais
module.exports = {
    handleTicketOpen,
    handleTicketClose,
    handleTicketCloseConfirm,
    handleTicketClaim,
    handleTicketAddUser,
    handleTicketRemoveUser,
    handleRating,
    handleRatingComment, 
    sendRatingPanel,
    getCategoryByValue 
};