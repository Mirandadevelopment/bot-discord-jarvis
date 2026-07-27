# 🔧 Guia de Setup - Bot Discord + Website de Licenças

## 🎯 O Que Este Sistema Faz

Este sistema permite que você:

1. **Configure seu banco de dados MySQL existente** (da cidade FiveM)
2. **O bot cria automaticamente** as tabelas de licenças no seu banco
3. **Acesse tudo pelo HeidiSQL** junto com seus dados da cidade
4. **Inicie bot + website** com um único comando

---

## 📋 Pré-Requisitos

- **Node.js 18+** instalado
- **MySQL/MariaDB** rodando
- **Seu banco de dados da cidade FiveM** já criado
- **Token do Bot Discord**

---

## 🚀 Passo a Passo (4 Passos)

### 1️⃣ Extraia o Projeto

Descompacte o arquivo `bot-discord-integrado-final.zip`:

```bash
unzip bot-discord-integrado-final.zip
cd bot-discord-real
```

### 2️⃣ Execute o Setup

```bash
npm install
npm run setup
```

**O script vai pedir:**

```
Host [localhost]: localhost
Usuário [root]: seu_usuario
Senha: sua_senha
Banco de Dados: sua_cidade_db
```

**O que acontece:**
- ✅ Testa conexão com seu MySQL
- ✅ Cria 8 tabelas de licenças no seu banco
- ✅ Salva credenciais no `.env`
- ✅ Tudo pronto!

### 3️⃣ Configure o Token Discord

Edite o arquivo `.env`:

```bash
nano .env
```

Procure por `TOKEN` e adicione seu token:

```env
TOKEN=seu_token_discord_aqui
GUILD_ID=seu_guild_id_aqui
```

### 4️⃣ Inicie o Sistema

```bash
npm start
```

**Você verá:**

```
✅ Ambos os serviços iniciados com sucesso!
🤖 Bot Discord: Conectado à API do Discord
🌐 Website: http://localhost:3000
```

---

## 🗄️ Tabelas Criadas Automaticamente

O setup cria estas tabelas no seu banco:

| Tabela | Descrição |
|--------|-----------|
| `bot_license_users` | Usuários/Clientes |
| `bot_licenses` | Licenças vendidas |
| `bot_instances` | Instâncias de bot por cliente |
| `bot_license_transfers` | Transferências de licenças |
| `bot_transactions` | Histórico de transações |
| `bot_documents` | Documentos (comprovantes, etc) |
| `bot_notifications` | Notificações do sistema |
| `bot_audit_logs` | Logs de auditoria |

---

## 📊 Acessando Pelo HeidiSQL

Depois que o setup termina, você pode acessar tudo pelo HeidiSQL:

1. Abra **HeidiSQL**
2. Clique em **"Novo"**
3. Configure:
   - **Host**: localhost (ou seu IP)
   - **Usuário**: seu_usuario
   - **Senha**: sua_senha
   - **Banco**: sua_cidade_db
4. Clique em **"Abrir"**

Você verá todas as tabelas de licenças junto com seus dados da cidade!

---

## 🌐 Acessando o Website

Depois de iniciar com `npm start`:

- **Home**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Admin**: http://localhost:3000/admin
- **Pricing**: http://localhost:3000/pricing

---

## 🔧 Comandos Disponíveis

```bash
# Setup interativo (cria tabelas automaticamente)
npm run setup

# Inicia bot + website juntos
npm start

# Modo desenvolvimento
npm run dev

# Só o bot
npm run start:bot-only

# Só o website
npm run website

# Instala tudo
npm run install-all

# Verifica se setup foi feito
node init-check.js
```

---

## 🆘 Troubleshooting

### "Erro ao conectar ao banco"

**Solução:**
```bash
# Verifique se MySQL está rodando
mysql -u seu_usuario -p seu_banco

# Se não conectar, verifique credenciais
# Execute setup novamente
npm run setup
```

### "Tabelas não foram criadas"

**Solução:**
```bash
# Verifique se as tabelas existem
npm run setup

# Ou verifique manualmente no HeidiSQL
# Banco → Tabelas → Procure por "bot_"
```

### "Bot não conecta ao Discord"

**Solução:**
```bash
# Verifique se TOKEN está em .env
grep TOKEN .env

# Se não tiver, edite:
nano .env
# Adicione: TOKEN=seu_token_aqui
```

### "Website não abre"

**Solução:**
```bash
# Verifique se porta 3000 está livre
netstat -tlnp | grep 3000

# Se estiver em uso, mate o processo ou use outra porta
```

---

## 📚 Arquivos Importantes

```
bot-discord-real/
├── setup.js                ← Script de setup interativo
├── init-check.js          ← Verifica se setup foi feito
├── start-integrated.js    ← Inicia bot + website
├── .env                   ← Suas credenciais (criado pelo setup)
├── .env.example           ← Template de .env
├── src/                   ← Bot Discord
└── website/               ← Website de Licenças
```

---

## 🔐 Segurança

- ✅ Credenciais salvas em `.env` (não em código)
- ✅ `.env` está no `.gitignore` (não vai para Git)
- ✅ Banco de dados isolado por usuário MySQL
- ✅ Senhas nunca são exibidas nos logs

---

## 💡 Próximos Passos

### Curto Prazo
1. ✅ Execute setup
2. ✅ Configure TOKEN Discord
3. ✅ Inicie com `npm start`
4. ✅ Teste em http://localhost:3000

### Médio Prazo
1. Customize o bot (adicione seus comandos)
2. Personalize o website (sua marca)
3. Configure Stripe para pagamentos
4. Teste fluxo completo

### Longo Prazo
1. Deploy em VPS
2. Configure domínio e HTTPS
3. Implemente recursos adicionais
4. Monitore e otimize

---

## 📞 Suporte

Se tiver problemas:

1. Verifique os logs: `npm start` (veja a saída)
2. Verifique `.env` está correto
3. Verifique se MySQL está rodando
4. Execute `npm run setup` novamente

---

## 🎉 Pronto!

Seu sistema está pronto para começar!

**Próximo passo:** Execute `npm run setup` e depois `npm start`

---

**Bot Discord Professional v3.0 + Website de Licenças**  
*Desenvolvido com ❤️ para sucesso do seu negócio*
