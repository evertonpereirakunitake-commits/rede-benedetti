// =========================================================
// REDE BENEDETTI - Edge Function: atribuir-carga (COM CORS)
// =========================================================
// Deploy: supabase functions deploy atribuir-carga --no-verify-jwt

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      posto_id, posto_nome, motorista_id,
      combustivel, volume_total, numero_nota_fiscal
    } = body;

    if (!posto_id || !motorista_id || !combustivel || !volume_total) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), { status: 400, headers: corsHeaders });
    }

    const { data: motorista, error: motErr } = await sb
      .from('motoristas')
      .select('nome, telefone, placa_padrao')
      .eq('id', motorista_id)
      .single();

    if (motErr || !motorista) {
      return new Response(JSON.stringify({ error: 'Motorista não encontrado' }), { status: 404, headers: corsHeaders });
    }

    const { data: carga, error } = await sb.from('cargas_transporte').insert({
      posto_id,
      posto_nome,
      motorista_id,
      motorista_nome: motorista.nome,
      motorista_telefone: motorista.telefone,
      motorista_placa: motorista.placa_padrao,
      combustivel,
      volume_total,
      numero_nota_fiscal: numero_nota_fiscal || null,
      status: 'aguardando_carregamento'
    }).select().single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, carga }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
