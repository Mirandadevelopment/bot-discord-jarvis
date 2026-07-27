const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

async function run() {
    console.log('🚀 INICIANDO CRIAÇÃO FORÇADA DE TABELAS...\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ ERRO: DATABASE_URL não encontrada no arquivo .env');
        process.exit(1);
    }

    console.log(`🔗 Conectando em: ${process.env.DATABASE_URL.replace(/:.*@/, ':****@')}`);

    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        console.log('✅ Conexão estabelecida!');

        const tables = [
            `CREATE TABLE IF NOT EXISTS bot_license_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                openId VARCHAR(64) UNIQUE NOT NULL,
                discordId VARCHAR(64) UNIQUE,
                name VARCHAR(255),
                email VARCHAR(320),
                role ENUM('prospect', 'client', 'admin') DEFAULT 'prospect',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_licenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                licenseKey VARCHAR(64) UNIQUE NOT NULL,
                plan ENUM('monthly', 'quarterly', 'semiannual', 'annual') NOT NULL,
                status ENUM('active', 'expired', 'suspended', 'cancelled') DEFAULT 'active',
                expiryDate DATETIME NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_instances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                licenseId INT,
                userId INT NOT NULL,
                botToken VARCHAR(255) NOT NULL,
                discordServerId VARCHAR(64) NOT NULL,
                discordOwnerId VARCHAR(64) NOT NULL,
                status ENUM('running', 'stopped', 'error', 'migrating') DEFAULT 'stopped',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_license_transfers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                licenseId INT NOT NULL,
                fromUserId INT NOT NULL,
                toUserId INT,
                status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
                requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                licenseId INT,
                type ENUM('purchase', 'renewal', 'transfer', 'refund') NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                licenseId INT,
                fileName VARCHAR(255) NOT NULL,
                fileUrl TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                isRead BOOLEAN DEFAULT FALSE,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS bot_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT,
                action VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            const tableName = sql.match(/TABLE IF NOT EXISTS (\w+)/)[1];
            try {
                await connection.execute(sql);
                console.log(`✅ Tabela '${tableName}': PRONTA`);
            } catch (err) {
                console.error(`❌ Erro na tabela '${tableName}': ${err.message}`);
            }
        }

        await connection.end();
        console.log('\n✨ PROCESSO CONCLUÍDO! Tente rodar npm start agora.');

    } catch (error) {
        console.error(`\n❌ ERRO FATAL DE CONEXÃO: ${error.message}`);
        console.log('\n💡 Verifique se o MySQL está rodando e se os dados no .env estão corretos.');
    }
}

run();
