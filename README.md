# Lume — Gestão de locação para eventos

Aplicação React/TypeScript com duas superfícies separadas:

- painel de gestão para desktop;
- PWA operacional mobile, preparada para leituras offline.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e preencha as credenciais públicas do Supabase. Sem elas, a interface usa dados demonstrativos locais.

## Banco de dados

A migration inicial está em `supabase/migrations`. Ela preserva as regras centrais: Item e Insumo são naturezas distintas, status de Item é derivado dos fatos e reservas serializadas não podem se sobrepor.

## PWA/offline

O service worker armazena o shell da aplicação. Leituras realizadas offline entram em uma fila local versionada e são removidas quando a conexão retorna. A sincronização com tabelas reais será ativada depois da configuração do projeto Supabase e autenticação.
