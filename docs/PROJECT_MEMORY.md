# Memória do projeto — Lume

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
- PWA mobile com home operacional.
- Fluxo demonstrativo de conferência de retorno.
- Inclusão simulada de leitura de QR.
- Marcação de dano e mensagem de manutenção.
- Tela “Meus eventos”.
- Fila offline local versionada em `localStorage`.
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

1. Implementar separação, saída e retorno persistidos.
2. Integrar câmera e leitura real de QR.
3. Evoluir a fila offline para IndexedDB e sincronização idempotente com Supabase.
4. Implementar manutenção e auditoria completas.
5. Configurar variáveis e publicar na Vercel.
6. **Último passo antes da produção:** configurar SMTP próprio no Supabase, desativar o `mailer_autoconfirm` usado durante o desenvolvimento, reativar a confirmação de e-mail e validar cadastro, confirmação e recuperação de senha. O provedor padrão do Supabase não deve ser usado em produção por causa do limite reduzido de envios.

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
