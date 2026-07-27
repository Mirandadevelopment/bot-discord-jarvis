const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔍 INICIANDO DIAGNÓSTICO MESTRE DO JARVIS 🔍\n');

const results = [];

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}: OK`);
        results.push({ name, status: 'OK' });
    } catch (error) {
        console.log(`❌ ${name}: FALHOU (${error.message})`);
        results.push({ name, status: 'FALHOU', error: error.message });
    }
}

// 1. Verificar .env
test('Arquivo .env', () => {
    if (!fs.existsSync('.env')) throw new Error('Arquivo .env não encontrado!');
    const content = fs.readFileSync('.env', 'utf8');
    if (!content.includes('TOKEN=')) throw new Error('TOKEN do bot não configurado no .env');
    if (!content.includes('DATABASE_URL=')) throw new Error('DATABASE_URL do MySQL não configurada no .env');
});

// 2. Verificar node_modules
test('Módulos do Bot', () => {
    if (!fs.existsSync('node_modules')) throw new Error('Pasta node_modules do bot não encontrada! Execute: npm install');
});

test('Módulos do Website', () => {
    if (!fs.existsSync('website/node_modules')) throw new Error('Pasta node_modules do website não encontrada! Execute: cd website && npm install');
});

// 3. Verificar Porta 3000
test('Porta 3000 (Site)', () => {
    try {
        // No Windows, usamos netstat. No Linux/Mac usamos lsof.
        const cmd = process.platform === 'win32' ? 'netstat -ano | findstr :3000' : 'lsof -i :3000';
        const output = execSync(cmd).toString();
        if (output) throw new Error('A porta 3000 já está sendo usada por outro programa!');
    } catch (e) {
        // Se o comando falhar (não encontrar nada), a porta está livre.
    }
});

// 4. Testar Bibliotecas de Áudio
test('Bibliotecas de Áudio', () => {
    require('@discordjs/voice');
    require('gtts');
});

// 5. Verificar Arquivo de Inicialização
test('Script de Início', () => {
    if (!fs.existsSync('src/index.js')) throw new Error('Arquivo src/index.js não encontrado!');
    if (!fs.existsSync('website/dist/index.js') && !fs.existsSync('website/server/_core/index.ts')) {
        throw new Error('Website não está compilado ou pronto para dev!');
    }
});

console.log('\n--- RESUMO DO DIAGNÓSTICO ---\n');
const failures = results.filter(r => r.status === 'FALHOU');
if (failures.length === 0) {
    console.log('🚀 TUDO PARECE CORRETO! Tente iniciar com: npm start');
} else {
    console.log('⚠️ FORAM ENCONTRADOS PROBLEMAS:');
    failures.forEach(f => console.log(`- ${f.name}: ${f.error}`));
    console.log('\n💡 Corrija os problemas acima e tente novamente.');
}
