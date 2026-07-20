// =========================================================
// REDE BENEDETTI - Edge Function: minhas-cargas (COM CORS)
// Ações: listar_motorista | listar_gerente | confirmar_carregamento
//        | atualizar_posicao | confirmar_entrega
// =========================================================
// Deploy: supabase functions deploy minhas-cargas --no-verify-jwt

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

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function calcularDistancia(cargaId: string, latitude: number, longitude: number) {
  const { data: carga } = await sb.from('cargas_transporte').select('posto_id').eq('id', cargaId).single();
  if (!carga) return { distancia: null, tempoEstimado: null };
  const { data: posto } = await sb.from('postos').select('latitude, longitude').eq('id', carga.posto_id).single();
  if (!posto?.latitude || !posto?.longitude) return { distancia: null, tempoEstimado: null };
  const distancia = distanciaKm(latitude, longitude, Number(posto.latitude), Number(posto.longitude));
  return { distancia, tempoEstimado: Math.round((distancia / 55) * 60) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { acao } = body;

    if (acao === 'listar_motorista') {
      const { motorista_id } = body;
      const { data, error } = await sb
        .from('cargas_transporte')
        .select('*')
        .eq('motorista_id', motorista_id)
        .in('status', ['aguardando_carregamento', 'em_transito'])
        .order('atribuido_em', { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, cargas: data });
    }

    if (acao === 'listar_gerente') {
      const { posto_id } = body;
      const { data, error } = await sb
        .from('cargas_transporte')
        .select('*')
        .eq('posto_id', posto_id)
        .in('status', ['aguardando_carregamento', 'em_transito', 'aguardando_conferencia'])
        .order('atribuido_em', { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, cargas: data });
    }

    if (acao === 'confirmar_carregamento') {
      const { carga_id, motorista_id, latitude, longitude } = body;
      const { distancia, tempoEstimado } = await calcularDistancia(carga_id, latitude, longitude);

      const { data, error } = await sb.from('cargas_transporte')
        .update({
          status: 'em_transito',
          carregamento_confirmado_em: new Date().toISOString(),
          iniciado_em: new Date().toISOString(),
          latitude_atual: latitude,
          longitude_atual: longitude,
          localizacao_atualizada_em: new Date().toISOString(),
          distancia_restante_km: distancia,
          tempo_estimado_min: tempoEstimado
        })
        .eq('id', carga_id)
        .eq('motorista_id', motorista_id)
        .select().single();

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, carga: data });
    }

    if (acao === 'atualizar_posicao') {
      const { carga_id, motorista_id, latitude, longitude } = body;
      const { distancia, tempoEstimado } = await calcularDistancia(carga_id, latitude, longitude);

      const { error } = await sb.from('cargas_transporte')
        .update({
          latitude_atual: latitude,
          longitude_atual: longitude,
          localizacao_atualizada_em: new Date().toISOString(),
          distancia_restante_km: distancia,
          tempo_estimado_min: tempoEstimado
        })
        .eq('id', carga_id)
        .eq('motorista_id', motorista_id);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (acao === 'confirmar_entrega') {
      // Motorista diz que chegou e descarregou. Ainda não é o fim: fica
      // "aguardando_conferencia" até o GERENTE confirmar o volume recebido
      // (aceite de dois lados - prova de entrega e controle de quebra).
      const { carga_id, motorista_id } = body;
      const { error } = await sb.from('cargas_transporte')
        .update({ status: 'aguardando_conferencia', motorista_confirmou_em: new Date().toISOString() })
        .eq('id', carga_id)
        .eq('motorista_id', motorista_id)
        .eq('status', 'em_transito');

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (acao === 'confirmar_recebimento') {
      // Gerente confere e informa o volume que REALMENTE chegou. Só aqui
      // a carga vira "entregue" de vez - fecha o ciclo e registra a
      // diferença (quebra) entre o que saiu e o que chegou.
      const { carga_id, posto_id, volume_recebido } = body;
      const volume = Number(volume_recebido);
      if (!carga_id || !posto_id) return json({ error: 'Dados incompletos' }, 400);
      if (!isFinite(volume) || volume <= 0) return json({ error: 'Volume recebido precisa ser um número maior que zero' }, 400);

      const { data, error } = await sb.from('cargas_transporte')
        .update({
          status: 'entregue',
          volume_recebido: volume,
          conferido_em: new Date().toISOString(),
          entregue_em: new Date().toISOString()
        })
        .eq('id', carga_id)
        .eq('posto_id', posto_id)
        .eq('status', 'aguardando_conferencia')
        .select().maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: 'Carga não encontrada ou já conferida' }, 404);
      return json({ ok: true, carga: data });
    }

    return json({ error: 'Ação inválida' }, 400);

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
