# Arquitetura - Bot License Manager Pro

## Visão Geral

Plataforma web para comercialização e gerenciamento de licenças de bots Discord com sistema de pagamentos recorrentes, automação de instâncias e transferência de licenças.

## Fluxos de Negócio Principais

### 1. Fluxo de Compra de Licença
1. Prospect acessa painel de preços
2. Seleciona plano (mensal, trimestral, semestral, anual)
3. Realiza pagamento via Stripe
4. Webhook confirma pagamento
5. Sistema gera licença automaticamente
6. Cliente recebe email com detalhes da licença
7. Cliente recebe cargo no Discord para acesso a canais exclusivos

### 2. Fluxo de Configuração de Instância
1. Cliente com licença ativa acessa formulário de configuração
2. Insere: Token do bot, ID do servidor Discord, ID do dono
3. Sistema valida credenciais com Discord API
4. Sistema executa comando CMD para criar instância isolada
5. Instância é registrada no banco de dados
6. Cliente recebe confirmação e acesso ao painel de controle

### 3. Fluxo de Transferência de Licença
1. Cliente solicita transferência de licença
2. Insere email/ID do novo titular
3. Sistema cria solicitação pendente
4. Admin recebe notificação
5. Admin aprova/rejeita transferência
6. Se aprovado: licença é transferida, novo cliente recebe email e cargo Discord
7. Se rejeitado: cliente recebe notificação

### 4. Fluxo de Revenda
1. Cliente com licença ativa acessa painel de revenda
2. Seleciona opção de revender licença
3. Insere email/ID do novo titular e novo plano
4. Sistema cria solicitação de transferência
5. Admin aprova transferência
6. Nova licença é criada com novo plano
7. Antigo cliente perde acesso

## Estrutura de Banco de Dados

### Tabelas Principais

#### users
- id (PK)
- openId (OAuth)
- email
- name
- role (admin, client, prospect)
- discordId (opcional)
- createdAt
- updatedAt

#### licenses
- id (PK)
- userId (FK → users)
- licenseKey (único)
- planType (monthly, quarterly, semi-annual, annual)
- status (active, inactive, suspended, expired)
- purchaseDate
- expiryDate
- stripeSubscriptionId
- discordServerId (opcional)
- discordOwnerId (opcional)
- botToken (criptografado, opcional)
- createdAt
- updatedAt

#### bot_instances
- id (PK)
- licenseId (FK → licenses)
- botToken (criptografado)
- serverId
- ownerId
- instanceStatus (running, stopped, error)
- createdAt
- updatedAt

#### license_transfers
- id (PK)
- fromUserId (FK → users)
- toUserId (FK → users)
- licenseId (FK → licenses)
- status (pending, approved, rejected)
- requestedAt
- approvedAt
- approvedBy (FK → users)
- reason
- createdAt
- updatedAt

#### transactions
- id (PK)
- userId (FK → users)
- licenseId (FK → licenses)
- type (purchase, renewal, refund, transfer)
- amount
- currency
- stripeTransactionId
- status (pending, completed, failed)
- createdAt
- updatedAt

#### audit_logs
- id (PK)
- userId (FK → users)
- action (create_license, update_license, transfer_license, etc)
- entityType (license, instance, transfer)
- entityId
- changes (JSON)
- ipAddress
- userAgent
- createdAt

#### documents
- id (PK)
- licenseId (FK → licenses)
- type (payment_proof, transfer_agreement, instance_log)
- fileName
- s3Key
- uploadedBy (FK → users)
- createdAt

#### notifications
- id (PK)
- userId (FK → users)
- type (payment_confirmed, transfer_pending, expiry_warning)
- title
- content
- read
- createdAt

## Fluxo de Segurança

### Autenticação
- OAuth Manus para login
- JWT para sessão
- HTTPS obrigatório

### Autorização
- Role-based access control (RBAC)
- Admin: acesso total
- Client: acesso apenas às próprias licenças
- Prospect: acesso apenas a painel de preços

### Criptografia
- Tokens de bot criptografados em repouso
- Senhas de API criptografadas
- HTTPS para todas as comunicações

### Auditoria
- Todos os eventos registrados em audit_logs
- IP e User-Agent capturados
- Histórico de alterações preservado

## Integrações Externas

### Stripe
- Webhook para confirmação de pagamento
- Gerenciamento de assinaturas
- Processamento de reembolsos

### Discord API
- Validação de token de bot
- Adição de cargos a usuários
- Criação de canais exclusivos

### Email
- Confirmação de pagamento
- Notificações de transferência
- Avisos de vencimento

## Endpoints Principais

### Autenticação
- POST /api/trpc/auth.login
- POST /api/trpc/auth.logout
- GET /api/trpc/auth.me

### Licenças (Cliente)
- GET /api/trpc/licenses.list
- GET /api/trpc/licenses.detail
- POST /api/trpc/licenses.configure
- POST /api/trpc/licenses.requestTransfer

### Licenças (Admin)
- GET /api/trpc/admin.licenses.list
- GET /api/trpc/admin.licenses.detail
- POST /api/trpc/admin.transfers.approve
- POST /api/trpc/admin.transfers.reject
- GET /api/trpc/admin.auditLogs.list

### Pagamentos
- POST /api/trpc/payments.createCheckout
- POST /api/webhooks/stripe (webhook)

### Instâncias
- POST /api/trpc/instances.create
- POST /api/trpc/instances.delete
- GET /api/trpc/instances.list

## Stack Tecnológico

- Frontend: React 19 + Tailwind 4 + Shadcn/UI
- Backend: Express 4 + tRPC 11
- Banco de Dados: MySQL
- Autenticação: OAuth Manus + JWT
- Pagamentos: Stripe
- Storage: S3 (para documentos)
- Email: SendGrid ou similar
- Criptografia: crypto (Node.js nativo)

## Considerações de Deployment

- Variáveis de ambiente para Stripe, Discord, Email
- Rate limiting para webhooks
- Backup automático do banco de dados
- Monitoramento de saúde da aplicação
- Logs centralizados
