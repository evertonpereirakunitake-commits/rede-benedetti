-- =========================================================
-- REDE BENEDETTI - Tabela de postos
-- Rode ANTES do 01_criar_tabela_cargas_transporte.sql
-- (as outras tabelas referenciam "postos", então ela precisa existir primeiro)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS postos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE postos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_gerencia_postos" ON postos;

CREATE POLICY "admin_gerencia_postos"
ON postos
FOR ALL
USING (auth.role() = 'service_role');

-- Função pra cadastrar um posto rapidinho pelo SQL Editor
CREATE OR REPLACE FUNCTION cadastrar_posto(
    p_nome TEXT,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO postos (nome, latitude, longitude)
    VALUES (p_nome, p_latitude, p_longitude)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo (um por posto) - guarde o UUID que aparece no resultado, você vai precisar dele:
-- SELECT cadastrar_posto('Posto Marília', -22.2171, -49.9500);
