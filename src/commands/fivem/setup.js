const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, warningEmbed, fivemStatusEmbed } = require('../../utils/embeds');
const { getFiveMStatus } = require('../../utils/fivemStatus');
const { saveFiveMConfig, getFiveMConfig } = require('../../utils/database');

// Variáveis de configuração padrão
const DEFAULT_SERVER_IP = '45.149.153.218';
const DEFAULT_SERVER_PORT = 30120;
const DEFAULT_SERVER_NAME = 'CAPITAL SP';
const DEFAULT_UPDATE_INTERVAL = 1; // Minuto

// Função auxiliar para garantir o protocolo HTTPS
const ensureHttps = (url) => {
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }
    return url;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fivem')
        .setDescription('Comandos para configurar o painel de status do servidor FiveM.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configura e envia (ou vincula) o painel de status do FiveM.')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('O canal onde o painel de status será enviado ou já existe.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('link-conexao')
                        .setDescription('Link de conexão direto (Ex: cfx.re/join/xxxx)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('id-mensagem')
                        .setDescription('ID de um painel já existente para reaproveitar (Opcional)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('ip')
                        .setDescription(`O IP do servidor FiveM (Padrão: ${DEFAULT_SERVER_IP})`))
                .addIntegerOption(option =>
                    option.setName('porta')
                        .setDescription(`A porta do servidor (Padrão: ${DEFAULT_SERVER_PORT})`))
                .addStringOption(option =>
                    option.setName('nome')
                        .setDescription(`O nome do servidor (Padrão: ${DEFAULT_SERVER_NAME})`))
                .addStringOption(option =>
                    option.setName('banner')
                        .setDescription('URL da imagem de banner para o painel.'))
                .addIntegerOption(option =>
                    option.setName('intervalo')
                        .setDescription(`Intervalo de atualização em minutos (Padrão: 1)`))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('config') 
                .setDescription('Configura os links de Booster e VIP do painel.')
                .addStringOption(option =>
                    option.setName('booster-url')
                        .setDescription('URL do convite/página para o Nitro Booster.'))
                .addStringOption(option =>
                    option.setName('vip-url')
                        .setDescription('URL da loja/página para o VIP.'))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Para de atualizar o painel de status do FiveM.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('canal');
            const existingMessageId = interaction.options.getString('id-mensagem');
            const ip = interaction.options.getString('ip') || DEFAULT_SERVER_IP;
            const port = interaction.options.getInteger('porta') || DEFAULT_SERVER_PORT;
            const name = interaction.options.getString('nome') || DEFAULT_SERVER_NAME;
            let connectLink = interaction.options.getString('link-conexao');
            const banner = interaction.options.getString('banner');
            const interval = interaction.options.getInteger('intervalo') || DEFAULT_UPDATE_INTERVAL;

            connectLink = ensureHttps(connectLink);
            await interaction.deferReply({ ephemeral: true });

            const statusData = await getFiveMStatus(ip, port);
            const embed = fivemStatusEmbed(statusData, name, banner, interval);
            
            const connectButton = new ButtonBuilder()
                .setLabel('Entrar no Servidor')
                .setStyle(ButtonStyle.Link)
                .setURL(connectLink) 
                .setEmoji('🎮');

            const row = new ActionRowBuilder().addComponents(connectButton);

            try {
                let message;
                let isLinked = false;

                if (existingMessageId) {
                    try {
                        message = await channel.messages.fetch(existingMessageId);
                        await message.edit({ embeds: [embed], components: [row] });
                        isLinked = true;
                    } catch (err) {
                        return interaction.editReply({
                            embeds: [errorEmbed('Erro ao Vincular', `Não encontrei a mensagem com ID \`${existingMessageId}\` no canal ${channel}.`)]
                        });
                    }
                } else {
                    message = await channel.send({ embeds: [embed], components: [row] });
                }
                
                await saveFiveMConfig(interaction.guildId, {
                    guild_id: interaction.guildId,
                    channel_id: channel.id, 
                    message_id: message.id, 
                    ip: ip,
                    port: port,
                    name: name,
                    connectLink: connectLink,
                    banner_url: banner, 
                    interval: interval * 60000,
                    boosterLink: '', 
                    vipLink: ''
                });

                await interaction.editReply({
                    embeds: [successEmbed(isLinked ? 'Painel Vinculado' : 'Painel Criado', `O status será atualizado a cada ${interval} min no canal ${channel}.`)]
                });

            } catch (e) {
                console.error('Erro no setup FiveM:', e);
                await interaction.editReply({
                    embeds: [errorEmbed('Erro na Configuração', `Erro: ${e.message}`)]
                });
            }

        } else if (subcommand === 'config') {
            await interaction.deferReply({ ephemeral: true });

            const newBoosterUrl = interaction.options.getString('booster-url');
            const newVipUrl = interaction.options.getString('vip-url');
            let config = await getFiveMConfig(interaction.guildId);

            if (!config) {
                return interaction.editReply({
                    embeds: [warningEmbed('Configuração Faltando', 'Use `/fivem setup` primeiro.')]
                });
            }

            let updated = false;
            if (newBoosterUrl) { config.boosterLink = ensureHttps(newBoosterUrl); updated = true; }
            if (newVipUrl) { config.vipLink = ensureHttps(newVipUrl); updated = true; }
            
            if (!updated) return interaction.editReply({ embeds: [warningEmbed('Nenhuma Mudança', 'Informe um link.')] });

            await saveFiveMConfig(interaction.guildId, config);
            await interaction.editReply({ embeds: [successEmbed('Links Salvos', 'Os botões serão atualizados no próximo ciclo.')] });
            await module.exports.updateFiveMStatus(interaction.client, config);

        } else if (subcommand === 'stop') {
            await interaction.deferReply({ ephemeral: true });
            const config = await getFiveMConfig(interaction.guildId);
            if (config) {
                await saveFiveMConfig(interaction.guildId, null); 
                await interaction.editReply({ embeds: [successEmbed('Parado', 'O painel não será mais atualizado.')] });
            } else {
                await interaction.editReply({ embeds: [warningEmbed('Aviso', 'Nenhum painel ativo.')] });
            }
        }
    },
};

// ====================================================================
// FUNÇÃO DE ATUALIZAÇÃO COM TRATAMENTO DE ERROS (ANTI-CRASH)
// ====================================================================

async function updateFiveMStatus(client, config) {
    if (!config || !config.channel_id || !config.message_id) return;
    const { channel_id, message_id, ip, port, name, banner_url, interval, connectLink, boosterLink, vipLink, guild_id } = config; 

    try {
        const channel = await client.channels.fetch(channel_id).catch(() => null); 
        if (!channel) return await saveFiveMConfig(guild_id, null);

        const message = await channel.messages.fetch(message_id).catch(err => {
            if (err.code === 10008) return 'DELETED';
            return null;
        });

        if (message === 'DELETED') {
            console.log(`[FiveM] Mensagem apagada no servidor ${guild_id}. Limpando DB.`);
            return await saveFiveMConfig(guild_id, null);
        }
        if (!message) return;

        const statusData = await getFiveMStatus(ip, port);
        const embed = fivemStatusEmbed(statusData, name, banner_url, interval / 60000); 

        const buttons = [];
        buttons.push(new ButtonBuilder().setLabel('Entrar no Servidor').setStyle(ButtonStyle.Link).setURL(connectLink).setEmoji('🎮'));

        if (boosterLink && boosterLink.length > 5) {
            buttons.push(new ButtonBuilder().setLabel('Seja Booster').setStyle(ButtonStyle.Link).setURL(boosterLink).setEmoji('🚀'));
        }

        if (vipLink && vipLink.length > 5) {
            buttons.push(new ButtonBuilder().setLabel('Seja VIP').setStyle(ButtonStyle.Link).setURL(vipLink).setEmoji('⭐'));
        }
        
        const row = new ActionRowBuilder().addComponents(buttons);
        await message.edit({ embeds: [embed], components: [row] }); 

    } catch (e) {
        if (e.code === 10008 || e.code === 10003) {
            await saveFiveMConfig(guild_id, null);
        } else {
            console.error('[FiveM Update Error]:', e.message);
        }
    }
}

module.exports.updateFiveMStatus = updateFiveMStatus;   