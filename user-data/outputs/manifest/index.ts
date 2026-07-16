// =========================================================
// REDE BENEDETTI - Edge Function: manifest (COM CORS)
// Gera um manifest.json personalizado com o nome da pessoa,
// pra cada motorista/gerente poder ter um APK com nome próprio
// no ícone do celular (ex: "João - Rede Benedetti").
//
// Uso: /functions/v1/manifest?papel=motorista&nome=João&apikey=SUA_ANON_KEY
// =========================================================
// Deploy: supabase functions deploy manifest --no-verify-jwt

const SITE_URL = 'https://evertonpereirakunitake-commits.github.io/rede-benedetti/app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/manifest+json'
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const papel = url.searchParams.get('papel') === 'gerente' ? 'gerente' : 'motorista';
  const nomeBruto = (url.searchParams.get('nome') || '').trim();
  const nome = nomeBruto.slice(0, 40) || (papel === 'gerente' ? 'Gerente' : 'Motorista');
  const primeiroNome = nome.split(' ')[0].slice(0, 12);

  const paginaInicial = papel === 'gerente' ? 'gerente-app.html' : 'motorista-app.html';
  const icone = papel === 'gerente' ? 'icon-gerente' : 'icon-motorista';

  const manifest = {
    name: `${nome} — Rede Benedetti`,
    short_name: primeiroNome,
    description: papel === 'gerente'
      ? 'Acompanhe as cargas a caminho do seu posto.'
      : 'Veja suas cargas, inicie a viagem e confirme a entrega.',
    start_url: `${SITE_URL}/${paginaInicial}?nome=${encodeURIComponent(nome)}`,
    scope: `${SITE_URL}/`,
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
    icons: [
      { src: `${SITE_URL}/icons/${icone}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `${SITE_URL}/icons/${icone}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };

  return new Response(JSON.stringify(manifest), { status: 200, headers: corsHeaders });
});
