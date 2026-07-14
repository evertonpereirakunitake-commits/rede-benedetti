-- =========================================================
-- REDE BENEDETTI - Rastreamento de Carga em Tempo Real
-- Tabela: cargas_transporte (VERSÃO REVISADA)
-- =========================================================

-- 1) Se o campo lat/lng ainda não existir na tabela de postos, descomente:
-- ALTER TABLE postos ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
-- ALTER TABLE postos ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

-- 2) Tabela principal de cargas em transporte
CREATE TABLE IF NOT EXISTS cargas_transporte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Destino
    posto_id UUID NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
    posto_nome TEXT NOT NULL,

    -- Carga
    combustivel TEXT NOT NULL CHECK (combustivel IN ('Diesel S10', 'Etanol', 'Gasolina', 'Gasolina Aditivada')),
    volume_total NUMERIC(10,2) NOT NULL,
    numero_nota_fiscal TEXT,

    -- Motorista
    motorista_nome TEXT NOT NULL,
    motorista_telefone TEXT,
    motorista_placa TEXT,

    -- Status da viagem
    status TEXT NOT NULL DEFAULT 'aguardando_carregamento'
        CHECK (status IN ('aguardando_carregamento', 'em_transito', 'entregue', 'cancelada')),

    -- Localização em tempo real
    latitude_atual NUMERIC(10,7),
    longitude_atual NUMERIC(10,7),
    localizacao_atualizada_em TIMESTAMPTZ,

    -- Tempo estimado
    velocidade_media_kmh NUMERIC(5,2) DEFAULT 55,
    distancia_restante_km NUMERIC(10,2),
    tempo_estimado_min INTEGER,

    -- Controle
    iniciado_em TIMESTAMPTZ,          -- preenchido quando o motorista confirma o carregamento
    entregue_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cargas_transporte_posto ON cargas_transporte(posto_id);
CREATE INDEX IF NOT EXISTS idx_cargas_transporte_status ON cargas_transporte(status);

-- =========================================================
-- 3) RLS: todo acesso a esta tabela passa pelas Edge Functions
--    (que usam service_role). Público não acessa direto.
-- =========================================================
ALTER TABLE cargas_transporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "somente_service_role_gerencia_cargas" ON cargas_transporte;

CREATE POLICY "somente_service_role_gerencia_cargas"
ON cargas_transporte
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
