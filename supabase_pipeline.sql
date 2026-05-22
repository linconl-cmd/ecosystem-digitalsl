-- =============================================================================
-- DIGITAL SOLUTIONS — Pipeline de atendimento
-- Executar após supabase_setup.sql
-- =============================================================================

-- =============================================================================
-- TABELA: etapas_pipeline
-- =============================================================================
CREATE TABLE IF NOT EXISTS etapas_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  icone TEXT,
  ordem INTEGER NOT NULL,
  notificar_cliente BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE etapas_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Etapas sao publicas para leitura"
  ON etapas_pipeline FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar etapas"
  ON etapas_pipeline FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

-- Inserir etapas padrão
INSERT INTO etapas_pipeline (codigo, nome, descricao, cor, icone, ordem, notificar_cliente) VALUES
  ('AGUARDANDO_PAGAMENTO', 'Aguardando Pagamento', 'Pedido criado, aguardando confirmação de pagamento', '#F59E0B', 'clock', 1, false),
  ('PAGO_AGUARDANDO_ATENDIMENTO', 'Pago - Aguardando Atendimento', 'Pagamento confirmado, aguardando início do atendimento', '#3B82F6', 'check-circle', 2, true),
  ('EM_ATENDIMENTO', 'Em Atendimento', 'Cliente está sendo atendido', '#8B5CF6', 'user', 3, true),
  ('AGUARDANDO_EMISSAO', 'Aguardando Emissão', 'Documentos validados, aguardando emissão do certificado', '#EC4899', 'file-text', 4, true),
  ('CERTIFICADO_EMITIDO', 'Certificado Emitido', 'Certificado digital emitido com sucesso', '#10B981', 'award', 5, true),
  ('ENVIADO_CLIENTE', 'Enviado ao Cliente', 'Certificado enviado diretamente ao cliente', '#06B6D4', 'send', 6, true),
  ('ENVIADO_CONTABILIDADE', 'Enviado à Contabilidade', 'Certificado enviado ao contador responsável', '#06B6D4', 'building', 6, true),
  ('FINALIZADO', 'Finalizado', 'Processo concluído', '#059669', 'check-circle-2', 7, true),
  ('CANCELADO', 'Cancelado', 'Pedido cancelado', '#EF4444', 'x-circle', 8, true)
ON CONFLICT (codigo) DO NOTHING;

-- Adicionar FK de etapa_atual em pedidos
ALTER TABLE pedidos
  ADD CONSTRAINT fk_pedidos_etapa_atual
  FOREIGN KEY (etapa_atual) REFERENCES etapas_pipeline(codigo);

-- =============================================================================
-- TABELA: pedido_pipeline (histórico imutável)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  etapa_codigo TEXT NOT NULL REFERENCES etapas_pipeline(codigo),
  observacao TEXT,
  criado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedido_pipeline_pedido ON pedido_pipeline(pedido_id);
CREATE INDEX idx_pedido_pipeline_etapa ON pedido_pipeline(etapa_codigo);

ALTER TABLE pedido_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver historico do pipeline"
  ON pedido_pipeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

CREATE POLICY "Admins podem inserir no pipeline"
  ON pedido_pipeline FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id::text = auth.uid()::text AND u.tipo = 'admin'
    )
  );

-- =============================================================================
-- FUNCTION: mover_pedido_pipeline
-- =============================================================================
CREATE OR REPLACE FUNCTION mover_pedido_pipeline(
  p_pedido_id UUID,
  p_etapa_codigo TEXT,
  p_observacao TEXT DEFAULT NULL,
  p_criado_por UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO pedido_pipeline (pedido_id, etapa_codigo, observacao, criado_por)
  VALUES (p_pedido_id, p_etapa_codigo, p_observacao, p_criado_por);

  UPDATE pedidos
  SET etapa_atual = p_etapa_codigo
  WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VIEW: painel_atendimento
-- =============================================================================
CREATE OR REPLACE VIEW painel_atendimento AS
SELECT
  p.id,
  u.nome AS usuario_nome,
  u.email AS usuario_email,
  pr.nome AS produto_nome,
  p.valor_pago,
  p.status_pagamento,
  p.etapa_atual,
  ep.nome AS etapa_nome,
  ep.cor AS etapa_cor,
  uc.nome AS contador_nome,
  c.status AS certificado_status,
  a.data_hora AS agendamento_data,
  a.status AS agendamento_status,
  EXTRACT(EPOCH FROM (NOW() - (
    SELECT pp.created_at
    FROM pedido_pipeline pp
    WHERE pp.pedido_id = p.id
    ORDER BY pp.created_at DESC
    LIMIT 1
  ))) / 3600 AS horas_na_etapa_atual,
  p.created_at
FROM pedidos p
  JOIN usuarios u ON p.usuario_id = u.id
  JOIN produtos pr ON p.produto_id = pr.id
  LEFT JOIN etapas_pipeline ep ON p.etapa_atual = ep.codigo
  LEFT JOIN contadores_parceiros cp ON p.contador_id = cp.id
  LEFT JOIN usuarios uc ON cp.usuario_id = uc.id
  LEFT JOIN certificados c ON c.pedido_id = p.id
  LEFT JOIN agendamentos a ON a.certificado_id = c.id
    AND a.status NOT IN ('cancelado', 'reagendado');

-- =============================================================================
-- VIEW: resumo_mensal
-- =============================================================================
CREATE OR REPLACE VIEW resumo_mensal AS
SELECT
  TO_CHAR(p.created_at, 'YYYY-MM') AS mes,
  COUNT(*)::INTEGER AS total_pedidos,
  COUNT(*) FILTER (WHERE p.etapa_atual = 'FINALIZADO')::INTEGER AS finalizados,
  COUNT(*) FILTER (WHERE p.etapa_atual = 'CANCELADO')::INTEGER AS cancelados,
  COUNT(*) FILTER (WHERE p.etapa_atual NOT IN ('FINALIZADO', 'CANCELADO'))::INTEGER AS em_andamento,
  COALESCE(SUM(p.valor_bruto), 0) AS receita_bruta,
  COALESCE(SUM(p.valor_liquido), 0) AS receita_liquida,
  COALESCE(SUM(p.comissao_valor), 0) AS total_comissoes_pagas,
  AVG(
    CASE WHEN p.etapa_atual = 'FINALIZADO' THEN
      EXTRACT(EPOCH FROM (
        (SELECT pp.created_at FROM pedido_pipeline pp
         WHERE pp.pedido_id = p.id AND pp.etapa_codigo = 'FINALIZADO'
         ORDER BY pp.created_at DESC LIMIT 1)
        - p.created_at
      )) / 3600
    END
  ) AS media_horas_para_finalizar
FROM pedidos p
GROUP BY TO_CHAR(p.created_at, 'YYYY-MM')
ORDER BY mes DESC;
