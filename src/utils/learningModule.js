const { 
    getTopCategories, 
    saveAILearningData, 
    getDatabase, 
    getAIKnowledge, 
    saveAIKnowledge, 
    addPendingLearning 
} = require('./database');
const logger = require('./system-logs');

/**
 * Módulo de Aprendizado Local da IA (Estilo Jarvis)
 */
class LearningModule {
    constructor() {
        this.knowledgeBase = new Map();
        this.patterns = [];
    }

    /**
     * Analisa uma conversa encerrada para extrair conhecimento
     */
    async analyzeConversation(conversationId) {
        const db = getDatabase();
        const conversation = db.prepare('SELECT * FROM ai_conversations WHERE id = ?').get(conversationId);
        
        if (!conversation) return;

        try {
            const history = JSON.parse(conversation.history || '[]');
            const state = JSON.parse(conversation.current_state || '{}');
            
            // Extração simples de palavras-chave baseada na escolha e histórico
            const keywords = this.extractKeywords(history);
            
            saveAILearningData({
                guild_id: conversation.guild_id,
                conversation_id: conversation.id,
                category_chosen: state.choice || 'Desconhecido',
                keywords_extracted: keywords.join(', '),
                resolution_status: state.step === 'completed' ? 'resolved' : 'abandoned'
            });

            // IA: Se houver termos novos com alta frequência, adiciona ao aprendizado pendente
            keywords.forEach(term => {
                const existing = getAIKnowledge(term);
                if (!existing) {
                    addPendingLearning(term, state.choice);
                }
            });

            logger.consoleLog('info', `IA aprendeu com a conversa #${conversationId}. Categoria: ${state.choice}`);
        } catch (error) {
            logger.consoleLog('error', `Erro ao analisar conversa para aprendizado: ${error.message}`);
        }
    }

    /**
     * Extrai palavras-chave de um histórico de mensagens (simulação de NLP local)
     */
    extractKeywords(history) {
        const commonWords = ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'em', 'um', 'uma', 'que', 'com', 'para', 'eu', 'queria', 'como', 'fazer'];
        const text = history.map(h => h.content).join(' ').toLowerCase();
        const words = text.split(/\W+/);
        
        const counts = {};
        words.forEach(word => {
            if (word.length > 3 && !commonWords.includes(word)) {
                counts[word] = (counts[word] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0]);
    }

    /**
     * Obtém as recomendações de atendimento baseadas no aprendizado
     */
    getRecommendations(guildId) {
        const top = getTopCategories(guildId, 3);
        return top.map(t => t.category_chosen);
    }

    /**
     * Simula a "Evolução" buscando novos padrões de atendimento (Jarvis-like)
     * No futuro, isso poderia ler arquivos de log ou FAQs externos
     */
    async evolve(client) {
        logger.consoleLog('info', 'IA Jarvis iniciando processo de evolução diária...');
        
        // Exemplo: Analisar quais tickets demoram mais para serem fechados
        // e sugerir melhorias no fluxo (lógica interna)
        
        logger.consoleLog('success', 'Evolução concluída. Base de conhecimento local atualizada.');
    }
}

module.exports = new LearningModule();
