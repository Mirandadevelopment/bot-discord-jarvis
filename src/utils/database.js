const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
// ✨ Importação necessária para o gatilho de atualização
const { initializeStaffTables } = require('./staffDatabase');
const { exportToFile } = require('./db-exporter');
let ratingPanelHandler; 

const dbPath = path.join(__dirname, '../../database/configs.db'); 
const dbDir = path.dirname(dbPath);

// Garantir que o diretório existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * Retorna o objeto de banco de dados.
 */
function getDatabase() {
    return db;
}

/**
 * Inicializa o banco de dados com todas as tabelas necessárias
 */
function initializeDatabase() {
    console.log('📦 Inicializando banco de dados...');

    // 1. Tabela de configurações gerais por servidor (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS guild_configs (guild_id TEXT PRIMARY KEY, whitelist_enabled INTEGER DEFAULT 0, ticket_enabled INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');

    // 2. Configurações de Whitelist (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS whitelist_configs (guild_id TEXT PRIMARY KEY, panel_channel_id TEXT, panel_message_id TEXT, approval_channel_id TEXT, log_channel_id TEXT, approved_role_id TEXT, pending_role_id TEXT, category_id TEXT, mysql_host TEXT, mysql_user TEXT, mysql_password TEXT, mysql_database TEXT, mysql_port INTEGER DEFAULT 3306, banner_url TEXT, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // Adiciona colunas se não existirem (migração)
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN banner_url TEXT').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN panel_message_id TEXT').run(); } catch (e) { /* Coluna já existe */ }
    // Novas colunas para configuração dinâmica
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN db_table_name TEXT DEFAULT "accounts"').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN db_whitelist_column TEXT DEFAULT "whitelist"').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN db_id_type TEXT DEFAULT "numeric"').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN db_id_column TEXT DEFAULT "id"').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE whitelist_configs ADD COLUMN db_steam_column TEXT DEFAULT "steam"').run(); } catch (e) { /* Coluna já existe */ }

    // 3. Configurações de Tickets (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS ticket_configs (guild_id TEXT PRIMARY KEY, panel_channel_id TEXT, panel_message_id TEXT, category_id TEXT, log_channel_id TEXT, staff_role_id TEXT, transcript_channel_id TEXT, banner_url TEXT, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // Adiciona colunas se não existirem (migração)
    try { db.prepare('ALTER TABLE ticket_configs ADD COLUMN banner_url TEXT').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE ticket_configs ADD COLUMN panel_message_id TEXT').run(); } catch (e) { /* Coluna já existe */ }


    // 4. Categorias de Tickets (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS ticket_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, emoji TEXT DEFAULT "🎫", FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 5. Tickets Ativos (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, category TEXT, status TEXT DEFAULT "open", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, closed_at DATETIME, closed_by TEXT, claimed_by TEXT, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');
    // Migração: Adiciona a coluna claimed_by se não existir
    try { db.prepare('ALTER TABLE tickets ADD COLUMN claimed_by TEXT').run(); } catch (e) { /* Coluna já existe */ }
    
    // 6. Whitelists Pendentes (cache local) (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS whitelist_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, channel_id TEXT NOT NULL, steam_id TEXT, status TEXT DEFAULT "pending", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 7. Configurações de Welcome (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS welcome_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, banner_url TEXT, role_id TEXT, enabled INTEGER DEFAULT 0, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // Adiciona coluna role_id se não existir (migração)
    try { db.prepare('ALTER TABLE welcome_configs ADD COLUMN role_id TEXT').run(); } catch (e) { /* Coluna já existe */ }

    // 8. Configurações de Goodbye (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS goodbye_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, banner_url TEXT, enabled INTEGER DEFAULT 0, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 9. Configurações do FiveM (CORRIGIDO: Incluindo boosterLink e vipLink)
    db.exec('CREATE TABLE IF NOT EXISTS fivem_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message_id TEXT, ip TEXT, port INTEGER, name TEXT, connectLink TEXT, banner_url TEXT, interval INTEGER, boosterLink TEXT DEFAULT "", vipLink TEXT DEFAULT "", FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // MIGRATION / ALTER TABLE PARA fivem_configs (CONDENSADO E ATUALIZADO)
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN channel_id TEXT').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN message_id TEXT').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN connectLink TEXT').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN ip TEXT').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN port INTEGER').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN interval INTEGER').run(); } catch (e) { /* Coluna já existe */ }
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN boosterLink TEXT DEFAULT ""').run(); } catch (e) { /* Coluna já existe */ } 
    try { db.prepare('ALTER TABLE fivem_configs ADD COLUMN vipLink TEXT DEFAULT ""').run(); } catch (e) { /* Coluna já existe */ }     

    // 10. Avaliações de Tickets (CONDENSADA)
    db.exec('CREATE TABLE IF NOT EXISTS ticket_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, ticket_id INTEGER NOT NULL, user_id TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5), comment TEXT, staff_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 11. Configurações do Painel de Avaliações (NOVA TABELA)
    db.exec('CREATE TABLE IF NOT EXISTS rating_panel_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message_id TEXT, enabled INTEGER DEFAULT 0, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 12. Inicializa tabelas de staff
    initializeStaffTables();

    // 13. Configurações de Recrutamento (NOVA TABELA)
    db.exec('CREATE TABLE IF NOT EXISTS recruitment_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, log_channel_id TEXT, staff_role_id TEXT, banner_url TEXT, questions TEXT, enabled INTEGER DEFAULT 0, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 14. Sessões de Conversa da IA (NOVA TABELA)
    db.exec('CREATE TABLE IF NOT EXISTS ai_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, current_state TEXT, history TEXT, status TEXT DEFAULT "active", associated_channel_id TEXT, start_time DATETIME DEFAULT CURRENT_TIMESTAMP, last_activity_time DATETIME DEFAULT CURRENT_TIMESTAMP, end_time DATETIME, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 15. Dados de Aprendizado da IA (NOVA TABELA)
    db.exec('CREATE TABLE IF NOT EXISTS ai_learning_data (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, conversation_id INTEGER, category_chosen TEXT, satisfaction_rating INTEGER, keywords_extracted TEXT, resolution_status TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE, FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL)');

    // 16. Configuração do Canal Único de Atendimento (NOVA TABELA)
    db.exec('CREATE TABLE IF NOT EXISTS ai_panel_configs (guild_id TEXT PRIMARY KEY, channel_id TEXT, message_id TEXT, banner_url TEXT, enabled INTEGER DEFAULT 1, FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    // 17. Base de Conhecimento da IA (Cérebro)
    db.exec('CREATE TABLE IF NOT EXISTS ai_knowledge_base (id INTEGER PRIMARY KEY AUTOINCREMENT, key_term TEXT UNIQUE, response_data TEXT, category TEXT DEFAULT "general", confidence_level FLOAT DEFAULT 1.0, usage_count INTEGER DEFAULT 0, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, created_by TEXT DEFAULT "system")');

    // 18. Memórias Recentes de Usuários
    db.exec('CREATE TABLE IF NOT EXISTS ai_recent_memories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, interaction_type TEXT, content_summary TEXT, sentiment TEXT DEFAULT "neutral", timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');

    // 19. Aprendizado Pendente (Entradas não reconhecidas)
    db.exec('CREATE TABLE IF NOT EXISTS ai_pending_learning (id INTEGER PRIMARY KEY AUTOINCREMENT, raw_input TEXT, suggested_category TEXT, status TEXT DEFAULT "pending", created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');

    // 20. Histórico de Identidade de Usuários (Nomes e Apelidos)
    db.exec('CREATE TABLE IF NOT EXISTS user_identity_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, guild_id TEXT NOT NULL, previous_name TEXT, current_name TEXT, voice_enabled INTEGER DEFAULT 1, last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, guild_id))');

    // 21. Configurações de Voz da IA
    db.exec('CREATE TABLE IF NOT EXISTS ai_voice_configs (guild_id TEXT PRIMARY KEY, tts_enabled INTEGER DEFAULT 0, stt_enabled INTEGER DEFAULT 0, voice_id TEXT DEFAULT "Jarvis", FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE)');

    console.log('✅ Banco de dados inicializado com sucesso!');
    
    // Exportação automática para backup/portabilidade na inicialização
    const exportPath = path.join(__dirname, '../../database/backup_portabilidade.sql');
    if (exportToFile(db, exportPath)) {
        console.log('💾 Backup SQL para HeidiSQL gerado em: /database/backup_portabilidade.sql');
    }
}

/**
 * Obtém ou cria configuração de um servidor
 */
function getGuildConfig(guildId) {
  let config = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
  
  if (!config) {
    db.prepare('INSERT INTO guild_configs (guild_id) VALUES (?)').run(guildId);
    config = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
  }
  
  return config;
}

/**
 * Atualiza configuração de um servidor
 */
function updateGuildConfig(guildId, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), guildId];
  
  db.prepare(`UPDATE guild_configs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`).run(...values);
}

/**
 * Obtém configuração de whitelist de um servidor
 */
function getWhitelistConfig(guildId) {
  return db.prepare('SELECT * FROM whitelist_configs WHERE guild_id = ?').get(guildId);
}

/**
 * Salva/atualiza configuração de whitelist
 */
function saveWhitelistConfig(guildId, config) {
  // Garante que guild_config existe primeiro (FOREIGN KEY)
  getGuildConfig(guildId);
  
  const existing = getWhitelistConfig(guildId);
  
  if (existing) {
    const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(config), guildId];
    db.prepare(`UPDATE whitelist_configs SET ${fields} WHERE guild_id = ?`).run(...values);
  } else {
    const fields = ['guild_id', ...Object.keys(config)].join(', ');
    const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
    const values = [guildId, ...Object.values(config)];
    db.prepare(`INSERT INTO whitelist_configs (${fields}) VALUES (${placeholders})`).run(...values);
  }
}

/**
 * Obtém configuração de tickets de um servidor
 */
function getTicketConfig(guildId) {
  return db.prepare('SELECT * FROM ticket_configs WHERE guild_id = ?').get(guildId);
}

/**
 * Salva/atualiza configuração de tickets
 */
function saveTicketConfig(guildId, config) {
  // Garante que guild_config existe primeiro (FOREIGN KEY)
  getGuildConfig(guildId);
  
  const existing = getTicketConfig(guildId);
  
  if (existing) {
    const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(config), guildId];
    db.prepare(`UPDATE ticket_configs SET ${fields} WHERE guild_id = ?`).run(...values);
  } else {
    const fields = ['guild_id', ...Object.keys(config)].join(', ');
    const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
    const values = [guildId, ...Object.values(config)];
    db.prepare(`INSERT INTO ticket_configs (${fields}) VALUES (${placeholders})`).run(...values);
  }
}

/**
 * Obtém todas as categorias de ticket de um servidor
 */
function getTicketCategories(guildId) {
  return db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ?').all(guildId);
}

/**
 * Adiciona uma categoria de ticket
 */
function addTicketCategory(guildId, name, description, emoji = '🎫') {
  // Garante que guild_config existe primeiro (FOREIGN KEY)
  getGuildConfig(guildId);
  
  return db.prepare('INSERT INTO ticket_categories (guild_id, name, description, emoji) VALUES (?, ?, ?, ?)').run(guildId, name, description, emoji);
}

/**
 * Remove uma categoria de ticket pelo NOME
 */
function removeTicketCategory(guildId, name) {
    // Corrigido para remover pelo nome, que é o valor usado no Select Menu/Botões
  return db.prepare('DELETE FROM ticket_categories WHERE guild_id = ? AND name = ?').run(guildId, name);
}

/**
 * Cria um novo ticket
 */
function createTicket(guildId, channelId, userId, category) {
  // O retorno 'lastInsertRowid' é o ID do ticket no DB
  const result = db.prepare('INSERT INTO tickets (guild_id, channel_id, user_id, category) VALUES (?, ?, ?, ?)').run(guildId, channelId, userId, category);
  return result.lastInsertRowid;
}

/**
 * Assinala um ticket como assumido por um Staff (Claim)
 */
function claimTicket(channelId, staffId) {
  // Atualiza o campo 'claimed_by' apenas se o ticket estiver aberto
  return db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = ?').run(staffId, channelId, 'open');
}

/**
 * Obtém ticket por canal
 * Adiciona o campo 'id' para uso no rating
 */
function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND status = ?').get(channelId, 'open');
}

/**
 * Fecha um ticket
 */
function closeTicket(channelId, closedBy) {
  return db.prepare('UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?').run('closed', closedBy, channelId);
}

/**
 * Obtém tickets de um usuário
 */
function getUserTickets(guildId, userId) {
  return db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ? ORDER BY created_at DESC').all(guildId, userId, 'open');
}

/**
 * Obtém dados de um ticket pelo seu ID primário (id)
 * (Usado para obter o guild_id e o user_id do criador)
 * ✅ CORRIGIDO O NOME DA FUNÇÃO
 */
function getTicketById(ticketId) {
  // Retorna o guild_id, user_id, e channel_id (para referência)
  return db.prepare('SELECT guild_id, user_id, channel_id, claimed_by FROM tickets WHERE id = ?').get(ticketId);
}

// -----------------------------------------------------
// ✨ FUNÇÕES DE ESTATÍSTICAS PARA ATUALIZAÇÃO DE PAINEL
// -----------------------------------------------------

/**
 * Obtém o número total de tickets abertos (status = 'open').
 */
function getTotalOpenTickets(guildId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?').get(guildId, 'open');
    return result ? result.count : 0;
}

/**
 * Obtém o número total de tickets fechados/atendidos (status = 'closed').
 */
function getTotalClosedTickets(guildId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?').get(guildId, 'closed');
    return result ? result.count : 0;
}

/**
 * Obtém o número total de whitelists pendentes (status = 'pending').
 */
function getTotalPendingWhitelists(guildId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM whitelist_pending WHERE guild_id = ? AND status = ?').get(guildId, 'pending');
    return result ? result.count : 0;
}

/**
 * Obtém o número total de whitelists aprovadas (status = 'approved').
 */
function getTotalApprovedWhitelists(guildId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM whitelist_pending WHERE guild_id = ? AND status = ?').get(guildId, 'approved');
    return result ? result.count : 0;
}

// -----------------------------------------------------

/**
 * Cria whitelist pendente
 */
function createPendingWhitelist(guildId, userId, channelId) {
  return db.prepare('INSERT INTO whitelist_pending (guild_id, user_id, channel_id) VALUES (?, ?, ?)').run(guildId, userId, channelId);
}

/**
 * Obtém whitelist pendente por canal
 */
function getPendingWhitelistByChannel(channelId) {
  return db.prepare('SELECT * FROM whitelist_pending WHERE channel_id = ? AND status = ?').get(channelId, 'pending');
}

/**
 * Atualiza whitelist pendente
 */
function updatePendingWhitelist(id, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  return db.prepare(`UPDATE whitelist_pending SET ${fields} WHERE id = ?`).run(...values);
}

/**
 * Obtém estatísticas de tickets
 */
function getTicketStats(guildId) {
	  const total = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?').get(guildId);
	  const open = getTotalOpenTickets(guildId); 
	  const closed = getTotalClosedTickets(guildId); 
	  
	  return {
	    total: total.count,
	    open: open,
	    closed: closed
	  };
	}
	
	/**
	 * Obtém o número total de tickets atendidos (global)
	 */
	function getTotalTicketsAtendidosGlobal() {
	    const result = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE status = ?').get('closed');
	    return result ? result.count : 0;
	}
	
	/**
	 * Obtém o número total de whitelists aprovadas (global)
	 */
	function getTotalWhitelistsAprovadasGlobal() {
	    const result = db.prepare('SELECT COUNT(*) as count FROM whitelist_pending WHERE status = ?').get('approved');
	    return result ? result.count : 0;
	}
	
	/**
	 * Obtém a média de avaliações (global)
	 */
	function getMediaAvaliacoesGlobal() {
	    const result = db.prepare('SELECT AVG(rating) as average FROM ticket_ratings').get();
	    return result && result.average ? parseFloat(result.average).toFixed(1) : '0.0';
	}

/**
 * Salva avaliação de ticket
 */
function saveTicketRating(guildId, ticketId, userId, rating, comment, staffId) {
  // Como o guild_id não é passado diretamente no rating, vamos buscá-lo do ticket.
  // Isso garante a integridade referencial com a tabela ticket_ratings.
  if (!guildId) {
    // ✅ CORRIGIDO: Chama a função renomeada
    const ticket = getTicketById(ticketId); 
    if (ticket) {
      guildId = ticket.guild_id;
    } else {
      console.error(`[DB Error] Tentativa de salvar rating para ticket #${ticketId} falhou: ticket não encontrado.`);
      return; // Não salva sem guild_id
    }
  }
  
  const result = db.prepare(
    'INSERT INTO ticket_ratings (guild_id, ticket_id, user_id, rating, comment, staff_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(guildId, ticketId, userId, rating, comment, staffId);

    // ✨ GATILHO DE ATUALIZAÇÃO DO PAINEL DE AVALIAÇÕES
    if (ratingPanelHandler && ratingPanelHandler.updateRatingPanel) {
        // Envia a chamada para atualizar o painel no servidor correto
        ratingPanelHandler.updateRatingPanel(guildId); 
    }
    // FIM GATILHO
  
    return result;
}

/**
 * Obtém avaliação de um ticket (pelo ticket_id)
 */
function getTicketRating(ticketId) {
  return db.prepare('SELECT * FROM ticket_ratings WHERE ticket_id = ?').get(ticketId);
}

/**
 * Obtém todas as avaliações de um servidor
 */
function getGuildRatings(guildId, limit = 50) {
  return db.prepare(
    'SELECT * FROM ticket_ratings WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(guildId, limit);
}

/**
 * Obtém estatísticas de avaliações
 */
function getRatingStats(guildId) {
    // ✅ CORREÇÃO: Query reescrita usando concatenação de string para evitar 
    // erros de sintaxe causados por whitespace em template literals multi-linha.
    const sqlQuery = 
        'SELECT COUNT(*) as total, AVG(rating) as average, ' +
        'SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars, ' +
        'SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars, ' +
        'SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars, ' +
        'SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars, ' +
        'SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star ' +
        'FROM ticket_ratings ' +
        'WHERE guild_id = ?';

    const stats = db.prepare(sqlQuery).get(guildId);
    
    return stats;
}

// -----------------------------------------------------
// ✨ FUNÇÕES DO PAINEL DE AVALIAÇÕES (NOVO)
// -----------------------------------------------------

/**
 * Obtém configuração do Painel de Avaliações de um servidor
 */
function getRatingPanelConfig(guildId) {
    return db.prepare('SELECT * FROM rating_panel_configs WHERE guild_id = ?').get(guildId);
}

/**
 * Obtém todas as configurações de painel de avaliação ativas.
 */
function getAllRatingConfigs() {
    return db.prepare('SELECT * FROM rating_panel_configs WHERE enabled = 1').all();
}

/**
 * Salva/atualiza configuração do Painel de Avaliações
 */
function saveRatingPanelConfig(guildId, config) {
    // Garante que guild_config existe primeiro (FOREIGN KEY)
    getGuildConfig(guildId);

    const existing = getRatingPanelConfig(guildId);

    if (existing) {
        const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(config), guildId];
        db.prepare(`UPDATE rating_panel_configs SET ${fields} WHERE guild_id = ?`).run(...values);
    } else {
        const fields = ['guild_id', ...Object.keys(config)].join(', ');
        const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
        const values = [guildId, ...Object.values(config)];
        db.prepare(`INSERT INTO rating_panel_configs (${fields}) VALUES (${placeholders})`).run(...values);
    }
}

/**
 * Obtém configuração de recrutamento de um servidor
 */
function getRecruitmentConfig(guildId) {
    const config = db.prepare('SELECT * FROM recruitment_configs WHERE guild_id = ?').get(guildId);
    if (config && config.questions) {
        config.questions = JSON.parse(config.questions);
    }
    return config;
}

/**
 * Salva/atualiza configuração de recrutamento
 */
function saveRecruitmentConfig(guildId, config) {
    getGuildConfig(guildId);
    const existing = getRecruitmentConfig(guildId);
    
    const data = { ...config };
    if (data.questions) {
        data.questions = JSON.stringify(data.questions);
    }

    if (existing) {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), guildId];
        db.prepare(`UPDATE recruitment_configs SET ${fields} WHERE guild_id = ?`).run(...values);
    } else {
        const fields = ['guild_id', ...Object.keys(data)].join(', ');
        const placeholders = Array(Object.keys(data).length + 1).fill('?').join(', ');
        const values = [guildId, ...Object.values(data)];
        db.prepare(`INSERT INTO recruitment_configs (${fields}) VALUES (${placeholders})`).run(...values);
    }
}


/**
 * Obtém configuração de welcome de um servidor
 */
function getWelcomeConfig(guildId) {
  return db.prepare('SELECT * FROM welcome_configs WHERE guild_id = ?').get(guildId);
}

/**
 * Salva/atualiza configuração de welcome
 */
function saveWelcomeConfig(guildId, config) {
  // Garante que guild_config existe primeiro (FOREIGN KEY)
  getGuildConfig(guildId);
  
  const existing = getWelcomeConfig(guildId);
  
  if (existing) {
    const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(config), guildId];
    db.prepare(`UPDATE welcome_configs SET ${fields} WHERE guild_id = ?`).run(...values);
  } else {
    const fields = ['guild_id', ...Object.keys(config)].join(', ');
    const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
    const values = [guildId, ...Object.values(config)];
    db.prepare(`INSERT INTO welcome_configs (${fields}) VALUES (${placeholders})`).run(...values);
  }
}

/**
 * Obtém configuração de goodbye de um servidor
 */
function getGoodbyeConfig(guildId) {
  return db.prepare('SELECT * FROM goodbye_configs WHERE guild_id = ?').get(guildId);
}

/**
 * Salva/atualiza configuração de goodbye
 */
function saveGoodbyeConfig(guildId, config) {
  // Garante que guild_config existe primeiro (FOREIGN KEY)
  getGuildConfig(guildId);
  
  const existing = getGoodbyeConfig(guildId);
  
  if (existing) {
    const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(config), guildId];
    db.prepare(`UPDATE goodbye_configs SET ${fields} WHERE guild_id = ?`).run(...values);
  } else {
    const fields = ['guild_id', ...Object.keys(config)].join(', ');
    const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
    const values = [guildId, ...Object.values(config)];
    db.prepare(`INSERT INTO goodbye_configs (${fields}) VALUES (${placeholders})`).run(...values);
  }
}

/**
 * Obtém configuração do FiveM de um servidor
 */
function getFiveMConfig(guildId) {
  return db.prepare('SELECT * FROM fivem_configs WHERE guild_id = ?').get(guildId);
}

/**
 * Obtém todas as configurações do FiveM ativas
 */
function getAllFiveMConfigs() {
  return db.prepare('SELECT * FROM fivem_configs').all();
}

/**
 * Salva/atualiza configuração do FiveM
 */
function saveFiveMConfig(guildId, config) {
  // Garante que guild_config existe primeiro (FOREIGN KEY)
  getGuildConfig(guildId);

  const existing = getFiveMConfig(guildId);

  if (existing) {
    if (config === null) {
      // Se config é null, remove a configuração
      db.prepare('DELETE FROM fivem_configs WHERE guild_id = ?').run(guildId);
    } else {
      // Remove chaves que não devem ser atualizadas se forem nulas (ex: banner_url pode ser null)
      const validConfig = Object.fromEntries(
        Object.entries(config).filter(([, value]) => value !== undefined)
      );
      
      const fields = Object.keys(validConfig).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(validConfig), guildId];
      
      if (fields.length > 0) {
        db.prepare(`UPDATE fivem_configs SET ${fields} WHERE guild_id = ?`).run(...values);
      }
    }
  } else if (config !== null) {
    const fields = ['guild_id', ...Object.keys(config)].join(', ');
    const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
    const values = [guildId, ...Object.values(config)];
    db.prepare(`INSERT INTO fivem_configs (${fields}) VALUES (${placeholders})`).run(...values);
  }
}

// -----------------------------------------------------
// ✨ FUNÇÃO PARA EXPORTAR E SETAR O HANDLER (NOVO)
// -----------------------------------------------------

/**
 * Define o módulo do handler de painel de avaliação.
 * Chamado em src/index.js (ou onde o bot é inicializado).
 */
function setRatingPanelHandler(handler) {
    ratingPanelHandler = handler;
}


module.exports = {
  getDatabase,
  initializeDatabase,
  getGuildConfig,
  updateGuildConfig,
  getWhitelistConfig,
  saveWhitelistConfig,
  getTicketConfig,
  saveTicketConfig,
  getTicketCategories,
  addTicketCategory,
  removeTicketCategory,
  createTicket,
  claimTicket,
  getTicketByChannel,
  closeTicket,
  getUserTickets,
  // ✅ EXPORTAÇÃO CORRIGIDA: Usa o nome esperado pelo handler
  getTicketById, 
  getTotalOpenTickets, 
  getTotalClosedTickets, 
  getTotalPendingWhitelists, 
  getTotalApprovedWhitelists, 
  createPendingWhitelist,
  getPendingWhitelistByChannel,
  updatePendingWhitelist,
	  getTicketStats,
	  saveTicketRating,
	  getTicketRating,
	  getGuildRatings,
	  getRatingStats,
	  // ✨ NOVAS EXPORTAÇÕES
	  getTotalTicketsAtendidosGlobal,
	  getTotalWhitelistsAprovadasGlobal,
	  getMediaAvaliacoesGlobal,
  getRatingPanelConfig,
  getAllRatingConfigs,
  saveRatingPanelConfig,
  setRatingPanelHandler,
  getRecruitmentConfig,
  saveRecruitmentConfig,
  // FIM NOVAS EXPORTAÇÕES
	  getWelcomeConfig,
    getDatabase,
  saveWelcomeConfig,
  getGoodbyeConfig,
  saveGoodbyeConfig,
  getFiveMConfig,
  getAllFiveMConfigs,
  saveFiveMConfig
};

/**
 * Funções para IA de Atendimento
 */

function getAIPanelConfig(guildId) {
    return db.prepare('SELECT * FROM ai_panel_configs WHERE guild_id = ?').get(guildId);
}

function saveAIPanelConfig(guildId, config) {
    getGuildConfig(guildId);
    const existing = getAIPanelConfig(guildId);
    if (existing) {
        const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(config), guildId];
        db.prepare(`UPDATE ai_panel_configs SET ${fields} WHERE guild_id = ?`).run(...values);
    } else {
        const fields = ['guild_id', ...Object.keys(config)].join(', ');
        const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
        const values = [guildId, ...Object.values(config)];
        db.prepare(`INSERT INTO ai_panel_configs (${fields}) VALUES (${placeholders})`).run(...values);
    }
}

function createAIConversation(guildId, userId, associatedChannelId = null) {
    const result = db.prepare('INSERT INTO ai_conversations (guild_id, user_id, associated_channel_id, current_state) VALUES (?, ?, ?, ?)').run(guildId, userId, associatedChannelId, JSON.stringify({ step: 'welcome' }));
    return result.lastInsertRowid;
}

function getActiveAIConversation(guildId, userId) {
    return db.prepare('SELECT * FROM ai_conversations WHERE guild_id = ? AND user_id = ? AND status = "active"').get(guildId, userId);
}

function updateAIConversation(id, updates) {
    if (updates.current_state) updates.current_state = JSON.stringify(updates.current_state);
    if (updates.history) updates.history = JSON.stringify(updates.history);
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];
    db.prepare(`UPDATE ai_conversations SET ${fields}, last_activity_time = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
}

function closeAIConversation(id) {
    db.prepare('UPDATE ai_conversations SET status = "closed", end_time = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

function saveAILearningData(data) {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).fill('?').join(', ');
    const values = Object.values(data);
    db.prepare(`INSERT INTO ai_learning_data (${fields}) VALUES (${placeholders})`).run(...values);
}

function getTopCategories(guildId, limit = 5) {
    return db.prepare('SELECT category_chosen, COUNT(*) as count FROM ai_learning_data WHERE guild_id = ? GROUP BY category_chosen ORDER BY count DESC LIMIT ?').all(guildId, limit);
}

module.exports = {
    ...module.exports,
    getAIPanelConfig,
    saveAIPanelConfig,
    createAIConversation,
    getActiveAIConversation,
    updateAIConversation,
    closeAIConversation,
    saveAILearningData,
    getTopCategories
};

/**
 * Funções do Cérebro da IA (Knowledge Base)
 */

function getAIKnowledge(term) {
    const knowledge = db.prepare('SELECT * FROM ai_knowledge_base WHERE key_term = ?').get(term.toLowerCase());
    if (knowledge) {
        db.prepare('UPDATE ai_knowledge_base SET usage_count = usage_count + 1 WHERE id = ?').run(knowledge.id);
    }
    return knowledge;
}

function saveAIKnowledge(term, response, category = 'general', creator = 'system') {
    return db.prepare('INSERT OR REPLACE INTO ai_knowledge_base (key_term, response_data, category, created_by) VALUES (?, ?, ?, ?)').run(term.toLowerCase(), response, category, creator);
}

function addRecentMemory(userId, guildId, type, summary, sentiment = 'neutral') {
    return db.prepare('INSERT INTO ai_recent_memories (user_id, guild_id, interaction_type, content_summary, sentiment) VALUES (?, ?, ?, ?, ?)').run(userId, guildId, type, summary, sentiment);
}

function getRecentMemories(userId, guildId, limit = 5) {
    return db.prepare('SELECT * FROM ai_recent_memories WHERE user_id = ? AND guild_id = ? ORDER BY timestamp DESC LIMIT ?').all(userId, guildId, limit);
}

function addPendingLearning(input, suggestedCategory = null) {
    return db.prepare('INSERT INTO ai_pending_learning (raw_input, suggested_category) VALUES (?, ?)').run(input, suggestedCategory);
}

module.exports = {
    ...module.exports,
    getAIKnowledge,
    saveAIKnowledge,
    addRecentMemory,
    getRecentMemories,
    addPendingLearning
};

/**
 * Funções de Identidade e Voz da IA
 */

function trackUserIdentity(userId, guildId, currentName) {
    const existing = db.prepare('SELECT * FROM user_identity_history WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    
    if (existing) {
        if (existing.current_name !== currentName) {
            db.prepare('UPDATE user_identity_history SET previous_name = ?, current_name = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(existing.current_name, currentName, existing.id);
            return { changed: true, previous: existing.current_name, current: currentName };
        } else {
            db.prepare('UPDATE user_identity_history SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(existing.id);
            return { changed: false, current: currentName };
        }
    } else {
        db.prepare('INSERT INTO user_identity_history (user_id, guild_id, current_name) VALUES (?, ?, ?)').run(userId, guildId, currentName);
        return { changed: false, is_new: true, current: currentName };
    }
}

function getAIVoiceConfig(guildId) {
    return db.prepare('SELECT * FROM ai_voice_configs WHERE guild_id = ?').get(guildId);
}

function saveAIVoiceConfig(guildId, config) {
    const existing = getAIVoiceConfig(guildId);
    if (existing) {
        const fields = Object.keys(config).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(config), guildId];
        db.prepare(`UPDATE ai_voice_configs SET ${fields} WHERE guild_id = ?`).run(...values);
    } else {
        const fields = ['guild_id', ...Object.keys(config)].join(', ');
        const placeholders = Array(Object.keys(config).length + 1).fill('?').join(', ');
        const values = [guildId, ...Object.values(config)];
        db.prepare(`INSERT INTO ai_voice_configs (${fields}) VALUES (${placeholders})`).run(...values);
    }
}

module.exports = {
    ...module.exports,
    trackUserIdentity,
    getAIVoiceConfig,
    saveAIVoiceConfig
};

function toggleUserVoice(userId, guildId) {
    const existing = db.prepare('SELECT voice_enabled FROM user_identity_history WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (existing) {
        const newValue = existing.voice_enabled === 1 ? 0 : 1;
        db.prepare('UPDATE user_identity_history SET voice_enabled = ? WHERE user_id = ? AND guild_id = ?').run(newValue, userId, guildId);
        return newValue;
    }
    return 1;
}

module.exports = {
    ...module.exports,
    toggleUserVoice
};
