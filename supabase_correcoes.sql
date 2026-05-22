-- =============================================================================
-- DIGITAL SOLUTIONS — Sistema de estornos e correções
-- Executar após supabase_pipeline.sql
-- =============================================================================

-- =============================================================================
-- TABELA: correcoes_pedido
-- =============================================================================
CREATE TABLE IF NOT EXISTS correcoes_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  tipo TEXT NOT NULL DEFAULT 'estorno_total' CHECK (tipo IN ('estorno_total')),
  motivo TEXT NOT NULL,
  dados_anteriores JSONB NOT NULL,
  stripe_refund_id TEXT,
  valor_estornado NUMERIC(10,2) NOT NULL,
  nova_session_id TEXT,
  criado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correcoes_pedido ON correcoes_pedido(pedido_id);
CREATE INDEX idx_correcoes_tipo ON correcoes_pedido(tipo);

ALTER TABLE correcoes_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver correcoes"
  ON correcoes_pedido FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

CREATE POLICY "Admins podem criar correcoes"
  ON correcoes_pedido FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

CREATE POLICY "Admins podem atualizar correcoes"
  ON correcoes_pedido FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );
