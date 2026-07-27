# Guia de Instalação e Uso: IA de Atendimento Jarvis

Parabéns! Seu bot Discord foi transformado em uma **IA de Atendimento Unificada (estilo Jarvis)**. Agora, em vez de múltiplos canais e painéis confusos, seus membros terão uma experiência fluida e inteligente.

## 🌟 O que mudou?

1.  **Canal Único de Atendimento**: Um único ponto de entrada para Whitelist, Compras e Suporte.
2.  **IA Conversacional Local**: O bot agora saúda o membro, pergunta o que ele deseja e o direciona inteligentemente.
3.  **Aprendizado Contínuo**: A IA aprende com cada atendimento, identificando as categorias mais pedidas e sugerindo-as como recomendações.
4.  **Evolução Estilo Jarvis**: O bot simula um processo de evolução diária, analisando dados locais para melhorar o atendimento.
5.  **Privacidade Total**: Todo o aprendizado é feito localmente na sua rede, sem necessidade de APIs externas pagas ou envio de dados para fora.

## 🚀 Como Configurar

Para ativar o novo sistema de IA, siga os passos abaixo:

1.  **Instale as Dependências**:
    Certifique-se de que todas as dependências estão instaladas:
    ```bash
    npm install
    ```

2.  **Inicie o Bot**:
    ```bash
    npm start
    ```

3.  **Configure o Painel da IA**:
    No seu servidor Discord, use o novo comando administrativo:
    ```
    /ai-setup canal:#atendimento banner:URL_DA_IMAGEM
    ```
    *Isso enviará o painel unificado para o canal escolhido e criará automaticamente a categoria de "Compras" se ela não existir.*

## 🗣️ Funções de Voz e Identidade (Jarvis v2)

O bot agora é capaz de interagir como uma IA avançada:

1.  **Reconhecimento de Identidade**:
    *   O Jarvis monitora mudanças de nome. Se você mudar seu apelido no servidor, ele notará e elogiará a mudança no próximo atendimento.
    *   Ele lembra exatamente do que vocês falaram na última vez, criando uma conexão real.

2.  **Interação por Áudio (TTS)**:
    *   Se você estiver em um canal de voz ao iniciar um atendimento, o Jarvis entrará no canal e falará as instruções para você.
    *   Ele usa uma voz polida e profissional para guiar o atendimento.
    *   **Controle de Silêncio**: Se preferir apenas ler, você pode clicar no botão **"Silenciar Jarvis"** no painel inicial. O bot lembrará da sua escolha e não falará com você até que você ative o som novamente.

3.  **Configuração de Voz**:
    *   Para que o Jarvis fale, ele precisa de permissão para "Conectar" e "Falar" nos canais de voz.

## 🧠 O "Cérebro" da IA (Gerenciamento via HeidiSQL)

A memória da IA agora é persistente e pode ser gerenciada externamente.

1.  **Acesse o Banco de Dados**:
    *   O arquivo `database/cerebro_ia_jarvis.sql` contém a estrutura do "Cérebro".
    *   Você pode importar este arquivo no seu **HeidiSQL** para visualizar as tabelas.

2.  **Tabelas Principais**:
    *   `ai_knowledge_base`: Aqui você pode adicionar respostas customizadas. Se você adicionar um termo como "vip" e uma resposta, a IA usará isso quando o termo for detectado.
    *   `ai_recent_memories`: Armazena o que cada usuário fez recentemente para que o Jarvis possa ser mais pessoal.
    *   `ai_pending_learning`: Termos novos que a IA detectou mas ainda não sabe como responder. Você pode revisar aqui e mover para a `knowledge_base`.

## 🧠 Como a IA Aprende?

*   **Interação**: Sempre que alguém clica em "Iniciar Atendimento", a IA registra a intenção e consulta a `ai_recent_memories`.
*   **Base de Conhecimento**: A IA consulta a `ai_knowledge_base` para personalizar as mensagens de boas-vindas e instruções.
*   **Finalização**: Quando um ticket ou whitelist é fechado, o `learningModule` analisa a conversa, extrai palavras-chave e as salva para aprendizado futuro.
*   **Recomendações**: Com o tempo, o painel de boas-vindas da IA mostrará automaticamente as "Categorias Mais Pedidas" para agilizar o atendimento de novos membros.

## 🌐 Painel Web Integrado

O bot possui um painel web completo para gerenciamento:

1.  **Pré-requisito (MySQL/HeidiSQL)**:
    *   Abra seu HeidiSQL e crie um banco de dados chamado `Atendimento`.
    *   Certifique-se de que o usuário (ex: `miranda`) tenha permissões totais sobre esse banco.
    *   Você pode usar o arquivo `PREPARAR_BANCO_HEIDISQL.sql` para fazer isso automaticamente.

2.  **Como Iniciar**:
    *   Navegue até a pasta `website`: `cd website`
    *   Instale as dependências: `npm install`
    *   Inicie em modo desenvolvimento: `npm run dev`

2.  **Funcionalidades**:
    *   **Dashboard**: Visualize suas licenças e bots ativos.
    *   **Configurações**: Gerencie tokens e acessos.
    *   **Integração**: O site está pronto para ser conectado ao banco de dados MySQL que você usa no HeidiSQL.

## 🛠️ Comandos Importantes

*   `/ai-setup`: Configura o ponto de entrada único da IA.
*   `/ticket-category`: Continue usando para gerenciar suas categorias (Compras, Suporte, etc.).
*   `/whitelist setup`: Continue usando para configurar as regras de whitelist.

---
*Desenvolvido com foco em evolução contínua e aprendizado local. Seu Jarvis está pronto!*
