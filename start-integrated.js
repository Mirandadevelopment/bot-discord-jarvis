#!/usr/bin/env node

/**
 * 🤖 Bot Discord + Website de Licenças - Inicializador Integrado
 * 
 * Este script verifica se o setup foi feito e inicia o Bot Discord 
 * e o Website de Licenças juntos na mesma VPS.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { checkSetup } = require('./init-check');

// Carregar variáveis de ambiente
dotenv.config();

const isDev = process.argv.includes('--dev');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                                                                ║');
console.log('║  🤖 Bot Discord Professional v3.0 + Website de Licenças      ║');
console.log('║                                                                ║');
console.log('║  Inicializador Integrado - Bot + Website Juntos              ║');
console.log('║                                                                ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(service, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`${color}[${timestamp}] [${service}]${colors.reset} ${message}`);
}

async function main() {
  try {
    // Verificar setup
    log('LAUNCHER', 'Verificando configuração...', colors.blue);
    
    // Auto-setup: Ignora verificação rígida e tenta iniciar
    log('LAUNCHER', 'Iniciando em modo Plug & Play...', colors.blue);

    console.log(`\n${colors.bright}Modo: ${isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO'}${colors.reset}\n`);

    // Validar variáveis obrigatórias
    const required = ['TOKEN', 'GUILD_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      log('LAUNCHER', `Variáveis obrigatórias faltando: ${missing.join(', ')}`, colors.red);
      log('LAUNCHER', 'Configure em .env e tente novamente', colors.yellow);
      process.exit(1);
    }

    // Iniciar Bot Discord
    log('LAUNCHER', 'Iniciando Bot Discord...', colors.blue);
    
    const botProcess = spawn('node', ['src/index.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    });

    botProcess.on('error', (error) => {
      log('BOT', `Falha ao iniciar: ${error.message}`, colors.red);
      process.exit(1);
    });

    botProcess.on('exit', (code) => {
      if (code !== 0) {
        log('BOT', `Encerrado com código ${code}`, colors.red);
      }
    });

    log('BOT', 'Processo do Bot iniciado', colors.green);

    // Iniciar Website
    log('LAUNCHER', 'Iniciando Website de Licenças...', colors.blue);
    
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const websiteProcess = spawn(npmCmd, ['run', isDev ? 'dev' : 'start'], {
      cwd: path.join(__dirname, 'website'),
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    });

    websiteProcess.on('error', (error) => {
      log('WEBSITE', `Falha ao iniciar: ${error.message}`, colors.red);
      process.exit(1);
    });

    websiteProcess.on('exit', (code) => {
      if (code !== 0) {
        log('WEBSITE', `Encerrado com código ${code}`, colors.red);
      }
    });

    log('WEBSITE', 'Processo do Website iniciado', colors.green);

    console.log(`\n${colors.bright}✅ Ambos os serviços iniciados com sucesso!${colors.reset}`);
    console.log(`${colors.green}🤖 Bot Discord: Conectado à API do Discord${colors.reset}`);
    console.log(`${colors.green}🌐 Website: http://localhost:3000${colors.reset}`);
    console.log(`\n${colors.yellow}Pressione Ctrl+C para parar todos os serviços${colors.reset}\n`);

    // Tratamento de encerramento gracioso
    process.on('SIGINT', () => {
      log('LAUNCHER', 'Encerrando serviços...', colors.yellow);
      botProcess.kill();
      websiteProcess.kill();
      setTimeout(() => process.exit(0), 1000);
    });

    process.on('SIGTERM', () => {
      log('LAUNCHER', 'Encerrando serviços...', colors.yellow);
      botProcess.kill();
      websiteProcess.kill();
      setTimeout(() => process.exit(0), 1000);
    });

  } catch (error) {
    log('LAUNCHER', `Erro fatal: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Executar
main();
