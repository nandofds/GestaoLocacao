# Memória do projeto — BackRoadie

Atualizado em: 4 de agosto de 2026.

## Objetivo

Construir um sistema de gestão de locação de equipamentos de som e estrutura para eventos. O fluxo principal é:

Cliente → evento → reserva → separação → saída → montagem/uso → retorno → conferência → manutenção → encerramento.

O sistema deve responder disponibilidade por intervalo, localização de cada equipamento, responsáveis por saída e retorno, condição devolvida, manutenções e conflitos entre eventos.

## Regras rígidas do domínio

1. Existem apenas `Item` e `Insumo`.
   - Item é serializado, tem QR próprio, sai e volta, ocupa agenda e passa por conferência.
   - Cabo é Item e cada unidade é rastreada.
   - Insumo possui saldo e estoque mínimo, é consumido e não volta.
   - Não existe kit nem “item por quantidade que volta”.
2. Status de Item é derivado dos fatos.
   - Saída sem retorno → `EM_USO`.
   - Manutenção sem teste/liberação → `EM_MANUTENCAO`.
   - Caso contrário → `DISPONIVEL`, exceto estados terminais.
3. Disponibilidade sempre usa `timestamptz`, nunca somente data.
4. O bloqueio vai da saída prevista até o retorno previsto mais folga logística.
5. Sobreposição bloqueia; folga curta entre eventos apenas alerta.
6. QR contém somente código interno ou URL curta. Texto legível fica fora do QR.
7. Reserva é plano; movimentação é fato físico. Os dois não podem ser fundidos.
8. A PWA operacional é offline-first.
9. Item danificado, em manutenção, extraviado ou baixado fica fora do pool.
10. Retorno danificado abre manutenção; só volta ao pool após teste e liberação.

## Superfícies

### Painel de gestão

Desktop, orientado por prioridade:

- régua “Precisa de atenção” no topo;
- indicadores do dia;
- agenda de hoje;
- estado reconciliado do estoque;
- próximas operações;
- menus para agenda, eventos, clientes, equipamentos, estoque, separação, saída, retorno, manutenção, colaboradores, relatórios e configurações.

### PWA operacional

Mobile, uma coluna e alvos de toque grandes:

- Bipar saída;
- Bipar retorno;
- Meus eventos;
- conferência sequencial por QR;
- marcação rápida de dano;
- armazenamento local quando offline.

## Stack atual

- React 19 + TypeScript.
- Vite.
- CSS próprio responsivo.
- Lucide React.
- Supabase JS preparado, ainda sem credenciais reais.
- PostgreSQL/Supabase por migrations.
- `vite-plugin-pwa` e Workbox.
- Playwright para testes visuais e de interação.
- Deploy futuro na Vercel.

## Skills e plugins usados pelo Codex

### Skills efetivamente usadas na construção

1. `build-web-apps:frontend-app-builder`
   - Criou o fluxo de conceito visual, sistema de design, implementação React responsiva e validação visual.
   - Origem: plugin **Build Web Apps**.
2. `build-web-apps:react-best-practices`
   - Orientou estrutura, renderização e desempenho dos componentes React.
   - Origem: plugin **Build Web Apps**.
3. `data-analytics:index`
   - Fez o roteamento do trabalho analítico para a skill de dashboard.
   - Origem: plugin **Data Analytics**.
4. `data-analytics:build-dashboard`
   - Orientou hierarquia dos indicadores, fontes, reconciliação e organização do dashboard.
   - Origem: plugin **Data Analytics**.
5. `imagegen`
   - Gerou os conceitos visuais aprovados para desktop e PWA mobile.
   - É uma skill de sistema do Codex, normalmente já disponível.

### Plugins necessários para reproduzir o fluxo

- **Build Web Apps** (`build-web-apps@openai-curated-remote`) — necessário.
- **Data Analytics** (`data-analytics@openai-curated-remote`) — necessário para o fluxo de dashboard.

### Plugins instalados, mas não usados nesta primeira implementação

- **Product Design** (`product-design@openai-curated-remote`).
- **Sentry** (`sentry@openai-curated-remote`).

Eles podem ser úteis nas próximas fases, mas não são necessários para abrir, compilar ou continuar o código atual.

### Plugins ainda recomendados para as próximas fases

- **Supabase** (`supabase@openai-curated-remote`) — banco, Auth, Storage e RLS.
- **Vercel** (`vercel@openai-curated-remote`) — deploy e variáveis de ambiente.
- **GitHub** (`github@openai-curated-remote`) — operações remotas e integração do repositório.
- **PostHog** (`posthog@openai-curated-remote`) — opcional, para métricas de uso.

### Ferramentas locais usadas, que não são skills

- Node.js LTS e npm.
- Playwright com Chromium para QA visual, porque o Browser/IAB não estava disponível.
- Git.

As dependências JavaScript exatas estão fixadas em `package-lock.json`; no outro computador basta instalar Node.js LTS e executar `npm install`.

## Estado implementado

- Dashboard desktop navegável e responsivo.
- Dashboard conectado a dados reais, com atenção, indicadores, estoque reconciliado e próximas operações navegáveis.
- Relatórios por período com eventos, valores, custos adicionais, custos de manutenção e resultado estimado.
- Configurações da empresa ativa com edição do nome protegida pelo papel de proprietário.
- PWA mobile com home operacional.
- Fluxo demonstrativo de conferência de retorno.
- Inclusão simulada de leitura de QR.
- Marcação de dano e mensagem de manutenção.
- Tela “Meus eventos”.
- Fila offline migrada para IndexedDB, vinculada a usuário e empresa, com consolidação de leituras, tentativas de sincronização e bloqueio de troca de tenant enquanto houver pendências.
- Service worker, manifesto e ícone PWA.
- Cliente Supabase condicional por `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Projeto Supabase remoto conectado e migrations sincronizadas.
- Autenticação por e-mail/senha com criação automática de empresa e vínculo `owner`.
- Administração global da plataforma, troca de empresa ativa e cabeçalho com usuário/empresa reais.
- RLS multi-tenant validada: usuários comuns isolados e superusuário com visão global.
- Cadastro real de Clientes com listagem, busca, criação, edição e identificação da empresa.
- Cadastro real de Categorias e Itens serializados com código/QR próprios, edição e identificação da empresa.
- Categorias e campos de equipamentos normalizados em maiúsculas, com bloqueio de duplicidade por empresa.
- Cadastro real de Insumos com categoria, unidade, saldo atual, estoque mínimo, custo unitário e alerta de reposição.
- Nomes de Insumos normalizados em maiúsculas, com bloqueio de duplicidade por empresa.
- Cadastro real de Colaboradores com função, contratação, disponibilidade informativa, habilidades, diária e status ativo.
- Máscaras de CPF, telefone e CNPJ alfanumérico aplicadas nos cadastros, com armazenamento sem pontuação.
- Cadastro real de Eventos com cliente, período operacional, local, valores, status e edição.
- Reserva de equipamentos por evento com saída, retorno, folga logística, indicação de conflitos e bloqueio de sobreposição no PostgreSQL.
- Cancelamento e conclusão liberam a disponibilidade sem apagar o histórico da reserva.
- Montagem sugere o início do evento 12 horas depois, permitindo ajuste manual para intervalos menores.
- Geração e impressão de etiquetas QR por equipamento, individual ou em lote.
- Impressão configurável em folha A4 ou impressora térmica, com padrões 50×30, 60×35, 60×40 e 90×30 mm, além de tamanho personalizado.
- Separação persistente por evento, com conferência por QR/código, progresso, bloqueio de item fora da reserva, prevenção de duplicidade e opção de desfazer.
- Separação disponível somente para eventos confirmados ou em andamento, com proteção também no banco.
- Saída do galpão persistente e transacional, vinculada ao colaborador que liberou os equipamentos e com transporte opcional.
- Retorno persistente por QR/código, condição por item, conferência completa e colaborador responsável pela entrada no galpão.
- Retorno danificado abre manutenção automaticamente; extraviados permanecem fora do estoque disponível.
- Manutenção com responsável técnico, urgência, etapas, custos, diagnóstico, teste, liberação ou baixa sem reparo.
- Auditoria automática das alterações de manutenção, com status anterior/novo, custo, observação, usuário e horário.
- Roteiro cumulativo de validação manual mantido em `docs/TESTES.md`.
- Agenda real com visões diária, semanal e mensal, filtros por status, navegação por período e detalhes dos eventos.
- Migration inicial com clientes, categorias, itens, insumos, eventos, reservas, movimentações e manutenção.
- Restrição PostgreSQL contra sobreposição de reserva do mesmo Item.
- Função de status derivado do Item.
- RLS habilitada com políticas iniciais somente de leitura para autenticados.
- Build de produção aprovado.
- Testes Playwright aprovados em desktop `1440x1024` e mobile `390x844` sem erros de console.

Os números apresentados na interface ainda são demonstrativos e estão em `src/data.ts`.

## Conceitos aprovados

- `design/dashboard-concept.png` — painel desktop.
- `design/pwa-concept.png` — home, retorno e eventos mobile.

O visual usa navy profundo, branco/cinza frio, verde para normalidade, âmbar para risco, vermelho para problema e cyan como destaque. A implementação deve preservar listas, tabelas e trilhos, evitando transformar tudo em grades de cards.

## Próxima sequência de trabalho

1. Conectar a PWA operacional aos eventos reais e substituir os dados demonstrativos restantes.
2. Integrar câmera e leitura real de QR.
3. Configurar variáveis e publicar na Vercel.
4. **Último passo antes da produção:** configurar SMTP próprio no Supabase, desativar o `mailer_autoconfirm` usado durante o desenvolvimento, reativar a confirmação de e-mail e validar cadastro, confirmação e recuperação de senha. O provedor padrão do Supabase não deve ser usado em produção por causa do limite reduzido de envios.

## Fora do MVP inicial

- Orçamentos e contratos completos.
- Financeiro avançado.
- Veículos como recurso agendável.
- Conflito de escala de colaboradores.
- Assinatura digital.
- Portal do cliente.
- Dashboard variável por perfil.

## Comandos

```powershell
npm install
npm run dev
npm run build
node tests/visual-check.mjs
```

O teste visual espera o preview em `http://127.0.0.1:4173`.

## Estado de integrações

- Supabase: projeto remoto conectado, migrations aplicadas e autenticação multi-tenant em teste.
- Auth/SMTP: `mailer_autoconfirm` está temporariamente ativo no ambiente remoto para permitir testes. SMTP próprio e confirmação de e-mail são pendências obrigatórias do último passo antes da produção.
- Vercel: ainda não configurada nem publicada.
- GitHub: repositório já possui remoto e a branch observada é `main`.
- Dados reais: ainda não disponíveis.

## Estado consolidado — 5 de agosto de 2026

Esta seção substitui as observações antigas que ainda mencionam dados fictícios, câmera pendente ou Vercel não configurada.

### Dashboard e gestão

- Dashboard conectado ao Supabase e exibindo somente eventos confirmados/em andamento nas operações previstas.
- Eventos cadastrados para o dia são carregados a partir dos dados reais.
- Menus de Relatórios e Configurações implementados.
- Eventos exibem separadamente montagem, início do evento, encerramento e desmontagem.
- Eventos planejados não podem receber equipamentos até serem confirmados; a regra também é protegida no banco.
- Tela de equipamentos possui seleção/desmarcação em lote para impressão e paginação de 25, 50 ou 100 registros.

### PWA operacional

- Home sem dados fictícios e com a mensagem “vamos fazer um ótimo evento”.
- Bloco “Eventos operacionais” removido.
- Usuário seleciona um evento real antes de iniciar a operação.
- Se o evento ainda não saiu, a ação disponível é registrar a saída.
- Se a saída já ocorreu, a ação disponível é registrar o retorno.
- Fluxo de coleta na desmontagem implementado antes da conferência de entrada no galpão.
- Conferência por câmera/QR integrada à saída, coleta e retorno, com alternativa de digitação manual.
- Layout mobile da listagem de equipamentos ajustado para não ficar comprimido ao lado do formulário.
- Fila offline usa IndexedDB e mantém vínculo com usuário e empresa.

### Fluxo físico aprovado

1. Separação no galpão.
2. Confirmação da saída do galpão.
3. Coleta/conferência durante a desmontagem e carregamento do caminhão.
4. Conferência final durante a descarga e entrada no galpão.
5. Divergências, danos e extravios são registrados; danos podem abrir manutenção.

As conferências da desmontagem e da entrada no galpão são fatos distintos. A primeira confirma o que foi recolhido no evento; a segunda confirma o que realmente retornou ao estoque.

### Banco e migrations

- Projeto Supabase remoto conectado e migrations aplicadas.
- `20260805005000_add_return_collection_movement_type.sql`: tipo de movimentação para coleta do retorno.
- `20260805010000_event_return_collection.sql`: persistência do fluxo de coleta no evento.
- `20260805020000_require_confirmed_event_for_reservations.sql`: bloqueio de reservas para eventos ainda planejados.
- RLS multi-tenant, autenticação e operações transacionais continuam ativas.

### Publicação na Vercel

- Projeto correto: `gestaolocacao`, na equipe `nandofds-s-projects18`.
- Produção pública: `https://gestaolocacao.vercel.app`.
- Preview usado na validação: `gestaolocacao-4jkh45l19-nandofds-s-projects18.vercel.app`.
- Os projetos antigos `gestao-locacao`, `gestao_gglocacao` e `gg_equipe_loca` foram excluídos em 5 de agosto de 2026.
- Variáveis públicas de produção configuradas: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Nunca registrar neste arquivo os valores das variáveis, senhas ou tokens.
- O build de produção foi refeito após configurar o Supabase e o domínio foi atualizado.
- Manifesto e service worker da PWA estão publicados via HTTPS.

### Validações realizadas

- TypeScript aprovado.
- ESLint aprovado.
- Build Vite local e build remoto da Vercel aprovados.
- Produção respondeu HTTP 200 e entregou o pacote JavaScript novo.
- Manifesto PWA respondeu corretamente.
- A verificação visual automatizada externa ficou pendente porque o navegador Playwright local não está instalado; o teste manual no celular deve confirmar login e câmera.

### Próximos testes manuais

1. Abrir `https://gestaolocacao.vercel.app` em janela anônima e confirmar a tela de login.
2. Autenticar e confirmar empresa/usuário ativos.
3. Selecionar um evento confirmado no PWA.
4. Testar câmera e permissão de QR em um aparelho físico.
5. Registrar saída, coleta na desmontagem e retorno ao galpão.
6. Validar comportamento offline e posterior sincronização.
7. Confirmar que eventos planejados não aceitam seleção de equipamentos.
8. Se uma versão antiga aparecer, limpar os dados do site ou reinstalar o PWA por causa do cache do service worker.

### Pendências antes do uso definitivo

- Configurar SMTP próprio no Supabase, reativar confirmação de e-mail e testar recuperação de senha.
- Executar o roteiro completo de `docs/TESTES.md` no ambiente publicado.
- Validar câmera em Android/iOS reais.
- Revisar o aviso de bundle JavaScript acima de 500 kB; não bloqueia os testes, mas recomenda futura divisão de código.
