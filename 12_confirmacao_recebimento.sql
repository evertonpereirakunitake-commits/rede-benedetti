-- =========================================================
-- REDE BENEDETTI - Confirmação de recebimento pelo gerente
-- Rode DEPOIS do 11_cnpj_usinas.sql. Idempotente.
--
-- Novo fluxo de entrega (aceite de dois lados):
--   em_transito -> motorista aperta "Entreguei"
--     -> aguardando_conferencia (gerente confere)
--   -> gerente confirma o VOLUME RECEBIDO -> entregue
-- A diferença entre volume_total e volume_recebido é a "quebra"
-- (variação térmica ou desvio) - fica registrada pra auditoria.
-- =========================================================

-- 1) novo status no ciclo de vida da carga
ALTER TABLE cargas_transporte DROP CONSTRAINT IF EXISTS cargas_transporte_status_check;
ALTER TABLE cargas_transporte ADD CONSTRAINT cargas_transporte_status_check
    CHECK (status IN ('aguardando_carregamento', 'em_transito', 'aguardando_conferencia', 'entregue', 'cancelada'));

-- 2) campos do aceite
ALTER TABLE cargas_transporte
    ADD COLUMN IF NOT EXISTS volume_recebido NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS motorista_confirmou_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS conferido_em TIMESTAMPTZ;
