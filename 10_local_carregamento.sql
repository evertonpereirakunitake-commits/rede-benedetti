-- =========================================================
-- REDE BENEDETTI - Local de carregamento
-- Rode DEPOIS do 09_estoque_usinas.sql. Idempotente.
--
-- Problema: o motorista via só o posto de DESTINO, nunca onde tinha
-- que ir CARREGAR o combustível. Agora toda carga guarda um endereço
-- de carregamento (da usina, se tiver contrato vinculado, ou digitado
-- na hora pra cargas avulsas).
-- =========================================================

ALTER TABLE usinas
    ADD COLUMN IF NOT EXISTS endereco TEXT,
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

ALTER TABLE cargas_transporte
    ADD COLUMN IF NOT EXISTS local_carregamento TEXT;
