# Digital Solutions

Sistema completo de venda e gestão de certificados digitais.

## Stack

- **Next.js 14** — App Router + TypeScript
- **Supabase** — PostgreSQL com RLS
- **Stripe** — Pagamentos + Stripe Connect (split de comissões)
- **Resend** — E-mails transacionais
- **Tailwind CSS** — Estilização
- **Zod** — Validação de dados

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha as variáveis no `.env.local` com suas credenciais.

### 3. Configurar banco de dados

Execute os scripts SQL no Supabase SQL Editor na seguinte ordem:

1. `supabase_setup.sql` — Tabelas principais
2. `supabase_pipeline.sql` — Pipeline de atendimento
3. `supabase_correcoes.sql` — Sistema de estornos
4. `supabase_parcerias.sql` — Sistema de parcerias

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura

```
src/
├── app/          # Rotas e páginas (App Router)
│   ├── api/      # API Routes
│   ├── (loja)/   # E-commerce público
│   ├── (admin)/  # Painel administrativo
│   ├── (contador)/ # Portal do contador
│   └── (consulta)/ # Painel de consulta
├── lib/          # Utilitários e integrações
├── types/        # Tipos TypeScript
└── schemas/      # Schemas Zod
```

## Módulos

- **E-commerce** — Loja de certificados A1/A3 com checkout Stripe
- **Painel Admin** — CRUD, pipeline kanban, estornos, relatórios
- **Portal do Contador** — Vendas, comissões, extrato
- **Painel de Consulta** — Busca de clientes e certificados
- **Agendamento** — Sistema de agendamento de emissão
- **Parcerias** — Contratos digitais com assinatura eletrônica
