-- =========================================================
-- REDE BENEDETTI - Usinas e contratos de compra (estoque)
-- Rode DEPOIS do 08_setup_completo.sql. Idempotente.
--
-- Fluxo: o dono compra combustível (contrato com usina, volume
-- fechado) = ENTRADA. Cada carga lançada vinculada ao contrato
-- abate do saldo = SAÍDA. Saldo é sempre calculado (contratado
-- menos a soma das cargas não canceladas), nunca armazenado,
-- pra não dessincronizar.
-- =========================================================

-- ---------- 1) USINAS (fornecedores) ----------
CREATE TABLE IF NOT EXISTS usinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cidade TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE usinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_gerencia_usinas" ON usinas;
CREATE POLICY "service_role_gerencia_usinas" ON usinas FOR ALL USING (auth.role() = 'service_role');

-- ---------- 2) CONTRATOS DE COMPRA (entradas) ----------
CREATE TABLE IF NOT EXISTS contratos_combustivel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usina_id UUID NOT NULL REFERENCES usinas(id) ON DELETE CASCADE,
    combustivel TEXT NOT NULL CHECK (combustivel IN ('Diesel S10', 'Etanol', 'Gasolina', 'Gasolina Aditivada')),
    volume_contratado NUMERIC(12,2) NOT NULL CHECK (volume_contratado > 0),
    numero_contrato TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE contratos_combustivel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_gerencia_contratos" ON contratos_combustivel;
CREATE POLICY "service_role_gerencia_contratos" ON contratos_combustivel FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_contratos_usina ON contratos_combustivel(usina_id);

-- ---------- 3) Vínculo carga -> contrato (saída abate do saldo) ----------
ALTER TABLE cargas_transporte
    ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos_combustivel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cargas_contrato ON cargas_transporte(contrato_id);
