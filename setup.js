#!/usr/bin/env node

/**
 * 🔧 Setup Interativo - Bot Discord + Website de Licenças
 * 
 * Este script coleta as credenciais do MySQL e cria as tabelas automaticamente
 * no banco de dados existente da sua cidade FiveM.
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testConnection(host, user, password, database) {
  try {
    // Tenta conectar sem especificar o banco primeiro para ver se o servidor está online
    const rootConnection = await mysql.createConnection({
      host,
      user,
      password,
    });

    // Tenta criar o banco de dados se ele não existir
    log(`🛠️  Tentando garantir que o banco '${database}' existe...`, colors.yellow);
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await rootConnection.end();

    // Agora tenta conectar ao banco específico
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
    });

    await connection.end();
    return true;
  } catch (error) {
    log(`⚠️  Erro detalhado na conexão: ${error.message}`, colors.red);
    return false;
  }
}

async function createTables(connection) {
  const tables = [
    // Tabela de Usuários/Clientes
    `CREATE TABLE IF NOT EXISTS bot_license_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openId VARCHAR(64) UNIQUE NOT NULL,
      discordId VARCHAR(64) UNIQUE,
      name VARCHAR(255),
      email VARCHAR(320),
      role ENUM('prospect', 'client', 'admin') DEFAULT 'prospect',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_openId (openId),
      INDEX idx_discordId (discordId),
      INDEX idx_role (role)
    )`,

    // Tabela de Licenças
    `CREATE TABLE IF NOT EXISTS bot_licenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      licenseKey VARCHAR(64) UNIQUE NOT NULL,
      plan ENUM('monthly', 'quarterly', 'semiannual', 'annual') NOT NULL,
      status ENUM('active', 'expired', 'suspended', 'cancelled') DEFAULT 'active',
      startDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiryDate DATETIME NOT NULL,
      stripeSubscriptionId VARCHAR(255),
      stripeCustomerId VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES bot_license_users(id) ON DELETE CASCADE,
      INDEX idx_userId (userId),
      INDEX idx_status (status),
      INDEX idx_expiryDate (expiryDate),
      UNIQUE KEY unique_key (licenseKey)
    `,

    // Tabela de Instâncias de Bot
    `CREATE TABLE IF NOT EXISTS bot_instances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      licenseId INT,
      userId INT NOT NULL,
      botToken VARCHAR(255) NOT NULL,
      discordServerId VARCHAR(64) NOT NULL,
      discordOwnerId VARCHAR(64) NOT NULL,
      instanceName VARCHAR(255),
      status ENUM('running', 'stopped', 'error', 'migrating') DEFAULT 'stopped',
      lastHealthCheck DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES bot_license_users(id) ON DELETE CASCADE,
      INDEX idx_licenseId (licenseId),
      INDEX idx_userId (userId),
      INDEX idx_status (status)
    `,

    // Tabela de Transferências de Licenças
    `CREATE TABLE IF NOT EXISTS bot_license_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      licenseId INT NOT NULL,
      fromUserId INT NOT NULL,
      toUserId INT,
      toEmail VARCHAR(320),
      status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
      requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      approvedAt DATETIME,
      completedAt DATETIME,
      rejectionReason TEXT,
      approvedBy INT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (licenseId) REFERENCES bot_licenses(id) ON DELETE CASCADE,
      FOREIGN KEY (fromUserId) REFERENCES bot_license_users(id) ON DELETE CASCADE,
      INDEX idx_licenseId (licenseId),
      INDEX idx_status (status),
      INDEX idx_fromUserId (fromUserId)
    `,

    // Tabela de Transações
    `CREATE TABLE IF NOT EXISTS bot_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      licenseId INT,
      type ENUM('purchase', 'renewal', 'transfer', 'refund') NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD',
      status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
      stripePaymentIntentId VARCHAR(255),
      stripeInvoiceId VARCHAR(255),
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES bot_license_users(id) ON DELETE CASCADE,
      INDEX idx_userId (userId),
      INDEX idx_status (status),
      INDEX idx_type (type)
    `,

    // Tabela de Documentos
    `CREATE TABLE IF NOT EXISTS bot_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      licenseId INT,
      fileName VARCHAR(255) NOT NULL,
      fileKey VARCHAR(255) NOT NULL,
      fileUrl TEXT NOT NULL,
      fileSize INT,
      mimeType VARCHAR(100),
      documentType ENUM('payment_proof', 'transfer_agreement', 'audit_log', 'other') DEFAULT 'other',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES bot_license_users(id) ON DELETE CASCADE,
      INDEX idx_userId (userId),
      INDEX idx_licenseId (licenseId)
    `,

    // Tabela de Notificações
    `CREATE TABLE IF NOT EXISTS bot_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      type ENUM('payment', 'transfer', 'expiry', 'system') DEFAULT 'system',
      isRead BOOLEAN DEFAULT FALSE,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      readAt DATETIME,
      FOREIGN KEY (userId) REFERENCES bot_license_users(id) ON DELETE CASCADE,
      INDEX idx_userId (userId),
      INDEX idx_isRead (isRead)
    )`,

    // Tabela de Logs de Auditoria
    `CREATE TABLE IF NOT EXISTS bot_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      action VARCHAR(255) NOT NULL,
      entity VARCHAR(100),
      entityId INT,
      oldValue JSON,
      newValue JSON,
      ipAddress VARCHAR(45),
      userAgent TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES bot_license_users(id) ON DELETE SET NULL,
      INDEX idx_userId (userId),
      INDEX idx_action (action),
      INDEX idx_createdAt (createdAt)
    )`,
  ];

  for (const table of tables) {
    try {
      await connection.execute(table);
    } catch (error) {
      log(`⚠️  Erro ao criar tabela: ${error.message}`, colors.yellow);
    }
  }
}

async function main() {
  console.clear();
  log('\n╔════════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║                                                                ║', colors.cyan);
  log('║  🔧 SETUP - Bot Discord + Website de Licenças                ║', colors.cyan);
  log('║                                                                ║', colors.cyan);
  log('║  Configuração Automática do Banco de Dados                   ║', colors.cyan);
  log('║                                                                ║', colors.cyan);
  log('╚════════════════════════════════════════════════════════════════╝\n', colors.cyan);

  try {
    // Coletar credenciais
    log('📋 Digite as credenciais do seu banco de dados MySQL:', colors.blue);
    log('(Deixe em branco para usar valores padrão)\n', colors.yellow);

    const host = await question(`${colors.magenta}Host [localhost]:${colors.reset} `) || 'localhost';
    const user = await question(`${colors.magenta}Usuário [root]:${colors.reset} `) || 'root';
    const password = await question(`${colors.magenta}Senha:${colors.reset} `) || '';
    const database = await question(`${colors.magenta}Banco de Dados:${colors.reset} `);

    if (!database) {
      log('\n❌ Banco de dados é obrigatório!', colors.red);
      rl.close();
      process.exit(1);
    }

    log('\n🔗 Testando conexão...', colors.blue);

    const isConnected = await testConnection(host, user, password, database);

    if (!isConnected) {
      log('❌ Falha ao conectar ao banco de dados!', colors.red);
      log('Verifique as credenciais e tente novamente.\n', colors.red);
      rl.close();
      process.exit(1);
    }

    log('✅ Conexão bem-sucedida!\n', colors.green);

    // Criar conexão para executar queries
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
    });

    log('📊 Criando tabelas de licenças...', colors.blue);
    await createTables(connection);
    log('✅ Tabelas criadas com sucesso!\n', colors.green);

    await connection.end();

    // Salvar credenciais no .env
    log('💾 Salvando configurações...', colors.blue);

    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Atualizar ou adicionar DATABASE_URL
    const databaseUrl = `mysql://${user}:${password}@${host}:3306/${database}`;
    
    if (envContent.includes('DATABASE_URL')) {
      envContent = envContent.replace(
        /DATABASE_URL=.*/,
        `DATABASE_URL=${databaseUrl}`
      );
    } else {
      envContent += `\n# Database Configuration\nDATABASE_URL=${databaseUrl}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    log('✅ Arquivo .env atualizado!\n', colors.green);

    // Resumo
    log('╔════════════════════════════════════════════════════════════════╗', colors.green);
    log('║                    ✅ SETUP CONCLUÍDO!                        ║', colors.green);
    log('╚════════════════════════════════════════════════════════════════╝\n', colors.green);

    log('📊 Informações Salvas:', colors.cyan);
    log(`  Host: ${host}`, colors.cyan);
    log(`  Usuário: ${user}`, colors.cyan);
    log(`  Banco: ${database}`, colors.cyan);
    log(`  DATABASE_URL: ${databaseUrl}\n`, colors.cyan);

    log('📁 Tabelas Criadas:', colors.cyan);
    log('  ✅ bot_license_users', colors.cyan);
    log('  ✅ bot_licenses', colors.cyan);
    log('  ✅ bot_instances', colors.cyan);
    log('  ✅ bot_license_transfers', colors.cyan);
    log('  ✅ bot_transactions', colors.cyan);
    log('  ✅ bot_documents', colors.cyan);
    log('  ✅ bot_notifications', colors.cyan);
    log('  ✅ bot_audit_logs\n', colors.cyan);

    log('🚀 Próximos Passos:', colors.blue);
    log('  1. Instale dependências: npm run install-all', colors.blue);
    log('  2. Inicie o sistema: npm start', colors.blue);
    log('  3. Acesse: http://localhost:3000\n', colors.blue);

    log('💡 Você pode visualizar as tabelas no HeidiSQL:', colors.yellow);
    log(`  Host: ${host}`, colors.yellow);
    log(`  Usuário: ${user}`, colors.yellow);
    log(`  Banco: ${database}\n`, colors.yellow);

    rl.close();
    process.exit(0);

  } catch (error) {
    log(`\n❌ Erro: ${error.message}`, colors.red);
    rl.close();
    process.exit(1);
  }
}

main();
