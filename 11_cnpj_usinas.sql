-- =========================================================
-- REDE BENEDETTI - CNPJ nas usinas/distribuidoras
-- Rode DEPOIS do 10_local_carregamento.sql. Idempotente.
--
-- Permite buscar a usina pelo CNPJ (nome, endereço e cidade
-- preenchidos automaticamente pela base pública da Receita).
-- =========================================================

ALTER TABLE usinas ADD COLUMN IF NOT EXISTS cnpj TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS usinas_cnpj_key ON usinas (cnpj) WHERE cnpj IS NOT NULL;
