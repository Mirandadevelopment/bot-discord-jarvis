# Bot License Manager - TODO

## Fase 1: Autenticação e Schema de Banco de Dados
- [x] Estender schema de usuários com campos específicos (discordId, role)
- [x] Criar tabelas de licenças (licenses, bot_instances, license_transfers)
- [x] Criar tabelas de transações e auditoria (transactions, audit_logs)
- [x] Criar tabelas de documentos e notificações (documents, notifications)
- [x] Executar migrações do Drizzle
- [x] Implementar helpers de banco de dados para cada tabela
- [ ] Criar testes unitários para queries de banco de dados

## Fase 2: Sistema de Pagamentos com Stripe
- [x] Integrar SDK do Stripe
- [x] Criar procedimento tRPC para iniciar checkout
- [x] Implementar webhook de confirmação de pagamento
- [x] Criar lógica de geração automática de licença após pagamento
- [x] Implementar renovação automática de assinaturas
- [ ] Criar testes para fluxo de pagamento

## Fase 3: Gerenciamento de Licenças
- [x] Criar procedimentos tRPC para listar/detalhar licenças
- [x] Implementar lógica de cálculo de dias restantes
- [x] Criar sistema de ativação/desativação de licenças
- [x] Implementar validação de licenças
- [x] Criar serviço de criptografia e validação de tokens
- [x] Implementar página de dashboard de licenças
- [x] Criar página de detalhes de licença
- [ ] Criar testes para gerenciamento de licenças

## Fase 4: Sistema de Instâncias de Bot
- [x] Criar procedimento para registrar configuração de instância
- [x] Implementar validação de token Discord
- [x] Criar sistema de execução de comandos CMD
- [x] Implementar lógica de criação de instância isolada
- [x] Implementar lógica de destruição de instância
- [x] Implementar migração de instâncias
- [x] Implementar health checks
- [ ] Criar testes para sistema de instâncias

## Fase 5: Transferência de Licenças
- [x] Criar procedimento para solicitar transferência
- [x] Implementar workflow de aprovação/rejeição
- [x] Criar notificações para admin
- [x] Implementar cancelamento de transferências
- [ ] Implementar atualização de cargo Discord após transferência
- [ ] Criar testes para transferência de licenças

## Fase 6: Dashboard Administrativo
- [x] Criar página de dashboard admin
- [x] Implementar listagem de todas as licenças
- [x] Criar painel de aprovação de transferências
- [x] Implementar visualização de logs de auditoria
- [ ] Criar gráficos de receita e estatísticas
- [ ] Implementar filtros e busca avançada

## Fase 7: Painel de Cliente
- [x] Criar página de dashboard do cliente
- [x] Implementar listagem de licenças do cliente
- [x] Criar formulário de configuração de instância
- [x] Implementar página de pricing
- [ ] Implementar painel de revenda
- [ ] Criar visualização de histórico de transações
- [ ] Implementar upload de documentos

## Fase 8: Sistema de Notificações
- [x] Integrar serviço de email
- [x] Criar templates de email
- [x] Implementar notificações de pagamento confirmado
- [x] Implementar notificações de transferência pendente
- [x] Implementar avisos de vencimento (7 dias antes)
- [x] Criar sistema de notificações in-app
- [x] Implementar bulk emails para avisos

## Fase 9: Upload e Armazenamento de Documentos
- [x] Implementar upload para S3
- [x] Criar sistema de gerenciamento de documentos
- [x] Implementar download seguro de documentos
- [x] Criar logs de auditoria para downloads
- [x] Criar serviço de document-service.ts com validação de tamanho

## Fase 10: Painel de Revenda
- [x] Criar página de ResalePanel.tsx
- [x] Implementar listagem de licenças disponíveis para revenda
- [x] Criar interface de requisição de transferência
- [x] Implementar abas para licenças, transferências pendentes e histórico
- [x] Adicionar estatísticas de portfolio e valor total

## Fase 11: Gráficos e Estatísticas
- [x] Criar página AdminStats.tsx
- [x] Implementar gráficos de distribuição de planos (PieChart)
- [x] Implementar gráficos de status de licenças (BarChart)
- [x] Adicionar KPIs (total, ativo, receita, transferências pendentes)
- [x] Criar resumo de estatísticas do sistema

## Fase 12: Testes e Segurança
- [ ] Realizar testes de segurança (SQL injection, XSS, CSRF)
- [ ] Implementar rate limiting
- [ ] Validar criptografia de dados sensíveis
- [ ] Testes de performance
- [ ] Testes de integração end-to-end
- [ ] Documentação de segurança
