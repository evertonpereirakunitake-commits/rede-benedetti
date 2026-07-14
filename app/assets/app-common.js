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
  entregue: "Entregue",
  cancelada: "Cancelada"
};

const STATUS_CLASS = {
  aguardando_carregamento: "status-aguardando",
  em_transito: "status-transito",
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
