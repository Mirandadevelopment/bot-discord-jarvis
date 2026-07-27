const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildRatings, getRatingStats } = require('../../utils/database');
const logger = require('../../utils/system-logs');

// Função auxiliar para formatar datas (opcional, mas bom para consistência)
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    try {
        return new Date(dateString).toLocaleString('pt-BR', options);
    } catch (e) {
        return 'Data inválida';
    }
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-ratings')
    .setDescription('Ver avaliações e estatísticas dos tickets de atendimento.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Ver estatísticas gerais de média e contagem das avaliações.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Listar avaliações recentes com comentários.')
        .addIntegerOption(option =>
          option
            .setName('limite')
            .setDescription('Quantidade máxima de avaliações a listar (Máx. 20).')
            .setMinValue(5)
            // Limitar a 20 para garantir que caiba em um ou dois embeds, respeitando o limite de campos (25)
            .setMaxValue(20) 
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();
      
      // ✅ CORREÇÃO: Mover a chamada getRatingStats para fora dos subcommands
      // para que a variável 'stats' seja acessível no bloco 'list'.
      const stats = getRatingStats(interaction.guildId);

      if (subcommand === 'stats') {
        // --- Lógica STATS ---
        // 'stats' já está definido
        if (!stats || stats.total === 0) {
          return await interaction.editReply({
            content: '❌ Ainda não há avaliações registradas. O sistema de avaliação foi configurado, mas o primeiro feedback está pendente.',
            ephemeral: true
          });
        }

        const average = stats.average ? stats.average.toFixed(2) : '0.00';
        const stars = '⭐'.repeat(Math.round(stats.average));

        const embed = new EmbedBuilder()
          .setTitle('📊 Estatísticas de Avaliações de Tickets')
          .setColor(0x2ecc71) // Verde/Sucesso
          .setDescription(`**Média Geral:** ${average} ${stars}\nTotal de Feedbacks: **${stats.total}**`)
          .addFields(
            { name: '⭐⭐⭐⭐⭐ (Ótimo)', value: `\`${stats.five_stars || 0}\``, inline: true },
            { name: '⭐⭐⭐⭐ (Muito Bom)', value: `\`${stats.four_stars || 0}\``, inline: true },
            { name: '⭐⭐⭐ (Bom)', value: `\`${stats.three_stars || 0}\``, inline: true },
            { name: '⭐⭐ (Regular)', value: `\`${stats.two_stars || 0}\``, inline: true },
            { name: '⭐ (Ruim)', value: `\`${stats.one_star || 0}\``, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }
          )
          .setFooter({ text: 'Use /ticket-ratings list para ver avaliações individuais' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });

      } else if (subcommand === 'list') {
        // --- Lógica LIST ---
        const limit = interaction.options.getInteger('limite') || 10;
        // O limite aqui deve ser no máximo o valor do option (20)
        const ratings = getGuildRatings(interaction.guildId, limit); 

        if (!ratings || ratings.length === 0) {
          return await interaction.editReply({
            content: '❌ Não há avaliações recentes para listar. Tente novamente mais tarde.',
            ephemeral: true
          });
        }
        
        // Embora 'stats' deva estar definido, verifica-se se há avaliações totais para o footer
        const totalRatings = stats && stats.total > 0 ? stats.total : ratings.length;

        const embed = new EmbedBuilder()
          .setTitle('📋 Avaliações Recentes de Tickets')
          .setColor(0x3498db)
          .setDescription(`Mostrando as **${ratings.length}** avaliações mais recentes (Máx. ${limit}):`)
          .setTimestamp();

        ratings.forEach(rating => {
          // Discord.js lida automaticamente com <@id> mesmo se o usuário não estiver em cache
          const stars = '⭐'.repeat(rating.rating);
          const date = formatDate(rating.created_at);
          const comment = rating.comment ? `\n> **Comentário:** ${rating.comment.substring(0, 100)}${rating.comment.length > 100 ? '...' : ''}` : ''; // Limita o comentário
          
          embed.addFields({
            name: `${stars} - Ticket #${rating.ticket_id}`,
            value: `**Usuário:** <@${rating.user_id}>\n**Atendido por:** ${rating.staff_id ? `<@${rating.staff_id}>` : 'N/A'}\n**Data:** ${date}${comment}`,
            inline: false
          });
        });
        
        // 'stats' agora está definido
        embed.setFooter({ text: `Total de avaliações: ${totalRatings}` });

        await interaction.editReply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      logger.consoleLog('error', `Erro no comando ticket-ratings: ${error.message}`);
      console.error(error);
      await interaction.editReply({
        content: '❌ Erro ao carregar avaliações. Verifique o console para detalhes.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};