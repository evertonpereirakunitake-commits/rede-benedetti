-- =========================================================
-- REDE BENEDETTI - Login do gerente por CNPJ do posto
-- Rode DEPOIS do 06_postos_publico.sql
-- Muda o login do gerente de "telefone do gerente" pra "CNPJ do posto":
-- o gerente muda de pessoa, o CNPJ do posto não muda.
-- =========================================================

-- 1) Posto passa a ter CNPJ (único, mas pode ficar em branco por enquanto)
ALTER TABLE postos ADD COLUMN IF NOT EXISTS cnpj TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS postos_cnpj_key ON postos (cnpj) WHERE cnpj IS NOT NULL;

-- 2) Telefone do gerente vira opcional (só contato, não é mais usado pra login)
ALTER TABLE gerentes ALTER COLUMN telefone DROP NOT NULL;

-- 3) Remove as versões antigas das funções (assinaturas antigas) antes de recriar
DROP FUNCTION IF EXISTS cadastrar_posto(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS cadastrar_gerente(UUID, TEXT, TEXT, TEXT);

-- 4) cadastrar_posto agora aceita CNPJ
CREATE OR REPLACE FUNCTION cadastrar_posto(
    p_nome TEXT,
    p_cnpj TEXT DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO postos (nome, cnpj, latitude, longitude)
    VALUES (p_nome, NULLIF(p_cnpj, ''), p_latitude, p_longitude)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) cadastrar_gerente agora recebe o CNPJ do posto (autocadastro), não o posto_id nem telefone obrigatório
CREATE OR REPLACE FUNCTION cadastrar_gerente(
    p_cnpj_posto TEXT,
    p_nome TEXT,
    p_pin TEXT,
    p_telefone TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_posto_id UUID;
    v_id UUID;
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

-- 6) verificar_login: motorista continua por telefone, gerente passa a ser por CNPJ do posto
CREATE OR REPLACE FUNCTION verificar_login(
    p_tabela TEXT,
    p_identificador TEXT,
    p_pin TEXT
) RETURNS TABLE(id UUID, nome TEXT, posto_id UUID) AS $$
BEGIN
    IF p_tabela = 'motoristas' THEN
        RETURN QUERY
        SELECT m.id, m.nome, NULL::UUID
        FROM motoristas m
        WHERE m.telefone = p_identificador
          AND m.pin = crypt(p_pin, m.pin)
          AND m.ativo = true;
    ELSIF p_tabela = 'gerentes' THEN
        RETURN QUERY
        SELECT g.id, g.nome, g.posto_id
        FROM gerentes g
        JOIN postos p ON p.id = g.posto_id
        WHERE p.cnpj = p_identificador
          AND g.pin = crypt(p_pin, g.pin)
          AND g.ativo = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo de cadastro de posto com CNPJ:
-- SELECT cadastrar_posto('Posto Marília', '12345678000199', -22.2171, -49.9500);
