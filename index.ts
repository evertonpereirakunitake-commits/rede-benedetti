// =========================================================
// REDE BENEDETTI - Edge Function: login (COM CORS)
// Autentica motorista OU gerente por telefone + PIN
// =========================================================
// Deploy: supabase functions deploy login --no-verify-jwt

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
  // Requisição de verificação do navegador (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tipo, identificador, pin } = await req.json();

    if (!['motorista', 'gerente'].includes(tipo)) {
      return new Response(JSON.stringify({ error: 'Tipo inválido' }), { status: 400, headers: corsHeaders });
    }

    const tabela = tipo === 'motorista' ? 'motoristas' : 'gerentes';

    // Motorista loga com telefone, gerente loga com o CNPJ do posto
    const { data, error } = await sb.rpc('verificar_login', {
      p_tabela: tabela,
      p_identificador: identificador,
      p_pin: pin
    });

    if (error || !data || data.length === 0) {
      const msg = tipo === 'motorista' ? 'Telefone ou PIN incorretos' : 'CNPJ ou PIN incorretos';
      return new Response(JSON.stringify({ error: msg }), { status: 401, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, usuario: data[0] }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
