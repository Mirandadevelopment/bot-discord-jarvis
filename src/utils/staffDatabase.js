
const logger = require('./system-logs');

/**
 * Inicializa as tabelas necessárias para o sistema de staff.
 */
function initializeStaffTables() {
    const db = require('./database').getDatabase();
    try {
        // Tabela de Configuração de Staff por Guilda
        db.prepare(`
            CREATE TABLE IF NOT EXISTS staff_config (
                guild_id TEXT PRIMARY KEY,
                staff_role_ids TEXT,
                control_channel_id TEXT,
                log_channel_id TEXT,
                public_panel_channel_id TEXT,
                public_panel_message_id TEXT,
                admin_role_id TEXT
            )
        `).run();

        // Migração: Adiciona admin_role_id se não existir
        try { db.prepare('ALTER TABLE staff_config ADD COLUMN admin_role_id TEXT').run(); } catch (e) {}

        // Tabela de Membros da Staff Gerenciados
        db.prepare(`
            CREATE TABLE IF NOT EXISTS managed_staff (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                staff_role_id TEXT,
                added_by_user_id TEXT,
                added_at INTEGER,
                UNIQUE(guild_id, user_id)
            )
        `).run();

        logger.consoleLog('success', 'Tabelas de Staff inicializadas com sucesso.');
    } catch (error) {
        logger.consoleLog('error', `Erro ao inicializar tabelas de Staff: ${error.message}`);
    }
}

/**
 * Obtém a configuração de staff para uma guilda.
 * @param {string} guildId O ID da guilda.
 * @returns {object | null} A configuração da staff ou null.
 */
function getStaffConfig(guildId) {
    const db = require('./database').getDatabase();
    try {
        const config = db.prepare('SELECT * FROM staff_config WHERE guild_id = ?').get(guildId);
        if (config && config.staff_role_ids) {
            config.staff_role_ids = JSON.parse(config.staff_role_ids);
        }
        return config;
    } catch (error) {
        logger.consoleLog('error', `Erro ao obter config de staff para ${guildId}: ${error.message}`);
        return null;
    }
}

/**
 * Salva ou atualiza a configuração de staff para uma guilda.
 * @param {string} guildId O ID da guilda.
 * @param {object} config Os campos de configuração a serem atualizados.
 */
function setStaffConfig(guildId, config) {
    const db = require('./database').getDatabase();
    try {
        const currentConfig = getStaffConfig(guildId) || { guild_id: guildId };
        const newConfig = { ...currentConfig, ...config };

        // Converte staff_role_ids para JSON string se for um array
        if (Array.isArray(newConfig.staff_role_ids)) {
            newConfig.staff_role_ids = JSON.stringify(newConfig.staff_role_ids);
        }

        const setClauses = Object.keys(newConfig)
            .filter(key => key !== 'guild_id')
            .map(key => `${key} = @${key}`)
            .join(', ');

        if (!setClauses) {
            logger.consoleLog('warning', `Nenhum campo para atualizar na staff_config para ${guildId}.`);
            return;
        }

        const stmt = db.prepare(`
            INSERT INTO staff_config (guild_id, ${Object.keys(newConfig).filter(k => k !== 'guild_id').join(', ')})
            VALUES (@guild_id, ${Object.keys(newConfig).filter(k => k !== 'guild_id').map(k => `@${k}`).join(', ')})
            ON CONFLICT(guild_id) DO UPDATE SET ${setClauses}
        `);
        
        stmt.run(newConfig);
        logger.consoleLog('success', `Configuração de staff atualizada para ${guildId}.`);
    } catch (error) {
        logger.consoleLog('error', `Erro ao salvar config de staff para ${guildId}: ${error.message}`);
    }
}

/**
 * Obtém todos os membros da staff gerenciados para uma guilda.
 * @param {string} guildId O ID da guilda.
 * @returns {Array<object>} Lista de membros da staff.
 */
function getManagedStaff(guildId) {
    const db = require('./database').getDatabase();
    try {
        return db.prepare('SELECT * FROM managed_staff WHERE guild_id = ? ORDER BY added_at ASC').all(guildId);
    } catch (error) {
        logger.consoleLog('error', `Erro ao obter staff gerenciada para ${guildId}: ${error.message}`);
        return [];
    }
}

/**
 * Adiciona um membro à staff gerenciada.
 * @param {string} guildId O ID da guilda.
 * @param {string} userId O ID do usuário.
 * @param {string} staffRoleId O ID do cargo de staff principal.
 * @param {string} addedByUserId O ID do usuário que adicionou.
 * @returns {boolean} True se adicionado, false se já existia.
 */
function addManagedStaff(guildId, userId, staffRoleId, addedByUserId) {
    const db = require('./database').getDatabase();
    try {
        const result = db.prepare(`
            INSERT OR IGNORE INTO managed_staff (guild_id, user_id, staff_role_id, added_by_user_id, added_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(guildId, userId, staffRoleId, addedByUserId, Date.now());
        
        return result.changes > 0;
    } catch (error) {
        logger.consoleLog('error', `Erro ao adicionar staff ${userId} em ${guildId}: ${error.message}`);
        return false;
    }
}

/**
 * Remove um membro da staff gerenciada.
 * @param {string} guildId O ID da guilda.
 * @param {string} userId O ID do usuário.
 * @returns {boolean} True se removido, false se não existia.
 */
function removeManagedStaff(guildId, userId) {
    const db = require('./database').getDatabase();
    try {
        const result = db.prepare('DELETE FROM managed_staff WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        return result.changes > 0;
    } catch (error) {
        logger.consoleLog('error', `Erro ao remover staff ${userId} em ${guildId}: ${error.message}`);
        return false;
    }
}

/**
 * Obtém todas as configurações de staff.
 * @returns {Array<object>} Lista de todas as configurações de staff.
 */
function getAllStaffConfigs() {
    const db = require('./database').getDatabase();
    try {
        const configs = db.prepare('SELECT * FROM staff_config').all();
        return configs.map(config => {
            if (config.staff_role_ids) {
                config.staff_role_ids = JSON.parse(config.staff_role_ids);
            }
            return config;
        });
    } catch (error) {
        logger.consoleLog('error', `Erro ao obter todas as configs de staff: ${error.message}`);
        return [];
    }
}

module.exports = {
    initializeStaffTables,
    getStaffConfig,
    setStaffConfig,
    getManagedStaff,
    addManagedStaff,
    removeManagedStaff,
    getAllStaffConfigs
};
