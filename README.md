# Digital Solutions

Sistema completo de venda e gestão de certificados digitais.

## Stack

- **Next.js 14** — App Router + TypeScript
- **Supabase** — PostgreSQL com RLS
- **Sicoob API** — Recebimento via Pix (cobrança imediata) e repasse automático de comissão aos contadores via Pix
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
5. `supabase_repasses.sql` — Repasse automático de comissão via Sicoob
6. `supabase_dados_loja.sql` — Produtos e configurações atuais da loja (exportados do banco antigo)

### 3.1 Criar o usuário admin

1. No Supabase, vá em **Authentication → Users → Add user** e crie o usuário admin (e-mail e senha).
2. Copie o UUID dele e rode no SQL Editor:

```sql
INSERT INTO usuarios (id, nome, email, cpf_cnpj, tipo)
VALUES ('<UUID-DO-USUARIO-AUTH>', 'Admin', 'seu@email.com.br', '<seu CPF/CNPJ só números>', 'admin');
```

Sem essa linha o login funciona, mas as permissões de admin (editar produtos e configurações) não.

### 3.2 Apontar a loja para este banco

No Vercel do site da loja, altere as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para as do novo projeto e faça um novo deploy. A loja e este sistema passam a usar o mesmo banco (`products` e `site_settings` são compartilhados).

### 4. Configurar a Sicoob

1. Crie o aplicativo em [developers.sicoob.com.br](https://developers.sicoob.com.br) com o certificado ICP-Brasil da conta e preencha as variáveis `SICOOB_*` (o `.pfx` vai em base64 em `SICOOB_CERTIFICADO_BASE64`).
2. Cadastre na Sicoob a URL de webhook da chave Pix (`SICOOB_CHAVE_PIX`) como `<APP_URL>/api/sicoob/webhook` — a Sicoob chama `<url>/pix` a cada Pix recebido.

### 5. Rodar em desenvolvimento

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

- **E-commerce** — Loja de certificados A1/A3 com checkout via Pix (Sicoob)
- **Painel Admin** — CRUD, pipeline kanban, estornos, relatórios
- **Portal do Contador** — Vendas, comissões, extrato
- **Painel de Consulta** — Busca de clientes e certificados
- **Agendamento** — Sistema de agendamento de emissão
- **Parcerias** — Contratos digitais com assinatura eletrônica
