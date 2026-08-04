# Lume — Gestão de locação para eventos

Aplicação React/TypeScript com duas superfícies separadas:

- painel de gestão para desktop;
- PWA operacional mobile, preparada para leituras offline.

## Executar

Requer Node.js 22 LTS ou superior e npm 10 ou superior. As versões atuais do cliente Supabase exigem Node.js 22; Node 20 não é um ambiente suportado para este projeto.

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e preencha as credenciais públicas do Supabase. Sem elas, a interface usa dados demonstrativos locais.

## Banco de dados

A migration inicial está em `supabase/migrations`. Ela preserva as regras centrais: Item e Insumo são naturezas distintas, status de Item é derivado dos fatos e reservas serializadas não podem se sobrepor.

## Multi-tenant

Cada usuário pertence a uma ou mais empresas. Todas as tabelas operacionais são isoladas por `organization_id` e políticas Row Level Security; novos cadastros criam automaticamente a primeira empresa do usuário.

O usuário mais antigo da instalação recebe o papel protegido de administrador da plataforma. Ele pode criar empresas, alternar a empresa ativa e acessar todos os tenants; usuários comuns continuam limitados às empresas das quais são membros.

## PWA/offline

O service worker armazena o shell da aplicação. Leituras realizadas offline entram em uma fila local versionada e são removidas quando a conexão retorna. A sincronização com tabelas reais será ativada depois da configuração do projeto Supabase e autenticação.
