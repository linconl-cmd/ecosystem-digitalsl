-- =============================================================================
-- DIGITAL SOLUTIONS — Repasse automático de comissão via Sicoob
-- Executar após supabase_setup.sql
-- =============================================================================

-- Saldo já repassado ao contador (saldo pendente = total_comissoes - total_repassado)
ALTER TABLE contadores_parceiros
  ADD COLUMN IF NOT EXISTS total_repassado NUMERIC(10,2) NOT NULL DEFAULT 0;

-- =============================================================================
-- TABELA: repasses_comissao
-- =============================================================================
CREATE TABLE IF NOT EXISTS repasses_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contador_id UUID NOT NULL REFERENCES contadores_parceiros(id),
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'concluido', 'falhou')),
  sicoob_transacao_id TEXT,
  erro TEXT,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ
);

CREATE INDEX idx_repasses_contador ON repasses_comissao(contador_id);
CREATE INDEX idx_repasses_status ON repasses_comissao(status);

ALTER TABLE repasses_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contadores podem ver seus proprios repasses"
  ON repasses_comissao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contadores_parceiros cp
      WHERE cp.id = repasses_comissao.contador_id
        AND cp.usuario_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Admins podem gerenciar repasses"
  ON repasses_comissao FOR ALL
  USING (
    public.is_admin()
  );
