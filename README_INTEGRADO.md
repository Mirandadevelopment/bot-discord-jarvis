# 🤖 Bot Discord Professional v3.0 + Website de Licenças

**Sistema Integrado** - Bot Discord + Website de Gerenciamento de Licenças rodando juntos na mesma VPS!

---

## 🎯 O Que Você Tem Agora

### ✅ Bot Discord Professional v3.0
- Whitelist avançada (Steam ID)
- Sistema de Tickets de Suporte
- Monitoramento FiveM/RedM
- Gestão de Staff
- Logs de Auditoria
- Painéis Interativos

### ✅ Website de Gerenciamento de Licenças
- Painel de vendas com Stripe
- Dashboard administrativo
- Painel de cliente
- Sistema de transferência de licenças
- Painel de revenda
- Gráficos e estatísticas
- Notificações por email
- Upload de documentos

### ✅ Integração Completa
- **Um único comando** inicia bot + website
- Ambos rodam na **mesma VPS**
- Compartilham **mesmas variáveis de ambiente**
- Graceful shutdown automático

---

## 🚀 Como Usar (3 Passos)

### 1. Configure as Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite com suas credenciais
nano .env
```

**Credenciais obrigatórias:**
```env
# Discord Bot
TOKEN=seu_token_discord_aqui
GUILD_ID=seu_guild_id_aqui
DEVELOPER_ID=seu_discord_id_aqui

# Website - Database
DATABASE_URL=mysql://usuario:senha@localhost:3306/bot_license_manager

# Website - Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Website - JWT
JWT_SECRET=sua_chave_super_secreta_aqui
```

Veja `.env.example` para todas as variáveis opcionais.

### 2. Instale Dependências

```bash
# Instala dependências do bot + website
npm run install-all
```

Isso vai:
- ✅ Instalar dependências do bot
- ✅ Instalar dependências do website
- ✅ Preparar tudo para rodar

### 3. Inicie o Sistema

```bash
# Inicia bot + website juntos
npm start
```

Você verá:
```
✅ Ambos os serviços iniciados com sucesso!
🤖 Bot Discord: Conectado à API do Discord
🌐 Website: http://localhost:3000
```

---

## 🌐 Acessando o Sistema

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Website** | http://localhost:3000 | Painel de vendas |
| **Dashboard** | http://localhost:3000/dashboard | Suas licenças |
| **Admin** | http://localhost:3000/admin | Gerenciamento |
| **Pricing** | http://localhost:3000/pricing | Planos de venda |

---

## 📁 Estrutura do Projeto

```
bot-discord-real/
│
├── 📂 src/                         # Bot Discord Professional v3.0
│   ├── commands/                   # Comandos do bot
│   ├── events/                     # Listeners de eventos
│   ├── handlers/                   # Handlers de interações
│   ├── utils/                      # Utilitários
│   └── index.js                    # Entrada do bot
│
├── 📂 website/                     # Website de Licenças
│   ├── 📂 client/                  # Frontend React
│   ├── 📂 server/                  # Backend Express + tRPC
│   ├── 📂 drizzle/                 # Schema do banco
│   └── package.json
│
├── 📂 database/                    # Banco de dados do bot
│
├── 📄 start-integrated.js          # Inicia bot + website
├── 📄 package.json                 # Scripts de integração
├── 📄 .env.example                 # Template de variáveis
└── 📄 README_INTEGRADO.md          # Este arquivo
```

---

## 🔧 Comandos Disponíveis

### Desenvolvimento

```bash
# Inicia bot + website (produção)
npm start

# Inicia bot + website (desenvolvimento)
npm run dev

# Inicia só o bot
npm run start:bot-only

# Inicia só o website
npm run website
```

### Instalação

```bash
# Instala tudo de uma vez
npm run install-all
```

---

## 💡 Próximos Passos

### Curto Prazo (Esta Semana)
1. ✅ Configure `.env` com suas credenciais
2. ✅ Execute `npm run install-all`
3. ✅ Execute `npm start`
4. ✅ Teste em http://localhost:3000

### Médio Prazo (Este Mês)
1. Customize o bot (adicione seus comandos)
2. Personalize o website (sua marca)
3. Teste fluxo completo de pagamento
4. Deploy em VPS

### Longo Prazo
1. Configure domínio e HTTPS
2. Implemente recursos adicionais
3. Monitore e otimize
4. Escale conforme necessário

---

## 🆘 Troubleshooting

### Bot não conecta

```bash
# Verifique o token
grep TOKEN .env

# Verifique se bot está no servidor Discord
# Discord → Configurações → Integrações → Bots
```

### Website não abre

```bash
# Verifique se porta 3000 está livre
netstat -tlnp | grep 3000

# Verifique logs
npm start  # Veja a saída
```

### Banco de dados não conecta

```bash
# Teste conexão MySQL
mysql -u usuario -p -h localhost seu_banco

# Verifique DATABASE_URL
grep DATABASE_URL .env
```

---

## 📊 Arquitetura

```
Cliente (Browser)
    ↓
Website React (http://localhost:3000)
    ↓
tRPC API (/api/trpc)
    ↓
Backend Express
    ↓
├─ MySQL Database
├─ Stripe API
├─ Email Service
└─ S3 Storage
    ↓
Discord Bot (via webhooks)
```

---

## 🔐 Segurança

- ✅ Autenticação OAuth integrada
- ✅ Criptografia AES-256 para tokens
- ✅ Validação de licenças
- ✅ Logs de auditoria completos
- ✅ Rate limiting em endpoints críticos
- ✅ Proteção CSRF em formulários

---

## 📚 Documentação Adicional

- **website/README.md** - Documentação do website
- **website/DEPLOY.md** - Deploy em VPS
- **website/TESTING.md** - Guia de testes

---

## 🚀 Deploy em VPS

Quando estiver pronto para produção:

1. **Prepare uma VPS** (Ubuntu 20.04+, Node.js 18+)
2. **Copie o projeto** para a VPS
3. **Configure .env** com credenciais reais
4. **Execute** `npm run install-all`
5. **Inicie com PM2** para auto-restart

```bash
# Instale PM2
npm install -g pm2

# Inicie com PM2
pm2 start start-integrated.js --name "bot-license-manager"

# Salve configuração
pm2 save
pm2 startup
```

---

## 📞 Suporte

Se tiver problemas:

1. Verifique os logs: `npm start` (veja a saída)
2. Verifique `.env` está correto
3. Verifique se MySQL está rodando
4. Verifique se Discord token é válido

---

## 🎉 Pronto!

Seu sistema está pronto para começar! 

**Próximo passo:** Execute `npm start` e acesse http://localhost:3000

---

**Bot Discord Professional v3.0 + Website de Licenças**  
*Desenvolvido com ❤️ para sucesso do seu negócio*
