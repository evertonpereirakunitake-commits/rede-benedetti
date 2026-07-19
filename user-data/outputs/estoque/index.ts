// =========================================================
// REDE BENEDETTI - Edge Function: estoque (COM CORS)
// Controle de compras de combustível nas usinas:
//   ENTRADA = contrato (usina + combustível + volume fechado)
//   SAÍDA   = carga lançada vinculada ao contrato (abate do saldo)
// Ações: listar_usinas | cadastrar_usina | excluir_usina
//        | cadastrar_contrato | listar_contratos | encerrar_contrato
//        | relatorio
// =========================================================
// Deploy: supabase functions deploy estoque --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

// Soma quanto já foi retirado de cada contrato (cargas não canceladas)
async function calcularRetiradas(): Promise<Record<string, number>> {
  const { data } = await sb
    .from('cargas_transporte')
    .select('contrato_id, volume_total, status')
    .not('contrato_id', 'is', null)
    .neq('status', 'cancelada');
  const retiradas: Record<string, number> = {};
  (data || []).forEach((c: any) => {
    retiradas[c.contrato_id] = (retiradas[c.contrato_id] || 0) + Number(c.volume_total || 0);
  });
  return retiradas;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipo } = body;

    if (tipo === 'listar_usinas') {
      const { data, error } = await sb.from('usinas').select('id, nome, cidade, endereco, latitude, longitude').order('nome');
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, usinas: data });
    }

    if (tipo === 'cadastrar_usina') {
      const { nome, cidade, endereco, latitude, longitude } = body;
      if (!nome || !String(nome).trim()) return json({ error: 'Nome da usina é obrigatório' }, 400);
      if (!endereco || !String(endereco).trim()) return json({ error: 'Endereço de carregamento é obrigatório — é o que o motorista vai ver pra saber onde buscar a carga' }, 400);
      const { data, error } = await sb.from('usinas')
        .insert({
          nome: String(nome).trim(),
          cidade: cidade ? String(cidade).trim() : null,
          endereco: String(endereco).trim(),
          latitude: latitude || null,
          longitude: longitude || null
        })
        .select('id').single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data.id });
    }

    if (tipo === 'excluir_usina') {
      const { id } = body;
      if (!id) return json({ error: 'id é obrigatório' }, 400);
      const { count } = await sb.from('contratos_combustivel')
        .select('id', { count: 'exact', head: true }).eq('usina_id', id);
      if (count && count > 0) {
        return json({ error: `Esta usina tem ${count} contrato(s) registrado(s) e não pode ser excluída.` }, 400);
      }
      const { error } = await sb.from('usinas').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (tipo === 'cadastrar_contrato') {
      const { usina_id, combustivel, volume_contratado, numero_contrato } = body;
      if (!usina_id || !combustivel) return json({ error: 'Usina e combustível são obrigatórios' }, 400);
      const volume = Number(volume_contratado);
      if (!isFinite(volume) || volume <= 0) return json({ error: 'Volume contratado precisa ser maior que zero' }, 400);
      const { data, error } = await sb.from('contratos_combustivel')
        .insert({
          usina_id,
          combustivel,
          volume_contratado: volume,
          numero_contrato: numero_contrato ? String(numero_contrato).trim() : null
        })
        .select('id').single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data.id });
    }

    if (tipo === 'listar_contratos') {
      // incluir_encerrados: true traz também os inativos (pra tela de histórico)
      const { incluir_encerrados } = body;
      let query = sb.from('contratos_combustivel')
        .select('id, combustivel, volume_contratado, numero_contrato, ativo, criado_em, usinas(id, nome, endereco, latitude, longitude)')
        .order('criado_em', { ascending: false });
      if (!incluir_encerrados) query = query.eq('ativo', true);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);

      const retiradas = await calcularRetiradas();
      const contratos = (data || []).map((c: any) => {
        const retirado = retiradas[c.id] || 0;
        return {
          id: c.id,
          usina_id: c.usinas?.id || null,
          usina_nome: c.usinas?.nome || '(usina removida)',
          usina_endereco: c.usinas?.endereco || null,
          usina_latitude: c.usinas?.latitude || null,
          usina_longitude: c.usinas?.longitude || null,
          combustivel: c.combustivel,
          numero_contrato: c.numero_contrato,
          volume_contratado: Number(c.volume_contratado),
          retirado,
          saldo: Number(c.volume_contratado) - retirado,
          ativo: c.ativo,
          criado_em: c.criado_em
        };
      });
      return json({ ok: true, contratos });
    }

    if (tipo === 'encerrar_contrato') {
      const { id } = body;
      if (!id) return json({ error: 'id é obrigatório' }, 400);
      // encerrar (não excluir): preserva o histórico de retiradas do contrato
      const { error } = await sb.from('contratos_combustivel').update({ ativo: false }).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (tipo === 'relatorio') {
      // Período: [inicio, fim] em YYYY-MM-DD (fim inclusivo)
      const { inicio, fim } = body;
      if (!inicio || !fim) return json({ error: 'Período (início e fim) é obrigatório' }, 400);
      const fimExclusivo = new Date(fim + 'T00:00:00Z');
      fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);

      const { data: saidas, error } = await sb
        .from('cargas_transporte')
        .select('id, criado_em, posto_nome, motorista_nome, combustivel, volume_total, status, numero_nota_fiscal, contratos_combustivel(numero_contrato, usinas(nome))')
        .gte('criado_em', inicio + 'T00:00:00Z')
        .lt('criado_em', fimExclusivo.toISOString())
        .neq('status', 'cancelada')
        .order('criado_em', { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const lista = (saidas || []).map((c: any) => ({
        id: c.id,
        data: c.criado_em,
        posto: c.posto_nome,
        motorista: c.motorista_nome,
        combustivel: c.combustivel,
        volume: Number(c.volume_total),
        status: c.status,
        nota_fiscal: c.numero_nota_fiscal,
        usina: c.contratos_combustivel?.usinas?.nome || null,
        numero_contrato: c.contratos_combustivel?.numero_contrato || null
      }));

      // Agregados do período
      const porCombustivel: Record<string, number> = {};
      const porUsina: Record<string, number> = {};
      lista.forEach((s) => {
        porCombustivel[s.combustivel] = (porCombustivel[s.combustivel] || 0) + s.volume;
        const u = s.usina || 'Sem contrato vinculado';
        porUsina[u] = (porUsina[u] || 0) + s.volume;
      });

      return json({
        ok: true,
        saidas: lista,
        por_combustivel: Object.entries(porCombustivel).map(([combustivel, volume]) => ({ combustivel, volume })),
        por_usina: Object.entries(porUsina).map(([usina, volume]) => ({ usina, volume }))
      });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
