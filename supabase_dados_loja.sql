-- =============================================================================
-- DIGITAL SOLUTIONS — Dados atuais da loja (exportados do banco antigo do Lovable)
-- Executar por último, depois de todos os outros scripts.
-- =============================================================================

INSERT INTO products (id, name, description, price, original_price, icon, active, has_periods, price_12m, original_price_12m, price_24m, original_price_24m, sort_order, created_at, updated_at) VALUES
  ('b87e8627-c66c-4bc8-be11-fcf1537477f9', 'e-CNPJ A3 + Token', 'Validade de 1 a 2 anos|Token |Máxima segurança empresarial|Emissão de NF-e e NFS-e', 377.0, 477, 'building-2', true, true, 347, 433, 377, 477, 4, '2026-03-31T11:01:12.939283+00:00', '2026-03-31T12:02:13.179678+00:00'),
  ('76ffa554-bbf6-427a-85cf-76f422e5bee1', 'NF-e A1', 'Validade de 1 ano|Emissão de Nota Fiscal Eletrônica|Instalação no servidor|Ideal para grande volume', 207.0, 249.9, 'file-text', true, false, NULL, NULL, NULL, NULL, 2, '2026-03-31T11:01:12.939283+00:00', '2026-03-31T12:02:13.144883+00:00'),
  ('a1ed04ab-997f-4c72-8538-2df12e8de11f', 'e-CNPJ A1', 'Validade de 1 ano|Armazenado no computador|Ideal para empresas|Acesso a sistemas da Receita Federal', 207.0, 249.9, 'building', true, false, NULL, NULL, NULL, NULL, 0, '2026-03-31T11:01:12.939283+00:00', '2026-03-31T12:02:13.14957+00:00'),
  ('6d277a02-cc5d-46b1-9ab9-77cfbcc39dda', 'e-CPF A3 + Token', 'Validade de 1 a 2 anos|Token ou cartão inteligente|Maior segurança|Mobilidade para uso em qualquer PC', 327.0, 377, 'user-check', true, true, 297, 367, 327, 377, 5, '2026-03-31T11:01:12.939283+00:00', '2026-03-31T12:02:13.163086+00:00'),
  ('8902574e-c82a-415a-8517-d3f2db7dd95a', 'e-CPF A1', 'Validade de 1 ano|Armazenado no computador|Ideal para pessoa física|Assinatura digital de documentos', 149.9, 169.9, 'user', true, false, NULL, NULL, NULL, NULL, 1, '2026-03-31T11:01:12.939283+00:00', '2026-03-31T12:02:13.162866+00:00'),
  ('f7351086-246a-4542-9335-2afb999b385e', 'CNPJ A3', 'Validade de 1 a 2 anos|Máxima segurança empresarial
|Emissão de NF-e e NFS-e', 227.0, 277, 'shield', true, true, 227, 277, 247, 288, 3, '2026-03-31T11:59:37.851061+00:00', '2026-03-31T12:02:12.874018+00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_settings (id, key, value, created_at, updated_at) VALUES
  ('80eaeb50-bef0-4b37-a3f2-79bf97a0feae', 'whatsapp_product_message', 'Olá Digital Solutions, gostaria de adquirir o certificado: {product_name} - Valor: R$ {price}', '2026-03-31T11:10:00.487533+00:00', '2026-03-31T11:10:00.487533+00:00'),
  ('c97166c5-79d2-4895-a3a1-3f60f5e6a2ea', 'whatsapp_generic_message', 'Olá Digital Solutions, gostaria de mais informações sobre os certificados digitais.', '2026-03-31T11:10:00.487533+00:00', '2026-03-31T11:10:00.487533+00:00'),
  ('cdc05286-976d-4081-97f2-3368e7a794f4', 'hero_title', 'Emita seu Certificado Digital de forma Rápida e Segura', '2026-03-31T11:10:00.487533+00:00', '2026-03-31T11:10:00.487533+00:00'),
  ('37444e2d-887b-4fcd-9bb8-7337aaed31da', 'hero_subtitle', 'Somos especialistas em certificação digital. Atendimento rápido, preços competitivos e suporte completo para você ou sua empresa.', '2026-03-31T11:10:00.487533+00:00', '2026-03-31T11:10:00.487533+00:00'),
  ('55272241-0c5a-4a65-9d03-91c999d0e147', 'whatsapp_number', '5573991430073', '2026-03-31T11:10:00.487533+00:00', '2026-03-31T11:34:25.485126+00:00'),
  ('73398439-6170-4ad2-a890-d8892340b343', 'footer_phone_display', '(73) 99143-0073', '2026-03-31T12:31:18.5229+00:00', '2026-03-31T12:51:21.948845+00:00'),
  ('b4de74cf-1814-449a-9ec4-6c5da4a2abc2', 'footer_location', 'Teixeira de Freitas - BA', '2026-03-31T12:31:18.5229+00:00', '2026-03-31T12:51:21.957152+00:00'),
  ('b8cbe8a5-dd6d-43d9-b004-d70528e8ddcc', 'footer_email', 'digitalsoutions7@gmail.com', '2026-03-31T12:31:18.5229+00:00', '2026-03-31T12:51:21.956867+00:00'),
  ('bbf6bb09-cfcf-466f-8aff-31017abba085', 'footer_cnpj', '45.413.951/0001-20', '2026-03-31T12:31:18.5229+00:00', '2026-03-31T12:51:21.948712+00:00'),
  ('0d28e639-dd5d-4e94-9820-7d37eaa4f7e9', 'gtm_container_id', '', '2026-05-07T19:25:58.90868+00:00', '2026-05-07T19:25:58.90868+00:00'),
  ('be55a63b-4d9a-4779-89d6-62dc5fb538dd', 'ga4_measurement_id', '', '2026-05-07T19:25:58.90868+00:00', '2026-05-07T19:25:58.90868+00:00'),
  ('f1b2f0f2-8e67-45b9-a5ee-aa5ce1d1cfd9', 'google_ads_conversion_id', '', '2026-05-07T19:25:58.90868+00:00', '2026-05-07T19:25:58.90868+00:00'),
  ('f4863303-1f55-40d2-8d4e-e30f60bde9b9', 'google_ads_conversion_label', '', '2026-05-07T19:25:58.90868+00:00', '2026-05-07T19:25:58.90868+00:00'),
  ('acacc984-9828-4d47-bfae-662ef07c615c', 'search_console_verification', '', '2026-05-07T19:25:58.90868+00:00', '2026-05-07T19:25:58.90868+00:00'),
  ('59b814cd-9a9f-412f-9617-8a79f50a3995', 'google_site_verification_meta', '', '2026-05-07T19:25:58.90868+00:00', '2026-05-07T19:25:58.90868+00:00')
ON CONFLICT (key) DO NOTHING;
