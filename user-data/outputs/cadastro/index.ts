// =========================================================
// REDE BENEDETTI - Edge Function: cadastro (COM CORS)
// Cadastra posto, motorista ou gerente sem precisar do SQL Editor
// Ações: posto | motorista | gerente
// =========================================================
// Deploy: supabase functions deploy cadastro --no-verify-jwt

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipo } = body;

    if (tipo === 'listar_postos') {
      const { data, error } = await sb
        .from('postos')
        .select('id, nome, cnpj, latitude, longitude')
        .order('nome');
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, postos: data });
    }

    if (tipo === 'listar_motoristas') {
      const { data, error } = await sb
        .from('motoristas')
        .select('id, nome, telefone, placa_padrao')
        .eq('ativo', true)
        .order('nome');
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, motoristas: data });
    }

    if (tipo === 'excluir_posto') {
      const { id } = body;
      if (!id) return json({ error: 'id é obrigatório' }, 400);
      // bloqueia se tiver QUALQUER carga (inclusive histórico), pois excluir o posto
      // apaga em cascata as cargas vinculadas a ele no banco
      const { count } = await sb
        .from('cargas_transporte')
        .select('id', { count: 'exact', head: true })
        .eq('posto_id', id);
      if (count && count > 0) {
        return json({ error: `Este posto tem ${count} carga(s) no histórico e não pode ser excluído (evita perder registros de entregas).` }, 400);
      }
      const { error } = await sb.from('postos').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (tipo === 'excluir_motorista') {
      const { id } = body;
      if (!id) return json({ error: 'id é obrigatório' }, 400);
      const { count } = await sb
        .from('cargas_transporte')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', id)
        .in('status', ['aguardando_carregamento', 'em_transito']);
      if (count && count > 0) {
        return json({ error: `Este motorista tem ${count} carga(s) ativa(s). Finalize ou cancele antes de excluir.` }, 400);
      }
      const { error } = await sb.from('motoristas').update({ ativo: false }).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (tipo === 'posto') {
      const { nome, cnpj, latitude, longitude } = body;
      if (!nome) return json({ error: 'Nome do posto é obrigatório' }, 400);

      const { data, error } = await sb.rpc('cadastrar_posto', {
        p_nome: nome,
        p_cnpj: cnpj || null,
        p_latitude: latitude || null,
        p_longitude: longitude || null
      });
      if (error) return json({ error: error.message.includes('unique') ? 'Já existe um posto com esse CNPJ' : error.message }, 400);
      return json({ ok: true, id: data });
    }

    if (tipo === 'motorista') {
      const { nome, telefone, pin, placa } = body;
      if (!nome || !telefone || !pin) return json({ error: 'Nome, telefone e PIN são obrigatórios' }, 400);
      if (!/^\d{4}$/.test(pin)) return json({ error: 'PIN precisa ter exatamente 4 dígitos' }, 400);

      const { data, error } = await sb.rpc('cadastrar_motorista', {
        p_nome: nome,
        p_telefone: telefone,
        p_pin: pin,
        p_placa: placa || null
      });
      if (error) return json({ error: error.message.includes('unique') ? 'Já existe um motorista com esse telefone' : error.message }, 400);
      return json({ ok: true, id: data });
    }

    if (tipo === 'gerente') {
      const { cnpj_posto, nome, pin, telefone } = body;
      if (!cnpj_posto || !nome || !pin) return json({ error: 'CNPJ do posto, nome e PIN são obrigatórios' }, 400);
      if (!/^\d{4}$/.test(pin)) return json({ error: 'PIN precisa ter exatamente 4 dígitos' }, 400);

      const { data, error } = await sb.rpc('cadastrar_gerente', {
        p_cnpj_posto: cnpj_posto,
        p_nome: nome,
        p_pin: pin,
        p_telefone: telefone || null
      });
      if (error) {
        const msg = error.message.includes('unique')
          ? 'Já existe um gerente cadastrado para este posto'
          : error.message;
        return json({ error: msg }, 400);
      }
      return json({ ok: true, id: data });
    }

    return json({ error: 'Tipo de cadastro inválido' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
