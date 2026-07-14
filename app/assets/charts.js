// Gráficos leves em SVG puro (sem biblioteca externa) para a dashboard.
// Lêem as cores do tema (CSS variables) pra acompanhar modo claro/escuro.

function cssVar(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

const PALETA = ["#f97316", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6"];

function corDaPaleta(indice) {
  return PALETA[indice % PALETA.length];
}

// data: [{ label, value }]
function desenharBarras(container, data, opts = {}) {
  const largura = container.clientWidth || 320;
  const altura = opts.altura || 200;
  const corBarra = opts.cor || cssVar("--primary");
  const corTexto = cssVar("--text");
  const corTextoFraco = cssVar("--text-dim");
  const max = Math.max(1, ...data.map((d) => d.value));
  const areaGrafico = altura - 34;
  const larguraBarra = largura / data.length;

  let svg = "";
  data.forEach((d, i) => {
    const alturaBarra = max > 0 ? (d.value / max) * areaGrafico : 0;
    const x = i * larguraBarra + larguraBarra * 0.22;
    const bw = larguraBarra * 0.56;
    const y = areaGrafico - alturaBarra + 14;
    const valorFormatado = opts.formatarValor ? opts.formatarValor(d.value) : d.value;

    svg += `
      <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(alturaBarra, 1)}" rx="5" fill="${corBarra}"></rect>
      <text x="${x + bw / 2}" y="${y - 6}" font-size="11" fill="${corTexto}" text-anchor="middle">${valorFormatado}</text>
      <text x="${x + bw / 2}" y="${altura - 6}" font-size="10" fill="${corTextoFraco}" text-anchor="middle">${d.label}</text>
    `;
  });

  container.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
}

// data: [{ label, value }]
function desenharDonut(container, data, opts = {}) {
  const tamanho = opts.tamanho || 170;
  const raio = tamanho / 2 - 6;
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let acumulado = 0;
  let fatias = "";
  data.forEach((d, i) => {
    const fracao = d.value / total;
    const anguloIni = acumulado * 2 * Math.PI;
    acumulado += fracao;
    const anguloFim = acumulado * 2 * Math.PI;
    const x1 = cx + raio * Math.sin(anguloIni);
    const y1 = cy - raio * Math.cos(anguloIni);
    const x2 = cx + raio * Math.sin(anguloFim);
    const y2 = cy - raio * Math.cos(anguloFim);
    const grandeArco = fracao > 0.5 ? 1 : 0;
    const cor = corDaPaleta(i);
    if (fracao > 0) {
      fatias += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${raio},${raio} 0 ${grandeArco} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${cor}"></path>`;
    }
  });

  const legenda = data.map((d, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${corDaPaleta(i)}"></span>
      ${d.label}
      <b>${opts.formatarValor ? opts.formatarValor(d.value) : d.value}</b>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="donut-wrap">
      <svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}">
        ${fatias}
        <circle cx="${cx}" cy="${cy}" r="${raio * 0.58}" fill="${cssVar("--bg-card")}"></circle>
      </svg>
      <div class="legend">${legenda}</div>
    </div>
  `;
}

// data: [{ label, value }] - barras horizontais (bom pra "por posto")
function desenharBarrasHorizontais(container, data, opts = {}) {
  if (data.length === 0) {
    container.innerHTML = '<p class="empty-state">Sem dados no momento.</p>';
    return;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  container.innerHTML = data.map((d, i) => `
    <div class="hbar-row">
      <div class="hbar-label">${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${(d.value / max) * 100}%; background:${corDaPaleta(i)}"></div>
      </div>
      <div class="hbar-value">${d.value}</div>
    </div>
  `).join("");
}
