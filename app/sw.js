// Service worker simples: só dá pro app abrir com o ícone na tela inicial
// e reaproveitar o shell básico. Dados sempre vêm da rede (nunca cacheados).
const CACHE = "benedetti-shell-v1";
const SHELL = [
  "index.html",
  "login.html",
  "motorista.html",
  "painel_gerente.html",
  "atribuir_carga.html",
  "dashboard.html",
  "cadastro.html",
  "cadastro_motorista.html",
  "cadastro_gerente.html",
  "assets/style.css",
  "assets/dashboard.css",
  "assets/config.js",
  "assets/app-common.js",
  "assets/charts.js",
  "icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Nunca cachear chamadas de API/Supabase - só o shell estático do mesmo site
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
