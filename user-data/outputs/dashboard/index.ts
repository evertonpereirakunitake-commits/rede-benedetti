// =========================================================
// REDE BENEDETTI - Edge Function: dashboard (COM CORS)
// Visão geral da matriz: KPIs, cargas ativas de toda a rede,
// entregas dos últimos 7 dias, volume por combustível e por posto
// =========================================================
// Deploy: supabase functions deploy dashboard --no-verify-jwt

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

function inicioDoDia(diasAtras = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - diasAtras);
  return d;
}

function chaveDia(iso: string) {
  return iso.slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const inicioHoje = inicioDoDia(0).toISOString();
    const inicio7dias = inicioDoDia(6).toISOString();

    const [{ data: ativas, error: errAtivas }, { data: entreguesHoje, error: errHoje }, { data: entregues7, error: err7 }] =
      await Promise.all([
        sb.from('cargas_transporte')
          .select('*')
          .in('status', ['aguardando_carregamento', 'em_transito', 'aguardando_conferencia'])
          .order('atribuido_em', { ascending: false }),
        sb.from('cargas_transporte')
          .select('volume_total, combustivel')
          .eq('status', 'entregue')
          .gte('entregue_em', inicioHoje),
        sb.from('cargas_transporte')
          .select('volume_total, entregue_em')
          .eq('status', 'entregue')
          .gte('entregue_em', inicio7dias)
      ]);

    if (errAtivas || errHoje || err7) {
      return json({ error: (errAtivas || errHoje || err7)!.message }, 500);
    }

    const listaAtivas = ativas || [];
    const listaHoje = entreguesHoje || [];
    const lista7 = entregues7 || [];

    // KPIs
    const resumo = {
      ativas: listaAtivas.length,
      aguardando: listaAtivas.filter((c) => c.status === 'aguardando_carregamento').length,
      em_transito: listaAtivas.filter((c) => c.status === 'em_transito').length,
      aguardando_conferencia: listaAtivas.filter((c) => c.status === 'aguardando_conferencia').length,
      entregues_hoje: listaHoje.length,
      volume_ativas: listaAtivas.reduce((s, c) => s + Number(c.volume_total || 0), 0),
      volume_entregue_hoje: listaHoje.reduce((s, c) => s + Number(c.volume_total || 0), 0)
    };

    // Entregas por dia (últimos 7 dias, do mais antigo pro mais novo)
    const dias: { data: string; qtd: number; volume: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      dias.push({ data: chaveDia(inicioDoDia(i).toISOString()), qtd: 0, volume: 0 });
    }
    lista7.forEach((c) => {
      const dia = dias.find((d) => d.data === chaveDia(c.entregue_em));
      if (dia) {
        dia.qtd += 1;
        dia.volume += Number(c.volume_total || 0);
      }
    });

    // Volume por combustível (ativas + entregues hoje)
    const porCombustivelMap: Record<string, number> = {};
    [...listaAtivas, ...listaHoje].forEach((c) => {
      porCombustivelMap[c.combustivel] = (porCombustivelMap[c.combustivel] || 0) + Number(c.volume_total || 0);
    });
    const porCombustivel = Object.entries(porCombustivelMap).map(([combustivel, volume]) => ({ combustivel, volume }));

    // Cargas ativas por posto
    const porPostoMap: Record<string, number> = {};
    listaAtivas.forEach((c) => {
      porPostoMap[c.posto_nome] = (porPostoMap[c.posto_nome] || 0) + 1;
    });
    const porPosto = Object.entries(porPostoMap).map(([posto_nome, qtd]) => ({ posto_nome, qtd }));

    return json({
      ok: true,
      gerado_em: new Date().toISOString(),
      resumo,
      ativas: listaAtivas,
      entregas_7dias: dias,
      por_combustivel: porCombustivel,
      por_posto: porPosto
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
