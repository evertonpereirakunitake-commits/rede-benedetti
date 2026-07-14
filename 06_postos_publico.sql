-- =========================================================
-- REDE BENEDETTI - View pública de postos
-- Rode DEPOIS do 04_motoristas_e_atribuicao.sql
-- Necessária para: atribuir_carga.html (lista de postos) e
-- painel_gerente.html (posição do posto no mapa)
-- =========================================================

-- View pública segura: só id + nome + lat/lng (sem dados sensíveis do posto)
CREATE OR REPLACE VIEW postos_publico AS
SELECT id, nome, latitude, longitude FROM postos;

GRANT SELECT ON postos_publico TO anon, authenticated;
