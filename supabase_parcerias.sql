-- =============================================================================
-- DIGITAL SOLUTIONS — Sistema de parcerias e contratos
-- Executar após supabase_setup.sql
-- =============================================================================

-- =============================================================================
-- TABELA: modelos_contrato
-- =============================================================================
CREATE TABLE IF NOT EXISTS modelos_contrato (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  conteudo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE modelos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar modelos de contrato"
  ON modelos_contrato FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

-- Inserir modelo padrão
INSERT INTO modelos_contrato (nome, versao, conteudo, ativo) VALUES (
  'Contrato Padrão de Parceria',
  1,
  E'CONTRATO DE PARCERIA COMERCIAL\n\nPelo presente instrumento particular, de um lado:\n\n**{{nome_empresa}}**, doravante denominada CONTRATANTE;\n\nE de outro lado:\n\n**{{nome_contador}}**, doravante denominado(a) PARCEIRO(A);\n\nResolvem celebrar o presente Contrato de Parceria Comercial, mediante as seguintes cláusulas e condições:\n\n## CLÁUSULA 1ª — DO OBJETO\n\nO presente contrato tem por objeto a parceria comercial para indicação e venda de certificados digitais, onde o(a) PARCEIRO(A) atuará como indicador(a) de clientes para a CONTRATANTE.\n\n## CLÁUSULA 2ª — DA COMISSÃO\n\nA CONTRATANTE pagará ao(à) PARCEIRO(A) uma comissão de **{{percentual_comissao}}%** (por cento) sobre o valor de cada venda realizada através de indicação direta do(a) PARCEIRO(A).\n\n## CLÁUSULA 3ª — DO CUPOM DE DESCONTO\n\nO(A) PARCEIRO(A) receberá um cupom de desconto exclusivo com o código **{{codigo_cupom}}**, que oferece **{{percentual_desconto}}%** de desconto aos clientes indicados.\n\n## CLÁUSULA 4ª — DO PRAZO\n\nO presente contrato terá validade de **{{prazo_validade}}**, podendo ser renovado por acordo mútuo entre as partes.\n\n## CLÁUSULA 5ª — DO PAGAMENTO\n\nAs comissões serão calculadas automaticamente e transferidas via Stripe Connect para a conta cadastrada pelo(a) PARCEIRO(A).\n\n## CLÁUSULA 6ª — DAS OBRIGAÇÕES DO PARCEIRO\n\nO(A) PARCEIRO(A) se compromete a:\na) Indicar clientes de forma ética e transparente;\nb) Não utilizar práticas comerciais enganosas;\nc) Manter seus dados cadastrais atualizados.\n\n## CLÁUSULA 7ª — DA RESCISÃO\n\nO presente contrato poderá ser rescindido por qualquer das partes, mediante comunicação prévia de 30 (trinta) dias.\n\n## CLÁUSULA 8ª — DAS DISPOSIÇÕES GERAIS\n\n{{observacoes}}\n\nData: **{{data_atual}}**\n\nAs partes declaram ter lido e concordado com todos os termos acima.',
  true
);

-- =============================================================================
-- TABELA: convites_parceria
-- =============================================================================
CREATE TABLE IF NOT EXISTS convites_parceria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_contador TEXT NOT NULL,
  nome_contador TEXT NOT NULL,
  percentual_comissao NUMERIC(5,2) NOT NULL CHECK (percentual_comissao BETWEEN 1 AND 100),
  percentual_desconto_cupom NUMERIC(5,2) NOT NULL CHECK (percentual_desconto_cupom BETWEEN 1 AND 100),
  codigo_cupom TEXT NOT NULL,
  prazo_validade_parceria TEXT,
  observacoes TEXT,
  modelo_contrato_id UUID NOT NULL REFERENCES modelos_contrato(id),
  versao_contrato INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_expira_em TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'visualizado', 'assinado', 'recusado', 'expirado')),
  origem TEXT NOT NULL DEFAULT 'admin' CHECK (origem IN ('admin', 'contador')),
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_convites_token ON convites_parceria(token);
CREATE INDEX idx_convites_email ON convites_parceria(email_contador);
CREATE INDEX idx_convites_status ON convites_parceria(status);

ALTER TABLE convites_parceria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar convites"
  ON convites_parceria FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

-- =============================================================================
-- TABELA: assinaturas_contrato
-- =============================================================================
CREATE TABLE IF NOT EXISTS assinaturas_contrato (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  convite_id UUID NOT NULL REFERENCES convites_parceria(id),
  contador_parceiro_id UUID REFERENCES contadores_parceiros(id),
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conteudo_contrato_assinado TEXT NOT NULL,
  versao_contrato INTEGER NOT NULL,
  percentual_comissao_acordado NUMERIC(5,2) NOT NULL,
  percentual_desconto_acordado NUMERIC(5,2) NOT NULL,
  codigo_cupom_acordado TEXT NOT NULL,
  prazo_validade_acordado TEXT,
  hash_integridade TEXT NOT NULL
);

CREATE INDEX idx_assinaturas_convite ON assinaturas_contrato(convite_id);
CREATE INDEX idx_assinaturas_contador ON assinaturas_contrato(contador_parceiro_id);

ALTER TABLE assinaturas_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contadores podem ver suas assinaturas"
  ON assinaturas_contrato FOR SELECT
  USING (email = (SELECT email FROM usuarios WHERE id::text = auth.uid()::text));

CREATE POLICY "Admins podem ver todas as assinaturas"
  ON assinaturas_contrato FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

-- =============================================================================
-- TABELA: solicitacoes_parceria
-- =============================================================================
CREATE TABLE IF NOT EXISTS solicitacoes_parceria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cpf TEXT NOT NULL,
  telefone TEXT,
  nome_escritorio TEXT,
  crc TEXT,
  mensagem TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'aprovado', 'recusado')),
  observacao_admin TEXT,
  convite_id UUID REFERENCES convites_parceria(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solicitacoes_status ON solicitacoes_parceria(status);
CREATE INDEX idx_solicitacoes_email ON solicitacoes_parceria(email);

ALTER TABLE solicitacoes_parceria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar solicitacoes"
  ON solicitacoes_parceria FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );
