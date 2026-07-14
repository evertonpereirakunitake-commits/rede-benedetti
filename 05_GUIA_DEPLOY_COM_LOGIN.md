# Guia de Deploy — Sistema de Cargas com Login (sem custo)

## Arquivos e ordem de execução

### 1) SQL (rode no Supabase SQL Editor, nesta ordem)
0. `00_criar_tabela_postos.sql` (só necessário em projeto novo, sem a tabela `postos` ainda)
1. `01_criar_tabela_cargas_transporte.sql`
2. `04_motoristas_e_atribuicao.sql`
3. `06_postos_publico.sql` (view pública de postos, usada pelo app)
4. `07_login_gerente_por_cnpj.sql` (login do gerente passa a ser pelo CNPJ do posto, não pelo telefone dele)

⚠️ **Não rode** `02_whatsapp_gerentes_e_trigger.sql` nem faça deploy da function `enviar-whatsapp-carga` — isso é só se decidir usar WhatsApp pago no futuro. Por enquanto fica de fora.

### 2) Cadastrar postos, motoristas e gerentes
Depois que a function `cadastro` estiver no ar (passo 4), o cadastro é feito por 3 telas diferentes:

- **`app/cadastro.html`** — só a matriz usa, pra cadastrar um posto novo (nome + CNPJ + lat/lng)
- **`app/cadastro_motorista.html`** — envie esse link pra cada motorista novo; ele mesmo cria seu acesso (nome, telefone, PIN, placa)
- **`app/cadastro_gerente.html`** — envie esse link pro gerente de cada posto; ele cria o acesso usando o **CNPJ do posto** (não o telefone dele) + um PIN. Assim, se o gerente trocar, o acesso do posto continua o mesmo — só recadastra com o CNPJ de novo.

Se preferir fazer pelo SQL Editor (ou antes de ter as functions no ar):
```sql
-- Um posto por linha:
SELECT cadastrar_posto('Posto Marília', '12345678000199', -22.2171, -49.9500);

-- Um motorista por linha:
SELECT cadastrar_motorista('João Silva', '5514999990001', '1234', 'ABC1D23');

-- Um gerente por posto (usa o CNPJ do posto, não o posto_id):
SELECT cadastrar_gerente('12345678000199', 'Nome do Gerente', '4321', '5514999991111');
```

O telefone é só números com DDI+DDD (ex: `5514999990001`). O CNPJ é só números, sem ponto/traço (ex: `12345678000199`). O PIN são 4 dígitos que a pessoa vai digitar no login.

### 3) Edge Functions — instalar CLI e configurar (uma vez só)
```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
```
Não precisa configurar nenhum secret: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente pelo Supabase dentro das Edge Functions (e são nomes reservados — se tentar `supabase secrets set SUPABASE_URL=...` dá erro).

### 4) Deploy das 5 functions
```bash
supabase functions deploy login --no-verify-jwt
supabase functions deploy atribuir-carga --no-verify-jwt
supabase functions deploy minhas-cargas --no-verify-jwt
supabase functions deploy dashboard --no-verify-jwt
supabase functions deploy cadastro --no-verify-jwt
```

### 5) Ajustar o app
Os arquivos do app ficam na pasta `app/`. Edite **um único arquivo**, `app/assets/config.js`:
```js
const BENEDETTI_CONFIG = {
  SUPABASE_URL: "https://SEU_PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "SUA_ANON_KEY_AQUI"
};
```
Todas as telas (`login.html`, `motorista.html`, `painel_gerente.html`, `atribuir_carga.html`) importam esse arquivo, então só precisa trocar em um lugar.

### 6) Subir pro GitHub Pages
Suba o conteúdo da pasta `app/` (incluindo `assets/`, `icons/`, `manifest.json`, `sw.js`) pro repositório do GitHub Pages. Estrutura de acesso:
- **Você (matriz):** `app/atribuir_carga.html` — lança a carga
- **Motorista:** `app/login.html?tipo=motorista` → depois de logar vai pra `motorista.html`
- **Gerente:** `app/login.html?tipo=gerente` → depois de logar vai pra `painel_gerente.html`
- **Dashboard (matriz):** `app/dashboard.html` — visão geral de toda a rede: KPIs, mapa com todos os caminhões em trânsito, gráfico de entregas dos últimos 7 dias, volume por combustível, cargas ativas por posto e tabela completa
- **Cadastrar posto (matriz):** `app/cadastro.html`
- **Link pra enviar aos motoristas:** `app/cadastro_motorista.html`
- **Link pra enviar aos gerentes:** `app/cadastro_gerente.html`
- **Menu geral:** `app/index.html` — tela inicial com todos os acessos

Dica: salve esses links como favoritos/atalho na tela inicial do celular de cada motorista e gerente. O app tem `manifest.json` + service worker, então o navegador vai oferecer "Adicionar à tela inicial" — abre em tela cheia, como um app nativo.

## Fluxo completo depois de tudo no ar
1. Você abre `atribuir_carga.html`, escolhe motorista + posto + carga → salva
2. Motorista abre `motorista.html` (ou faz login), vê a carga "aguardando carregamento"
3. Motorista vai carregar o caminhão, volta e aperta "Carreguei, iniciar viagem" → GPS liga
4. Gerente vê no painel (`painel_gerente.html`) a carga em trânsito, mapa ao vivo, ETA
5. Se tiver notificação ativada no navegador, recebe aviso na hora da atribuição e quando o motorista confirma a saída
6. Motorista chega, aperta "Entreguei" → carga sai da lista de ambos

## Zero custo — confirmação
- Supabase: plano free cobre folgado 9 postos + poucos motoristas
- Notificação: API nativa do navegador, gratuita
- Mapa: Leaflet + OpenStreetMap, gratuito
- Nenhuma chamada a serviço pago em nenhuma parte deste fluxo

## Pontos de atenção
- A tela `atribuir_carga.html` e o `painel_gerente.html` leem os postos pela view `postos_publico` (criada em `06_postos_publico.sql`), não pela tabela `postos` direto — assim funciona mesmo com RLS bloqueando leitura anônima na tabela original
- Notificação do gerente só funciona com a aba do painel aberta (combinado anteriormente)
- PIN fica em hash no banco (bcrypt via pgcrypto) — mesmo alguém acessando o banco direto não vê o PIN em texto puro
- Login do gerente é pelo **CNPJ do posto + PIN** (não pelo telefone do gerente) — o CNPJ é fixo, então trocar de gerente não derruba o acesso do posto; basta o novo gerente se cadastrar de novo com o mesmo CNPJ (se o posto já tiver gerente cadastrado, o autocadastro novo dá erro — quem cadastrou antes precisa ser removido no SQL Editor primeiro: `DELETE FROM gerentes WHERE posto_id = '...'`)
- A "sessão" do motorista/gerente é salva no localStorage do navegador dele — se usar o celular de outra pessoa, tem que sair e logar de novo
- Se algum posto ainda não tem lat/lng cadastrado, o cálculo de distância/ETA fica em branco (não trava o sistema, só não mostra a previsão)
