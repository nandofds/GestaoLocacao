# Prompt de construção — Sistema de gestão de locação de equipamentos para eventos

> Este documento é a especificação completa do sistema. Use-o como prompt para uma ferramenta de codificação por IA (Claude Code, Cursor, Lovable, v0) ou como briefing para um time de desenvolvimento. As decisões de modelagem marcadas como **regra rígida** não devem ser alteradas — elas foram tomadas para manter o sistema simples e correto.

---

## 1. Contexto e objetivo

Uma empresa aluga equipamentos de som e estrutura para eventos (casamentos, aniversários, shows, eventos corporativos). Ela precisa de um sistema que centralize a operação:

**Cliente → orçamento → evento → reserva de equipamentos → separação → saída → montagem → devolução → conferência → manutenção → encerramento.**

O sistema deve responder rapidamente:

- Qual equipamento está disponível em um intervalo de datas?
- Em qual evento um equipamento está?
- Quem retirou e quem devolveu?
- Em que estado o equipamento retornou?
- Existe algum item danificado ou em manutenção?
- Há conflito entre eventos nas mesmas datas (ou tempo insuficiente entre eles)?

---

## 2. Princípios inegociáveis (leia antes de modelar qualquer coisa)

Estas são as decisões de arquitetura que definem o sistema. Violá-las reintroduz complexidade que foi deliberadamente cortada.

### 2.1. Duas naturezas de coisa — e só duas

**Regra rígida: existem apenas `Item` e `Insumo`. Não existe "kit". Não existe "item por quantidade que volta".**

| Natureza | Exemplos | Como se comporta |
|---|---|---|
| **Item** | caixa de som, mesa, cabo, amplificador, tripé | Tem código próprio (serializado). **Sai e volta.** É conferido na saída e no retorno. Tem estado, entra em manutenção se quebrar, e **ocupa a agenda por intervalo de datas**. |
| **Insumo** | fita, pilha, parafuso, abraçadeira | Controlado por **saldo**. **Sai e não volta** (é consumido). A saída é uma baixa de estoque, vira custo do evento. Tem alerta de estoque mínimo. **Não entra em conflito de agenda nem em conferência de retorno.** |

Consequências obrigatórias dessa divisão:

- **Cabo é `Item`**, não insumo — ele volta e é rastreado unidade por unidade, exatamente como uma caixa de som. Cada cabo tem QR próprio. (Isso foi decidido conscientemente: o benefício é histórico por unidade — "este cabo já deu problema 3 vezes".)
- Insumo **não tem disponibilidade por data** — tem saldo atual. A pergunta para insumo é "tem 30 em estoque agora?", nunca "está livre entre 20 e 21/08?".
- A regra de conferência "quantidade que voltou ≠ quantidade que saiu → alerta" **só se aplica a Item**. Rodar essa regra em insumo gera falso alarme em todo evento.
- Insumo precisa de **ponto de ressuprimento** (estoque mínimo); Item não, porque Item volta.

### 2.2. Status é derivado, nunca editado à mão

**Regra rígida: o status atual de um Item é calculado a partir dos fatos, não é um campo que se edita.**

O status é uma função do estado real:

- Existe movimentação de saída em aberto para este item? → `EM USO`
- Existe manutenção aberta para este item? → `EM MANUTENÇÃO`
- Nenhum dos dois? → `DISPONÍVEL`

Guarde os **fatos** (saiu, voltou, quebrou) e derive o status na hora de exibir. Assim ele nunca mente. Uma tabela de histórico de status pode existir como **log de auditoria** (registro das mudanças), nunca como fonte da verdade do valor atual.

### 2.3. Todas as datas são timestamp completo

**Regra rígida: nunca use data de calendário (só o dia) para disponibilidade. Sempre timestamp com hora.**

Eventos viram a meia-noite (um evento termina 23h e o retorno é 02:10 do dia seguinte). Comparar apenas o dia produz conflitos falsos e reservas em cima. Toda comparação de disponibilidade é entre intervalos com hora.

### 2.4. Disponibilidade = pool menos reservas que se sobrepõem

Para Item serializado, disponibilidade é por unidade: cada unidade está livre ou está reservada num intervalo que se sobrepõe ao intervalo pedido.

O intervalo de indisponibilidade de um Item **não é a data do evento** — é do **carregamento/saída** até o **retorno + conferência**, com uma folga de logística configurável. Um item fica bloqueado enquanto está fora, não só no dia da festa.

### 2.5. Alerta de folga entre eventos

Mesmo quando dois eventos não se sobrepõem exatamente, o sistema deve **alertar** quando o intervalo entre o retorno previsto de um e a saída do outro for curto demais para desmontagem + transporte + nova montagem.

> Exemplo: Evento A termina 18/08 23h, retorno previsto 19/08 02h. Evento B monta 19/08 08h. O sistema alerta "pouco tempo entre eventos", mesmo sem sobreposição.

### 2.6. QR, não código de barras

**Regra rígida: identificação física por QR Code, lido pela câmera do celular.**

Motivo: leitura de qualquer ângulo, correção de erro (lê mesmo sujo/parcialmente danificado — essencial em cabo), e ocupa menos espaço. Código de barras 1D exige alinhamento e superfície plana larga, que o cabo não tem.

- O conteúdo do QR é **apenas o código interno do item** (ou uma URL curta tipo `app.empresa/i/JBL001`). **Nunca** coloque texto legível dentro do QR.
- O texto legível ("Caixa JBL 001") vai **impresso ao lado** do QR na etiqueta, para o humano ler quando o app estiver offline.
- Prever etiqueta física durável (cabo apanha, umidade descola QR de papel comum).

### 2.7. Plano vs. fato (reserva vs. movimentação)

**Regra rígida: separe o que foi *reservado* (o plano) do que *fisicamente saiu* (o fato).**

- `evento_equipamento` = a reserva, o plano ("reservei 10 caixas para este evento").
- `movimentacao` = o fato físico ("saíram 8 caixas, bipadas na porta do galpão").

A reconciliação entre os dois é uma verificação valiosa: "reservei 10, saíram 8 — cadê as 2?". Não deixe essa distinção implícita.

### 2.8. PWA operacional é offline-first

O app operacional (usado no galpão e no salão do evento) precisa **funcionar sem internet**. Galpão e salão de festa costumam ter sinal ruim, e é exatamente na conferência que não pode travar. As leituras de QR (saída/retorno) são registradas localmente no aparelho e sincronizadas quando houver conexão. Essa decisão é cara de mudar depois — assuma desde o início.

---

### 2.9. Arquitetura multi-cliente (multi-tenant)

**Regra rígida: o sistema será multi-cliente desde o primeiro dia.** Cada empresa de locação é um `tenant` independente e seus dados nunca podem ser visualizados, consultados, alterados ou sincronizados por usuários de outra empresa.

- Criar a entidade `organization` (empresa/tenant) e vincular usuários às empresas por `organization_members`, permitindo que um usuário pertença a uma ou mais empresas com perfis distintos.
- Toda tabela com dados de negócio deve possuir `organization_id` obrigatório, incluindo clientes, eventos, itens, insumos, movimentações, colaboradores, manutenções, configurações e auditoria.
- Chaves únicas de negócio devem ser compostas pela empresa. Exemplo: `UNIQUE (organization_id, codigo_interno)` para Item; o mesmo código pode existir em empresas diferentes.
- Toda consulta, gravação, relatório, arquivo e operação de sincronização offline deve ser limitada à empresa ativa. O `organization_id` recebido do cliente nunca é confiável: ele deve ser obtido e validado a partir da sessão autenticada.
- No PostgreSQL/Supabase, aplicar Row Level Security (RLS) como defesa obrigatória, além das verificações da aplicação. Storage, realtime e funções de banco também devem respeitar o tenant.
- Usuários comuns só acessam tenants aos quais estão associados. Um administrador da plataforma pode administrar tenants, mas esse papel é separado do Administrador de uma empresa e deve ser auditado.
- Configurações operacionais, como folga logística, estoque mínimo padrão, identidade visual e regras de alerta, pertencem ao tenant.
- A fila offline deve registrar o tenant da sessão, impedir troca de empresa enquanto houver operações pendentes e validar novamente o vínculo no servidor durante a sincronização.
- Testes automatizados de isolamento entre tenants são obrigatórios: tentar ler ou alterar registros de outro tenant deve falhar em todas as superfícies e APIs.

## 3. Stack recomendada (substituível)

Se o time já tem preferência, troque — a lógica de negócio das seções seguintes independe disto.

- **Frontend / full-stack:** Next.js (React) com TypeScript. Serve tanto o painel de gestão (desktop) quanto o PWA operacional (mobile).
- **Banco de dados:** PostgreSQL. Sugestão de Supabase para acelerar (dá auth, storage de fotos e realtime prontos).
- **PWA / offline:** `next-pwa` para o service worker; fila de operações offline em IndexedDB, sincronizada ao reconectar.
- **Leitura de QR:** biblioteca de scan por câmera (ex.: `html5-qrcode`).
- **Estilo:** Tailwind CSS. Interface flat, limpa, com hierarquia por prioridade (ver seção 8).

---

## 4. Modelo de dados

Campos-chave por tabela. Adapte tipos ao banco escolhido. `id` é sempre chave primária.

### Clientes
- `cliente`: nome/razão social, tipo (PF/PJ), cpf_cnpj, telefone, whatsapp, email, endereço, responsável, observações.
- `cliente_contato`: cliente_id, nome, telefone, papel (opcional, múltiplos contatos).

### Eventos e agenda
- `evento`: cliente_id, nome, tipo (casamento/aniversário/show/corporativo/outro), **dt_montagem, dt_inicio, dt_encerramento, dt_desmontagem** (todos timestamp completo), local, endereço, contato_local, veículo_id (opcional), valor, custos_adicionais, observações, status.
- `evento_equipamento`: **a reserva (plano)** — evento_id, item_id (para Item) OU insumo_id + quantidade (para Insumo), dt_saida_prevista, dt_retorno_previsto.
- `evento_colaborador`: evento_id, colaborador_id, função, horário, responsabilidade (a escala).
- `evento_documento`: evento_id, arquivo, tipo (contrato/foto/outro).

### Equipamentos e estoque
- `categoria`: nome (som, estrutura, cabeamento, fixação…).
- `item`: código_interno, qr, categoria_id, descrição, marca, modelo, número_série, local_guardado, dt_compra, valor_compra, estado_conservação, foto, última_manutenção, próxima_manutenção_preventiva, observações. **Sem campo de status editável — status é derivado (2.2).**
- `insumo`: nome, categoria_id, unidade, saldo_atual, estoque_minimo, custo_unitario.
- `item_status_log`: item_id, status, dt, origem (auditoria; não é a fonte da verdade do status atual).

### Movimentação (fato físico)
- `movimentacao`: evento_id, tipo (SAIDA/RETORNO), dt, colaborador_entregou_id, colaborador_recebeu_id, observações, assinatura/confirmação.
- `movimentacao_item`: movimentacao_id, item_id, estado_saida OU estado_retorno, foto.
- `movimentacao_insumo`: movimentacao_id, insumo_id, quantidade (só em SAIDA — baixa de estoque).
- `conferencia_retorno`: movimentacao_id, item_id, conferido_por_id, estado, destino (OK/MANUTENCAO), dt.

### Colaboradores
- `colaborador`: nome, cpf, telefone, função, tipo_contratação, disponibilidade, habilidades, valor_diária.
- `colaborador_funcao`: técnico de som, montador, motorista, auxiliar, eletricista, operador de iluminação, responsável de estoque, coordenador.

### Manutenção
- `manutencao`: item_id, evento_origem_id, colaborador_devolucao_id, descrição_defeito, urgência, dt_abertura, técnico_id, peças, valor_reparo, previsão_conclusão, resultado, status.
- `manutencao_arquivo`: manutencao_id, arquivo (foto/vídeo).

### Financeiro e orçamento (fase 2)
- `orcamento`, `orcamento_item`, `pagamento`, `despesa`.

### Acesso e auditoria
- `usuario`, `perfil`, `permissao`.
- `auditoria`: usuário_id, entidade, ação, dt, antes/depois (registro de toda alteração importante).

---

## 5. Máquina de estados do Item

Estados: `DISPONÍVEL → RESERVADO → EM SEPARAÇÃO → EM TRANSPORTE → EM USO → AGUARDANDO CONFERÊNCIA → DISPONÍVEL`. Desvio: `→ EM MANUTENÇÃO → (após teste e liberação) DISPONÍVEL`. Terminais: `EXTRAVIADO`, `BAIXADO`.

**Regra rígida:** item em `DANIFICADO`, `EM MANUTENÇÃO` ou `EXTRAVIADO` **não pode ser reservado** para outro evento — sai do pool de disponibilidade.

**Regra rígida:** item que voltou danificado só retorna a `DISPONÍVEL` **após teste e liberação** (não basta fechar a manutenção).

O gatilho da manutenção é a **conferência de retorno**: quando o colaborador marca "voltou com defeito", o sistema abre a ocorrência de manutenção automaticamente e tira o item do pool.

**Status da manutenção:** `AGUARDANDO ANÁLISE → EM ANÁLISE → AGUARDANDO PEÇA → EM CONSERTO → AGUARDANDO TESTE → CONCLUÍDA` (ou `SEM POSSIBILIDADE DE REPARO`).

---

## 6. Lógica de disponibilidade (o coração do sistema)

Ao reservar equipamento para um evento, verificar automaticamente:

**Para Item:** um item específico está disponível no intervalo `[dt_saida_prevista, dt_retorno_previsto + folga]` se **não existe** nenhuma outra reserva (`evento_equipamento`) daquele item cujo intervalo se sobreponha, e se o item não está em manutenção/danificado/extraviado. Retornar a lista de unidades livres da categoria pedida.

**Para Insumo:** verificar se `saldo_atual ≥ quantidade pedida`. Não há dimensão de data.

**Alerta de folga (6.1):** ao reservar, comparar o `dt_retorno_previsto` de reservas próximas com o `dt_saida_prevista` da nova. Se a diferença for menor que a folga configurada, exibir alerta (não bloquear).

---

## 7. Regras e validações essenciais

O sistema deve **impedir ou alertar** quando:

- O mesmo Item estiver reservado em eventos com intervalos conflitantes → **bloqueia**.
- A quantidade de Insumo pedida for maior que o saldo → **bloqueia**.
- Um Item pedido estiver em manutenção/danificado → **bloqueia** (fora do pool).
- Um evento estiver próximo e os itens ainda não separados → **alerta**.
- Um Item sair sem responsável definido → **bloqueia**.
- Um Item não retornar no prazo previsto → **alerta**.
- A quantidade de Item devolvida for diferente da que saiu → **alerta** (não vale para insumo).
- Um Item retornar danificado → abre manutenção **automaticamente**.
- Folga entre eventos for insuficiente → **alerta** (6.1).
- Um evento for finalizado com pendências → **alerta**.

Toda alteração importante gera registro em `auditoria`.

---

## 8. As duas superfícies

São dois apps com propósitos diferentes. **Não os funda numa tela só.**

### 8.1. Painel de gestão (desktop)

Organizado por prioridade — problema no topo, depois o dia, depois o estado do estoque.

1. **Régua "Precisa de atenção"** (topo, o mais importante): conflitos de agenda, itens não retornados, separações pendentes, itens aguardando conferência, insumo abaixo do mínimo. Vermelho = problema que já aconteceu; âmbar = problema que vai acontecer se ninguém agir. Cada card é um **atalho clicável** para a lista correspondente. Card zerado **some** da régua (não mostra "0").
2. **Indicadores do dia:** eventos hoje, montagens hoje, desmontagens hoje, itens fora.
3. **Duas colunas:** "Agenda de hoje" (eventos do dia com status colorido no mesmo padrão da régua) e "Estado do estoque" (disponível / em uso / aguardando conferência / em manutenção / insumo abaixo do mínimo). A soma dos estados de Item deve bater com o total de itens — se não bate, sumiu unidade.

O código de cores (vermelho/âmbar/verde) significa a mesma coisa em toda a tela — é isso que permite ler o painel num relance.

Menu de gestão: Dashboard, Agenda, Eventos, Clientes, Equipamentos, Estoque, Separação, Saída, Retorno e conferência, Manutenção, Colaboradores, Relatórios, Configurações. (Orçamentos, Financeiro, Veículos entram na fase 2.)

Na tela de um evento, abas: Resumo, Equipamentos, Colaboradores, Cronograma, Movimentações, Documentos, Fotos, Ocorrências.

### 8.2. PWA operacional (mobile, offline-first)

Enxuto, uma coluna, botões grandes, feito para uma mão só, com luva, no galpão ou no salão. Home com três ações: **bipar saída**, **bipar retorno**, **meus eventos**.

A **tela de conferência de retorno** precisa ser rápida: como cada cabo é bipado individualmente, um evento grande tem dezenas de leituras. Desenhar para velocidade — bipar em sequência, o que já voltou marcado em verde, só o que falta destacado. No retorno, um toque marca "voltou danificado", o que dispara a manutenção.

---

## 9. Perfis de acesso

- **Administrador:** acesso completo.
- **Comercial:** clientes, orçamentos, contratos, agenda.
- **Estoque:** separação, saída, retorno, conferência, inventário.
- **Técnico:** manutenções e ocorrências.
- **Coordenador:** eventos, colaboradores, montagem/desmontagem.
- **Financeiro:** pagamentos, despesas, relatórios financeiros.
- **Colaborador comum:** vê apenas os eventos em que foi escalado.

---

## 10. Escopo do MVP (construir primeiro)

Foco na operação principal, que já responde as 7 perguntas da seção 1:

1. Login e permissões.
2. Cadastro de clientes.
3. Cadastro de colaboradores.
4. Cadastro de equipamentos (Item e Insumo, com QR).
5. Agenda de eventos com os quatro marcos de data.
6. Reserva de equipamentos + verificação de disponibilidade (seção 6).
7. Separação dos itens.
8. Saída com responsável (bipagem QR).
9. Retorno e conferência (bipagem QR) com registro de dano.
10. Controle de manutenção.
11. Dashboard de gestão + PWA operacional.
12. Relatórios básicos.

**Fase 2:** orçamentos completos, contratos, financeiro avançado, veículos como recurso agendável, escala de colaborador com verificação de conflito, assinatura digital, portal do cliente, dashboard que muda por perfil.

---

## 11. O que NÃO construir (restrições que previnem scope creep)

- **Não** implemente kits em hipótese alguma.
- **Não** crie "item por quantidade que volta" — o que volta é Item serializado; o que não volta é Insumo.
- **Não** rode conferência de retorno em insumo.
- **Não** faça status de Item editável à mão.
- **Não** compare disponibilidade só por dia (sempre timestamp).
- **Não** modele veículo ou colaborador com verificação de conflito na v1 — ou faça completo (mesma lógica de conflito do Item) ou deixe para a fase 2. Modelar pela metade dá falsa sensação de controle.

---

## 12. Relatórios (fase posterior ao MVP, mas previstos no modelo)

Equipamentos mais/menos utilizados, mais danificados (ao nível da unidade, graças ao rastreio unitário), custo de manutenção, histórico completo por equipamento, itens fora da empresa, itens não devolvidos, eventos por período/cliente, faturamento e lucro por evento, colaboradores escalados por período, ocorrências por colaborador, taxa de utilização do estoque, próximas manutenções preventivas.
