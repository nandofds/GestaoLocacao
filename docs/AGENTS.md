# Instruções do projeto Lume

Antes de alterar este repositório, leia `docs/PROJECT_MEMORY.md` e preserve as regras rígidas do domínio registradas nele.

## Diretrizes

- O produto possui duas superfícies separadas: painel de gestão desktop e PWA operacional mobile.
- Existem somente duas naturezas de estoque: `Item` serializado, que sai e volta, e `Insumo`, consumível por saldo. Não criar kits.
- Status atual de Item é derivado de fatos; nunca criar status manual como fonte da verdade.
- Disponibilidade utiliza timestamps completos e intervalos de saída até retorno mais folga logística.
- Reserva é plano (`event_items`); movimentação é fato físico (`movements` e `movement_items`).
- O fluxo operacional deve continuar offline e sincronizar depois.
- Não expor segredos. Configuração do Supabase deve permanecer em variáveis de ambiente.
- Antes de concluir mudanças, executar `npm run build` e testes relevantes.

## Arquivos centrais

- `src/App.tsx`: composição atual da interface e fluxos demonstrativos.
- `src/styles.css`: sistema visual responsivo.
- `src/lib/offlineQueue.ts`: fila local inicial.
- `src/lib/supabase.ts`: cliente opcional do Supabase.
- `supabase/migrations/`: modelo inicial do banco.
- `design/`: conceitos visuais aprovados.

