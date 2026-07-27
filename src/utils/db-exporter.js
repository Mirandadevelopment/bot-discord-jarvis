const fs = require('fs');
const path = require('path');

/**
 * DB Exporter Module
 * Gera dumps SQL compatíveis com HeidiSQL/MySQL/SQLite para portabilidade.
 */

function generateSQLDump(db) {
    let sql = `-- Discord Bot Professional v3.0 - ULTRA EDITION\n`;
    sql += `-- Database Export - ${new Date().toISOString()}\n\n`;
    sql += `PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n\n`;

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

    for (const table of tables) {
        const tableName = table.name;
        
        // Skip internal or session tables if any
        if (tableName === 'whitelist_pending') continue;

        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();

        sql += `-- Table: ${tableName}\n`;
        sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        sql += columns.map(c => `  ${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value !== null ? ' DEFAULT ' + c.dflt_value : ''}`).join(',\n');
        sql += `\n);\n\n`;

        for (const row of rows) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(v => {
                if (v === null) return 'NULL';
                if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
                return v;
            });
            sql += `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sql += `\n`;
    }

    sql += `COMMIT;\nPRAGMA foreign_keys=ON;\n`;
    return sql;
}

function exportToFile(db, filePath) {
    try {
        const dump = generateSQLDump(db);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, dump);
        return true;
    } catch (error) {
        console.error('Erro ao exportar banco de dados:', error);
        return false;
    }
}

module.exports = { exportToFile, generateSQLDump };
