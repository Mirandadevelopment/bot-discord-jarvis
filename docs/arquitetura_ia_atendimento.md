# Arquitetura Proposta para IA de Atendimento Unificada no Discord

## 1. Introdução

Este documento detalha a arquitetura proposta para transformar o bot Discord existente em uma **Inteligência Artificial (IA) de atendimento unificada**, inspirada no conceito de um assistente como o Jarvis. O objetivo é consolidar múltiplos canais de atendimento em um único ponto de contato, onde a IA guiará o usuário através de um fluxo conversacional inteligente, aprenderá com as interações e evoluirá continuamente. A solução será implementada localmente, sem dependência de APIs externas para o processamento da IA, mas com capacidade de conexão à internet para atualização e evolução.

## 2. Visão Geral do Fluxo de Atendimento Unificado

O fluxo de atendimento será centralizado em um único canal, conforme ilustrado na Tabela 1.

**Tabela 1: Fluxo de Atendimento Unificado**

| Etapa | Descrição | Componentes Envolvidos | Detalhes da Interação |
|---|---|---|---|
| **1. Início do Atendimento** | Usuário clica em um botão "Iniciar Atendimento" em um painel persistente no canal dedicado. | `interactionCreate.js`, `panelUpdater.js` (adaptado), `database.js` (nova tabela `conversations`) | O bot posta um embed com um botão. Ao clicar, o bot cria uma sessão de atendimento para o usuário. |
| **2. Boas-Vindas e Opções** | A IA saúda o usuário e apresenta as principais categorias de atendimento via botões (ex: Compras, Whitelist, Suporte Geral). | `interactionCreate.js`, `conversationHandler.js` (novo), `database.js` | A IA envia uma mensagem de boas-vindas e um `ActionRow` com `ButtonBuilder` para as opções. |
| **3. Roteamento Inteligente** | Com base na escolha do usuário, a IA direciona o atendimento para o fluxo específico (ex: Whitelist, Tickets). | `interactionCreate.js`, `conversationHandler.js`, `ticketHandler.js`, `whitelistHandler.js` | A IA reconhece o `customId` do botão e invoca o handler apropriado, passando o contexto da conversa. |
| **4. Atendimento Contextual** | O fluxo específico (Whitelist, Ticket) é iniciado em um **novo canal temporário** ou continua no canal principal, com a IA fornecendo instruções e coletando informações. | `ticketHandler.js`, `whitelistHandler.js`, `conversationHandler.js`, `database.js` | A IA mantém o estado da conversa, fazendo perguntas sequenciais e processando as respostas do usuário. |
| **5. Conclusão e Feedback** | Após a resolução, a IA finaliza o atendimento, coleta feedback e encerra a sessão. | `conversationHandler.js`, `ticketHandler.js` (adaptado), `database.js` | A IA pode solicitar uma avaliação e, em seguida, fechar o canal temporário ou limpar o estado da conversa. |
| **6. Aprendizado Contínuo** | A IA registra o tipo de atendimento, a satisfação do usuário e a frequência das solicitações para otimizar futuras interações. | `learningModule.js` (novo), `database.js` (nova tabela `learning_data`) | Dados de cada atendimento são armazenados e analisados para identificar padrões e melhorar o roteamento e as respostas. |

## 3. Componentes Chave e Modificações

### 3.1. `src/events/interactionCreate.js` (Modificação)

Este arquivo será o **roteador central** para todas as interações. Será modificado para:

*   **Interceptar o botão "Iniciar Atendimento"**: Um novo `customId` será adicionado para este botão, que invocará um novo `conversationHandler.js`.
*   **Roteamento de Opções Iniciais**: Após o início do atendimento, os botões de categoria (Compras, Whitelist, etc.) também serão interceptados aqui e direcionarão para o `conversationHandler.js`, que então invocará os handlers específicos (`ticketHandler.js`, `whitelistHandler.js`).

### 3.2. `src/handlers/conversationHandler.js` (Novo)

Este será o **coração da IA de atendimento**. Suas responsabilidades incluirão:

*   **Gerenciamento de Sessão**: Criar, manter e encerrar sessões de conversação para cada usuário, armazenando o estado atual da conversa (qual etapa do atendimento, qual categoria foi escolhida, etc.).
*   **Boas-Vindas Dinâmicas**: Gerar a mensagem de boas-vindas e os botões de opções iniciais.
*   **Roteamento Lógico**: Com base na escolha do usuário, decidir qual handler específico (ticket, whitelist) deve ser ativado e passar o controle.
*   **Contexto Conversacional**: Manter um histórico simplificado da conversa para permitir que a IA "lembre" o que foi discutido.
*   **Integração com Aprendizado**: Registrar dados relevantes para o módulo de aprendizado.

### 3.3. `src/handlers/ticketHandler.js` (Modificação)

Será adaptado para:

*   **Receber Contexto**: Aceitar um contexto de conversa do `conversationHandler.js` ao invés de iniciar um ticket do zero.
*   **Operar em Canal Unificado ou Temporário**: A decisão de criar um novo canal para o ticket ou continuar no canal principal será gerenciada pelo `conversationHandler.js`.
*   **Feedback Integrado**: O processo de feedback e rating será integrado ao fluxo de encerramento do `conversationHandler.js`.

### 3.4. `src/handlers/whitelistHandler.js` (Modificação)

Similar ao `ticketHandler.js`, será adaptado para:

*   **Receber Contexto**: Iniciar o fluxo de whitelist com base no contexto fornecido pelo `conversationHandler.js`.
*   **Operar em Canal Unificado ou Temporário**: A criação de canais temporários para whitelist será gerenciada pelo `conversationHandler.js`.

### 3.5. `src/utils/database.js` (Modificação e Novas Tabelas)

Será estendido para suportar a persistência da IA:

*   **`conversations` (Nova Tabela)**:
    *   `id`: ID único da sessão de conversa.
    *   `guild_id`: ID do servidor Discord.
    *   `user_id`: ID do usuário que iniciou a conversa.
    *   `current_state`: JSON ou TEXT para armazenar o estado atual da conversa (ex: `{"step": "waiting_for_category", "chosen_category": ""}`).
    *   `history`: JSON ou TEXT para armazenar um histórico resumido das interações (perguntas da IA, respostas do usuário).
    *   `start_time`, `last_activity_time`, `end_time`.
    *   `status`: (active, closed, abandoned).
    *   `associated_channel_id`: Se um canal temporário for criado para o atendimento.

*   **`learning_data` (Nova Tabela)**:
    *   `id`: ID único.
    *   `guild_id`.
    *   `conversation_id`: Referência à tabela `conversations`.
    *   `category_chosen`: Categoria de atendimento selecionada (ex: "Compras", "Whitelist").
    *   `satisfaction_rating`: Avaliação do usuário (se aplicável).
    *   `keywords_extracted`: Palavras-chave relevantes da conversa (para aprendizado futuro).
    *   `resolution_status`: (resolved, unresolved).
    *   `timestamp`.

### 3.6. `src/utils/panelUpdater.js` (Modificação)

Será modificado para criar e manter um **painel unificado de atendimento** no canal principal, substituindo os painéis separados de ticket e whitelist. Este painel conterá o botão "Iniciar Atendimento".

### 3.7. `src/learningModule.js` (Novo)

Este módulo será responsável pela lógica de aprendizado local:

*   **Análise de Dados**: Processar os dados da tabela `learning_data` para identificar tendências (categorias mais solicitadas, problemas comuns).
*   **Otimização de Roteamento**: Ajustar dinamicamente a ordem ou proeminência dos botões de opções iniciais com base na frequência de uso.
*   **Sugestões de Respostas**: (Futuro) Com base em padrões de conversas resolvidas, sugerir respostas ou fluxos para a IA.
*   **Conexão para Evolução**: Implementar um mecanismo para buscar (via internet) atualizações de conhecimento ou modelos de linguagem *semente* que possam ser processados localmente, sem enviar dados sensíveis ou depender de APIs de LLM externas para a operação principal.

## 4. Implementação do Aprendizado Local (Jarvis-like)

Para a funcionalidade "Jarvis" e aprendizado local sem API, a abordagem será baseada em **sistemas de regras dinâmicos e análise de dados internos**:

1.  **Memória Persistente**: A tabela `conversations` manterá o estado de cada interação, permitindo que a IA "lembre" o contexto. A tabela `learning_data` armazenará metadados sobre cada atendimento concluído.
2.  **Ranking de Atendimentos**: O `learningModule.js` analisará a `learning_data` para calcular a frequência de cada `category_chosen`. As categorias mais frequentes podem ser apresentadas com maior destaque nos botões iniciais.
3.  **Evolução Baseada em Regras**: O `conversationHandler.js` pode ter um conjunto de regras que são dinamicamente atualizadas pelo `learningModule.js`. Por exemplo, se uma palavra-chave específica (`keywords_extracted`) frequentemente leva a uma categoria, a IA pode aprender a sugerir essa categoria mais rapidamente.
4.  **Conexão à Internet para Conhecimento (Não para Processamento)**: O `learningModule.js` pode ser configurado para, periodicamente, buscar informações públicas (ex: FAQs de um site, documentação de um produto) para enriquecer sua base de conhecimento local. Isso seria feito através de `webpage_extract` ou `browser` para coletar texto, que seria então processado e armazenado localmente (ex: em uma nova tabela `knowledge_base`) para uso posterior pela IA em suas respostas ou roteamento. **Nenhum LLM externo será usado para processar as interações do usuário.**

## 5. Próximos Passos

A próxima fase envolverá a implementação do `conversationHandler.js`, a criação das novas tabelas no `database.js` e a modificação do `interactionCreate.js` para iniciar o fluxo unificado.
