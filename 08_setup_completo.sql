-- =========================================================
-- REDE BENEDETTI - SETUP COMPLETO (idempotente)
-- Cria tudo na ordem certa. Pode rodar quantas vezes quiser.
-- Substitui os scripts 00, 01, 04, 06 e 07 num arquivo só.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 1) POSTOS ----------
CREATE TABLE IF NOT EXISTS postos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE postos ADD COLUMN IF NOT EXISTS cnpj TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS postos_cnpj_key ON postos (cnpj) WHERE cnpj IS NOT NULL;

ALTER TABLE postos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_gerencia_postos" ON postos;
CREATE POLICY "admin_gerencia_postos" ON postos FOR ALL USING (auth.role() = 'service_role');

-- ---------- 2) MOTORISTAS ----------
CREATE TABLE IF NOT EXISTS motoristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL,
    placa_padrao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE motoristas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_gerencia_motoristas" ON motoristas;
CREATE POLICY "admin_gerencia_motoristas" ON motoristas FOR ALL USING (auth.role() = 'service_role');

-- ---------- 3) GERENTES ----------
CREATE TABLE IF NOT EXISTS gerentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    posto_id UUID NOT NULL UNIQUE REFERENCES postos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    pin TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE gerentes ALTER COLUMN telefone DROP NOT NULL;
ALTER TABLE gerentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_gerencia_gerentes_login" ON gerentes;
CREATE POLICY "admin_gerencia_gerentes_login" ON gerentes FOR ALL USING (auth.role() = 'service_role');

-- ---------- 4) CARGAS EM TRANSPORTE ----------
CREATE TABLE IF NOT EXISTS cargas_transporte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    posto_id UUID NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
    posto_nome TEXT NOT NULL,
    combustivel TEXT NOT NULL CHECK (combustivel IN ('Diesel S10', 'Etanol', 'Gasolina', 'Gasolina Aditivada')),
    volume_total NUMERIC(10,2) NOT NULL,
    numero_nota_fiscal TEXT,
    motorista_nome TEXT NOT NULL,
    motorista_telefone TEXT,
    motorista_placa TEXT,
    status TEXT NOT NULL DEFAULT 'aguardando_carregamento'
        CHECK (status IN ('aguardando_carregamento', 'em_transito', 'entregue', 'cancelada')),
    latitude_atual NUMERIC(10,7),
    longitude_atual NUMERIC(10,7),
    localizacao_atualizada_em TIMESTAMPTZ,
    velocidade_media_kmh NUMERIC(5,2) DEFAULT 55,
    distancia_restante_km NUMERIC(10,2),
    tempo_estimado_min INTEGER,
    iniciado_em TIMESTAMPTZ,
    entregue_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- colunas de vínculo com motorista (adicionadas depois, por isso IF NOT EXISTS)
ALTER TABLE cargas_transporte
    ADD COLUMN IF NOT EXISTS motorista_id UUID REFERENCES motoristas(id),
    ADD COLUMN IF NOT EXISTS atribuido_em TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS carregamento_confirmado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cargas_transporte_posto ON cargas_transporte(posto_id);
CREATE INDEX IF NOT EXISTS idx_cargas_transporte_status ON cargas_transporte(status);

ALTER TABLE cargas_transporte ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "somente_service_role_gerencia_cargas" ON cargas_transporte;
CREATE POLICY "somente_service_role_gerencia_cargas" ON cargas_transporte
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------- 5) VIEWS PÚBLICAS ----------
CREATE OR REPLACE VIEW postos_publico AS
    SELECT id, nome, latitude, longitude FROM postos;
GRANT SELECT ON postos_publico TO anon, authenticated;

CREATE OR REPLACE VIEW motoristas_publico AS
    SELECT id, nome FROM motoristas WHERE ativo = true;
GRANT SELECT ON motoristas_publico TO anon, authenticated;

-- ---------- 6) FUNÇÕES ----------
-- limpa assinaturas antigas pra evitar conflito
DROP FUNCTION IF EXISTS cadastrar_posto(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS cadastrar_posto(TEXT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS cadastrar_gerente(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS cadastrar_gerente(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS cadastrar_motorista(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS verificar_login(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION cadastrar_posto(
    p_nome TEXT, p_cnpj TEXT DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL, p_longitude NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO postos (nome, cnpj, latitude, longitude)
    VALUES (p_nome, NULLIF(p_cnpj, ''), p_latitude, p_longitude)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cadastrar_motorista(
    p_nome TEXT, p_telefone TEXT, p_pin TEXT, p_placa TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO motoristas (nome, telefone, pin, placa_padrao)
    VALUES (p_nome, p_telefone, crypt(p_pin, gen_salt('bf')), p_placa)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cadastrar_gerente(
    p_cnpj_posto TEXT, p_nome TEXT, p_pin TEXT, p_telefone TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_posto_id UUID; v_id UUID;
BEGIN
    SELECT id INTO v_posto_id FROM postos WHERE cnpj = p_cnpj_posto;
    IF v_posto_id IS NULL THEN
        RAISE EXCEPTION 'CNPJ não encontrado. Confirme o número ou fale com a matriz.';
    END IF;
    INSERT INTO gerentes (posto_id, nome, telefone, pin)
    VALUES (v_posto_id, p_nome, p_telefone, crypt(p_pin, gen_salt('bf')))
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verificar_login(
    p_tabela TEXT, p_identificador TEXT, p_pin TEXT
) RETURNS TABLE(id UUID, nome TEXT, posto_id UUID) AS $$
BEGIN
    IF p_tabela = 'motoristas' THEN
        RETURN QUERY
        SELECT m.id, m.nome, NULL::UUID
        FROM motoristas m
        WHERE m.telefone = p_identificador
          AND m.pin = crypt(p_pin, m.pin) AND m.ativo = true;
    ELSIF p_tabela = 'gerentes' THEN
        RETURN QUERY
        SELECT g.id, g.nome, g.posto_id
        FROM gerentes g JOIN postos p ON p.id = g.posto_id
        WHERE p.cnpj = p_identificador
          AND g.pin = crypt(p_pin, g.pin) AND g.ativo = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pronto. Agora dá pra cadastrar postos/motoristas/gerentes pelas telas do app.
