-- =========================================================
-- REDE BENEDETTI - Motoristas, Gerentes e Login (VERSÃO REVISADA)
-- Rode DEPOIS do 01_criar_tabela_cargas_transporte.sql
-- =========================================================

-- Extensão para hash de senha
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) Tabela de motoristas (login: telefone + PIN)
-- =========================================================
CREATE TABLE IF NOT EXISTS motoristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL,                  -- armazenado com hash bcrypt
    placa_padrao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE motoristas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_gerencia_motoristas" ON motoristas;

CREATE POLICY "admin_gerencia_motoristas"
ON motoristas
FOR ALL
USING (auth.role() = 'service_role');

-- View pública segura: só id + nome (sem telefone/pin)
-- Usada pela tela atribuir_carga.html para montar o select de motoristas
CREATE OR REPLACE VIEW motoristas_publico AS
SELECT id, nome FROM motoristas WHERE ativo = true;

GRANT SELECT ON motoristas_publico TO anon, authenticated;

-- Função para cadastrar motorista com PIN em hash
CREATE OR REPLACE FUNCTION cadastrar_motorista(
    p_nome TEXT,
    p_telefone TEXT,
    p_pin TEXT,
    p_placa TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO motoristas (nome, telefone, pin, placa_padrao)
    VALUES (p_nome, p_telefone, crypt(p_pin, gen_salt('bf')), p_placa)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo (um por motorista):
-- SELECT cadastrar_motorista('João Silva', '5514999990001', '1234', 'ABC1D23');

-- =========================================================
-- 2) Tabela de gerentes (login: telefone + PIN, 1 por posto)
-- =========================================================
CREATE TABLE IF NOT EXISTS gerentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    posto_id UUID NOT NULL UNIQUE REFERENCES postos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gerentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_gerencia_gerentes_login" ON gerentes;

CREATE POLICY "admin_gerencia_gerentes_login"
ON gerentes
FOR ALL
USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION cadastrar_gerente(
    p_posto_id UUID,
    p_nome TEXT,
    p_telefone TEXT,
    p_pin TEXT
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO gerentes (posto_id, nome, telefone, pin)
    VALUES (p_posto_id, p_nome, p_telefone, crypt(p_pin, gen_salt('bf')))
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo (um por posto):
-- SELECT cadastrar_gerente('uuid-do-posto-marilia', 'Nome do Gerente', '5514999991111', '4321');

-- =========================================================
-- 3) Função de verificação de login (usada pela Edge Function "login")
-- =========================================================
CREATE OR REPLACE FUNCTION verificar_login(
    p_tabela TEXT,
    p_telefone TEXT,
    p_pin TEXT
) RETURNS TABLE(id UUID, nome TEXT, posto_id UUID) AS $$
BEGIN
    IF p_tabela = 'motoristas' THEN
        RETURN QUERY
        SELECT m.id, m.nome, NULL::UUID
        FROM motoristas m
        WHERE m.telefone = p_telefone
          AND m.pin = crypt(p_pin, m.pin)
          AND m.ativo = true;
    ELSIF p_tabela = 'gerentes' THEN
        RETURN QUERY
        SELECT g.id, g.nome, g.posto_id
        FROM gerentes g
        WHERE g.telefone = p_telefone
          AND g.pin = crypt(p_pin, g.pin)
          AND g.ativo = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 4) Vínculo carga <-> motorista cadastrado
-- =========================================================
ALTER TABLE cargas_transporte
    ADD COLUMN IF NOT EXISTS motorista_id UUID REFERENCES motoristas(id),
    ADD COLUMN IF NOT EXISTS atribuido_em TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS carregamento_confirmado_em TIMESTAMPTZ;
