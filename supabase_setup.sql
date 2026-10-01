-- =============================================================================
-- DIGITAL SOLUTIONS — Setup principal do banco de dados
-- Executar primeiro, antes dos demais scripts
-- =============================================================================


-- =============================================================================
-- TABELA: usuarios
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  telefone TEXT,
  tipo TEXT NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente', 'contador', 'admin')),
  contador_indicador_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_cpf_cnpj ON usuarios(cpf_cnpj);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX idx_usuarios_contador_indicador ON usuarios(contador_indicador_id);

-- Checagem de admin usada em todas as policies. SECURITY DEFINER para não
-- reentrar na RLS de usuarios (uma policy consultando a própria tabela gera
-- recursão infinita).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND tipo = 'admin'
  );
$$;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver seu proprio perfil"
  ON usuarios FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins podem ver todos os usuarios"
  ON usuarios FOR SELECT
  USING (
    public.is_admin()
  );

CREATE POLICY "Admins podem inserir usuarios"
  ON usuarios FOR INSERT
  WITH CHECK (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: products — catálogo, mesma tabela usada pelo site da loja (Lovable).
-- Colunas em inglês mantidas para não quebrar o front da loja.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC,
  icon TEXT NOT NULL DEFAULT 'shield',
  active BOOLEAN NOT NULL DEFAULT true,
  -- Produtos com períodos têm preço por 12 e 24 meses; sem períodos, só 12 meses
  has_periods BOOLEAN NOT NULL DEFAULT false,
  price_12m NUMERIC,
  original_price_12m NUMERIC,
  price_24m NUMERIC,
  original_price_24m NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_active ON products(active);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos ativos sao publicos"
  ON products FOR SELECT
  USING (active = true);

-- Escrita e leitura de inativos só para admin (antes qualquer usuário logado
-- podia editar — inseguro com contadores/clientes no mesmo Auth)
CREATE POLICY "Admins podem gerenciar produtos"
  ON products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- TABELA: site_settings — textos, WhatsApp, rodapé e tags do site da loja
-- Leitura pública: nunca guardar segredos aqui.
-- =============================================================================
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configuracoes sao publicas para leitura"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar configuracoes"
  ON site_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- TABELA: cupons
-- =============================================================================
CREATE TABLE IF NOT EXISTS cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL CHECK (percentual_desconto BETWEEN 1 AND 100),
  contador_id UUID REFERENCES usuarios(id),
  validade TIMESTAMPTZ,
  limite_usos INTEGER,
  usos_realizados INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cupons_codigo ON cupons(codigo);
CREATE INDEX idx_cupons_contador ON cupons(contador_id);

ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cupons ativos sao publicos para leitura"
  ON cupons FOR SELECT
  USING (ativo = true);

CREATE POLICY "Admins podem gerenciar cupons"
  ON cupons FOR ALL
  USING (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: contadores_parceiros
-- =============================================================================
CREATE TABLE IF NOT EXISTS contadores_parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  percentual_comissao NUMERIC(5,2) NOT NULL CHECK (percentual_comissao BETWEEN 0 AND 100),
  percentual_desconto_cupom NUMERIC(5,2) NOT NULL DEFAULT 0,
  chave_pix TEXT,
  dados_bancarios JSONB,
  cupom_id UUID REFERENCES cupons(id),
  total_vendas INTEGER NOT NULL DEFAULT 0,
  total_comissoes NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contadores_usuario ON contadores_parceiros(usuario_id);
CREATE INDEX idx_contadores_ativo ON contadores_parceiros(ativo);

ALTER TABLE contadores_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contadores podem ver seus proprios dados"
  ON contadores_parceiros FOR SELECT
  USING (usuario_id::text = auth.uid()::text);

CREATE POLICY "Contadores podem atualizar seus dados bancarios"
  ON contadores_parceiros FOR UPDATE
  USING (usuario_id::text = auth.uid()::text)
  WITH CHECK (usuario_id::text = auth.uid()::text);

CREATE POLICY "Admins podem gerenciar contadores"
  ON contadores_parceiros FOR ALL
  USING (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: pedidos
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  produto_id UUID NOT NULL REFERENCES products(id),
  periodo_meses INTEGER NOT NULL DEFAULT 12 CHECK (periodo_meses IN (12, 24)),
  contador_id UUID REFERENCES contadores_parceiros(id),
  cupom_id UUID REFERENCES cupons(id),
  valor_bruto NUMERIC(10,2) NOT NULL,
  valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(10,2) NOT NULL,
  comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  comissao_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(10,2) NOT NULL,
  status_pagamento TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status_pagamento IN ('aguardando', 'pago', 'estornado', 'falhou')),
  etapa_atual TEXT,
  sicoob_txid TEXT,
  sicoob_e2e_id TEXT,
  pix_copia_e_cola TEXT,
  tem_correcao_pendente BOOLEAN NOT NULL DEFAULT false,
  novo_pedido_id UUID REFERENCES pedidos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_status ON pedidos(status_pagamento);
CREATE INDEX idx_pedidos_etapa ON pedidos(etapa_atual);
CREATE INDEX idx_pedidos_contador ON pedidos(contador_id);
CREATE UNIQUE INDEX idx_pedidos_sicoob_txid ON pedidos(sicoob_txid) WHERE sicoob_txid IS NOT NULL;

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver seus proprios pedidos"
  ON pedidos FOR SELECT
  USING (usuario_id::text = auth.uid()::text);

CREATE POLICY "Contadores podem ver pedidos vinculados"
  ON pedidos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contadores_parceiros cp
      WHERE cp.id = pedidos.contador_id
        AND cp.usuario_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Admins podem gerenciar pedidos"
  ON pedidos FOR ALL
  USING (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: certificados
-- =============================================================================
CREATE TABLE IF NOT EXISTS certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  produto_id UUID NOT NULL REFERENCES products(id),
  data_compra TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_validacao TIMESTAMPTZ,
  data_expiracao TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'ativo', 'expirado', 'cancelado')),
  numero_serie TEXT,
  contador_indicador_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certificados_usuario ON certificados(usuario_id);
CREATE INDEX idx_certificados_pedido ON certificados(pedido_id);
CREATE INDEX idx_certificados_status ON certificados(status);
CREATE INDEX idx_certificados_expiracao ON certificados(data_expiracao);

ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver seus proprios certificados"
  ON certificados FOR SELECT
  USING (usuario_id::text = auth.uid()::text);

CREATE POLICY "Admins podem gerenciar certificados"
  ON certificados FOR ALL
  USING (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: disponibilidade
-- =============================================================================
CREATE TABLE IF NOT EXISTS disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  intervalo_minutos INTEGER NOT NULL DEFAULT 30 CHECK (intervalo_minutos > 0),
  max_por_horario INTEGER NOT NULL DEFAULT 1 CHECK (max_por_horario > 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT hora_valida CHECK (hora_fim > hora_inicio)
);

ALTER TABLE disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disponibilidade e publica para leitura"
  ON disponibilidade FOR SELECT
  USING (ativo = true);

CREATE POLICY "Admins podem gerenciar disponibilidade"
  ON disponibilidade FOR ALL
  USING (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: bloqueios
-- =============================================================================
CREATE TABLE IF NOT EXISTS bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bloqueios_data ON bloqueios(data);

ALTER TABLE bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bloqueios sao publicos para leitura"
  ON bloqueios FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar bloqueios"
  ON bloqueios FOR ALL
  USING (
    public.is_admin()
  );

-- =============================================================================
-- TABELA: agendamentos
-- =============================================================================
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificado_id UUID NOT NULL REFERENCES certificados(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'agendado'
    CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado', 'reagendado')),
  observacoes_cliente TEXT,
  observacoes_admin TEXT,
  notificacao_enviada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX idx_agendamentos_usuario ON agendamentos(usuario_id);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_certificado ON agendamentos(certificado_id);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver seus proprios agendamentos"
  ON agendamentos FOR SELECT
  USING (usuario_id::text = auth.uid()::text);

CREATE POLICY "Usuarios podem criar agendamentos"
  ON agendamentos FOR INSERT
  WITH CHECK (usuario_id::text = auth.uid()::text);

CREATE POLICY "Admins podem gerenciar agendamentos"
  ON agendamentos FOR ALL
  USING (
    public.is_admin()
  );
