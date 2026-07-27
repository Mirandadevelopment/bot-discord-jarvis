/**
 * 🗄️ Configuração de Banco de Dados
 * 
 * Este arquivo é gerado automaticamente pelo setup.js
 * Não edite manualmente - use: npm run setup
 */

module.exports = {
  // Credenciais do MySQL
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    port: process.env.DB_PORT || 3306,
  },

  // URL de conexão (gerada automaticamente)
  connectionUrl: process.env.DATABASE_URL || '',

  // Configurações de pool
  pool: {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },

  // Tabelas criadas
  tables: [
    'bot_license_users',
    'bot_licenses',
    'bot_instances',
    'bot_license_transfers',
    'bot_transactions',
    'bot_documents',
    'bot_notifications',
    'bot_audit_logs',
  ],
};
