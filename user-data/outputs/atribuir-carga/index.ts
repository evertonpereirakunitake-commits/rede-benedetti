// =========================================================
// REDE BENEDETTI - Edge Function: atribuir-carga (COM CORS)
// Lança uma carga pra um motorista, opcionalmente vinculada a
// um contrato de usina (aí a saída abate do saldo do contrato).
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

const VOLUME_MAXIMO_L = 80000; // acima disso é erro de digitação, nenhum caminhão leva

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      posto_id, posto_nome, motorista_id,
      combustivel, volume_total, numero_nota_fiscal, contrato_id,
      local_carregamento
    } = body;

    if (!posto_id || !motorista_id || !combustivel || !volume_total) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), { status: 400, headers: corsHeaders });
    }
    if (!local_carregamento || !String(local_carregamento).trim()) {
      return new Response(JSON.stringify({ error: 'Informe onde o motorista vai carregar (endereço da usina ou local de retirada)' }), { status: 400, headers: corsHeaders });
    }

    const volume = Number(volume_total);
    if (!isFinite(volume) || volume <= 0) {
      return new Response(JSON.stringify({ error: 'Volume precisa ser um número maior que zero' }), { status: 400, headers: corsHeaders });
    }
    if (volume > VOLUME_MAXIMO_L) {
      return new Response(JSON.stringify({ error: `Volume acima do limite de ${VOLUME_MAXIMO_L.toLocaleString('pt-BR')} L — confira a digitação` }), { status: 400, headers: corsHeaders });
    }

    const { data: motorista, error: motErr } = await sb
      .from('motoristas')
      .select('nome, telefone, placa_padrao')
      .eq('id', motorista_id)
      .single();

    if (motErr || !motorista) {
      return new Response(JSON.stringify({ error: 'Motorista não encontrado' }), { status: 404, headers: corsHeaders });
    }

    // Se veio contrato de usina: validar combustível, situação e saldo
    if (contrato_id) {
      const { data: contrato } = await sb
        .from('contratos_combustivel')
        .select('id, combustivel, volume_contratado, ativo')
        .eq('id', contrato_id)
        .single();

      if (!contrato) {
        return new Response(JSON.stringify({ error: 'Contrato de usina não encontrado' }), { status: 400, headers: corsHeaders });
      }
      if (!contrato.ativo) {
        return new Response(JSON.stringify({ error: 'Este contrato já foi encerrado' }), { status: 400, headers: corsHeaders });
      }
      if (contrato.combustivel !== combustivel) {
        return new Response(JSON.stringify({ error: `O contrato selecionado é de ${contrato.combustivel}, não de ${combustivel}` }), { status: 400, headers: corsHeaders });
      }

      const { data: usadas } = await sb
        .from('cargas_transporte')
        .select('volume_total')
        .eq('contrato_id', contrato_id)
        .neq('status', 'cancelada');
      const retirado = (usadas || []).reduce((s: number, c: any) => s + Number(c.volume_total || 0), 0);
      const saldo = Number(contrato.volume_contratado) - retirado;

      if (volume > saldo) {
        return new Response(JSON.stringify({
          error: `Saldo insuficiente no contrato: restam ${saldo.toLocaleString('pt-BR')} L e a carga é de ${volume.toLocaleString('pt-BR')} L`
        }), { status: 400, headers: corsHeaders });
      }
    }

    const { data: carga, error } = await sb.from('cargas_transporte').insert({
      posto_id,
      posto_nome,
      motorista_id,
      motorista_nome: motorista.nome,
      motorista_telefone: motorista.telefone,
      motorista_placa: motorista.placa_padrao,
      combustivel,
      volume_total: volume,
      numero_nota_fiscal: numero_nota_fiscal || null,
      contrato_id: contrato_id || null,
      local_carregamento: String(local_carregamento).trim(),
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
