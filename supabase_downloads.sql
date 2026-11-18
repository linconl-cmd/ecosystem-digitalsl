-- =============================================================================
-- DIGITAL SOLUTIONS — Página de downloads da loja
-- Executar depois de supabase_setup.sql (usa is_admin() e update_updated_at_column())
-- =============================================================================

-- O arquivo em si fica no Google Drive; aqui guardamos só o link e os textos.
CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  -- Item em destaque no topo da página (ex.: o Emissor)
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_downloads_active ON downloads(active, sort_order);

CREATE TRIGGER update_downloads_updated_at
  BEFORE UPDATE ON downloads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Downloads ativos sao publicos"
  ON downloads FOR SELECT
  USING (active = true);

CREATE POLICY "Admins podem gerenciar downloads"
  ON downloads FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Dados iniciais. Os drivers entram INATIVOS até o link do Drive ser
-- preenchido, para não aparecerem na loja com botão de download quebrado.
-- Depois de colar o link: UPDATE downloads SET url = '...', active = true WHERE name = '...';
INSERT INTO downloads (name, description, url, featured, sort_order, active) VALUES
  ('Emissor', 'Programa para emissão do seu certificado digital. Siga o tutorial antes de baixar.', 'https://drive.google.com/uc?export=download&id=1Up4tnVr90qpsD-Eo9_sEI-XEA4tUkHrQ', true, 0, true),
  ('SafeSign', 'Driver para leitoras de cartão e tokens criptográficos SafeSign.', '', false, 1, false),
  ('Certisign', 'Gerenciador de certificados Certisign para Windows e macOS.', '', false, 2, false),
  ('Safenet', 'Driver SafeNet Authentication Client para tokens USB.', '', false, 3, false),
  ('GD Burti / Star Sign', 'Drivers para leitoras GD Burti e Star Sign.', '', false, 4, false);
