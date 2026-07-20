// Funções compartilhadas por todas as telas do app Rede Benedetti - Cargas

const SESSION_KEY = "benedetti_session";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function setSession(sessao) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Garante que existe sessão do tipo esperado ("motorista" ou "gerente").
// Se não existir, redireciona pro login e retorna null.
function requireSession(tipoEsperado) {
  const sessao = getSession();
  if (!sessao || sessao.tipo !== tipoEsperado) {
    window.location.href = `login.html?tipo=${tipoEsperado}`;
    return null;
  }
  return sessao;
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

// Chama uma Edge Function do Supabase (login, atribuir-carga, minhas-cargas)
async function callFunction(nome, body) {
  const resp = await fetch(`${BENEDETTI_CONFIG.SUPABASE_URL}/functions/v1/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": BENEDETTI_CONFIG.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${BENEDETTI_CONFIG.SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    throw new Error(data.error || "Erro na requisição");
  }
  return data;
}

// Cliente supabase-js para leituras diretas (views públicas: motoristas_publico, postos_publico)
function getSupabaseClient() {
  return supabase.createClient(BENEDETTI_CONFIG.SUPABASE_URL, BENEDETTI_CONFIG.SUPABASE_ANON_KEY);
}

const STATUS_LABEL = {
  aguardando_carregamento: "Aguardando carregamento",
  em_transito: "Em trânsito",
  aguardando_conferencia: "Aguardando conferência",
  entregue: "Entregue",
  cancelada: "Cancelada"
};

const STATUS_CLASS = {
  aguardando_carregamento: "status-aguardando",
  em_transito: "status-transito",
  aguardando_conferencia: "status-conferencia",
  entregue: "status-entregue",
  cancelada: "status-cancelada"
};

function statusLabel(status) {
  return STATUS_LABEL[status] || status;
}

function statusClass(status) {
  return STATUS_CLASS[status] || "";
}

function pedirNotificacao() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function notificar(titulo, corpo) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(titulo, { body: corpo, icon: "icons/icon.svg" });
  }
}

// ---------- Alerta sonoro (bipe sintetizado, sem precisar de arquivo de áudio) ----------
// Navegadores só deixam tocar som depois de o usuário interagir com a página
// (tocar na tela, clicar em algo). Por isso "destravamos" no primeiro toque.
let __audioCtx = null;

function __destravarAudio() {
  if (!__audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) __audioCtx = new AC();
  }
  if (__audioCtx && __audioCtx.state === "suspended") {
    __audioCtx.resume().catch(() => {});
  }
}
document.addEventListener("click", __destravarAudio);
document.addEventListener("touchstart", __destravarAudio);

// Toca um sinal sonoro de "novo aviso": um acorde ascendente de 4 notas
// (mais cheio e chamativo que um bipe simples) + um leve "thump" grave no
// início pra ter presença mesmo no alto-falante pequeno do celular. Chame
// sempre que uma carga nova chegar pro motorista, ou o status mudar pro
// gerente.
function tocarAlerta() {
  try {
    if (!__audioCtx) return;
    const ctx = __audioCtx;
    const t0 = ctx.currentTime;

    // thump grave curto - dá "peso" ao início do sinal
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(180, t0);
    thump.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
    thumpGain.gain.setValueAtTime(0.0001, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(t0);
    thump.stop(t0 + 0.16);

    // acorde ascendente (Mi-Sol#-Si-Mi oitava acima) - som "positivo",
    // tipo confirmação de pedido novo
    const notas = [659.25, 830.61, 987.77, 1318.51];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const inicio = t0 + 0.05 + i * 0.11;
      const pico = i === notas.length - 1 ? 0.42 : 0.34;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(pico, inicio + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.45);
    });
  } catch {
    // navegador sem suporte a Web Audio - ignora silenciosamente
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
