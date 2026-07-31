#!/usr/bin/env node

/**
 * ✅ Verificador de Inicialização
 * 
 * Verifica se o setup foi feito e se o banco está pronto
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkSetup() {
  const envPath = path.join(__dirname, '.env');

  // Verificar se .env existe
  if (!fs.existsSync(envPath)) {
    log('\n❌ Arquivo .env não encontrado!', colors.red);
    log('Execute: npm run setup\n', colors.yellow);
    return false;
  }

  // Ler .env
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const databaseUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1];

  if (!databaseUrl) {
    log('\n❌ DATABASE_URL não configurada em .env!', colors.red);
    log('Execute: npm run setup\n', colors.yellow);
    return false;
  }

  // Testar conexão
  try {
    log('\n🔗 Testando conexão com banco de dados...', colors.blue);

    const connection = await mysql.createConnection(databaseUrl);

    // Verificar se tabelas existem
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
    );

    const requiredTables = [
      'bot_license_users',
      'bot_licenses',
      'bot_instances',
      'bot_license_transfers',
      'bot_transactions',
      'bot_documents',
      'bot_notifications',
      'bot_audit_logs',
    ];

    const existingTables = tables.map(t => t.TABLE_NAME);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      log('⚠️  Algumas tabelas estão faltando, mas vou tentar iniciar assim mesmo...', colors.yellow);
      missingTables.forEach(t => log(`  - ${t}`, colors.yellow));
      await connection.end();
      return true; // Permitir inicialização mesmo faltando tabelas
    }

    log('✅ Banco de dados configurado corretamente!', colors.green);
    log(`✅ ${existingTables.length} tabelas encontradas\n`, colors.green);

    await connection.end();
    return true;

  } catch (error) {
    log(`\n❌ Erro ao conectar ao banco: ${error.message}`, colors.red);
    log('Verifique as credenciais em .env\n', colors.red);
    return false;
  }
}

module.exports = { checkSetup };

if (require.main === module) {
  checkSetup().then(success => {
    process.exit(success ? 0 : 1);
  });
}
