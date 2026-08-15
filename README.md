# HOUSE GESTÃO

## Módulo de CMV

O sistema calcula o CMV semanal sempre de domingo a sábado. O faturamento do período é obtido dos lançamentos diários sincronizados com a Takeat e os custos são lançados em quatro grupos: matéria-prima, central de produção, bebidas e embalagens.

- Cada conferência fica em `cmvEntries/{unitId}_{weekStart}` e pode ser reaberta e editada.
- O percentual é `custos totais / faturamento Takeat × 100`; registros sem faturamento não podem ser salvos.
- O consolidado mensal soma custos e faturamentos das semanas cuja data de encerramento (sábado) pertence ao mês selecionado, evitando que uma semana seja contada duas vezes.
- Quando as vendas do período estão carregadas, a tela recalcula o denominador com os dados Takeat mais recentes; o valor salvo permanece como fotografia de auditoria.
- Metas, canais, bônus, limite de CMV e metas diárias são persistidos em `goals/{unitId}` e só podem ser alterados por administradores.
- A House IA recebe os números já calculados, identifica o maior grupo de custo e devolve diagnóstico, alerta e três ações operacionais.

Central de Metas e Performance para acompanhamento diário das unidades House190 e House Food Park.

## O que está pronto

- dashboard mobile first com modo claro, escuro e automático;
- três unidades iniciais com metas independentes;
- trajetória esperada baseada na meta de cada dia da semana;
- faturamento, gap, projeção, médias, tendência e saúde da meta calculados em código;
- lançamento diário com máscara monetária e validação de subdivisões;
- histórico por período e gráficos responsivos;
- painel administrativo comparativo;
- bonificação com CMV, freelancers e mínimo de categorias;
- House IA com prompt fixo e resposta estruturada;
- integração segura com a API Takeat por unidade, com sincronização automática de Salão, Delivery e iFood;
- Firebase Authentication e regras Firestore por função/unidade;
- PWA instalável;
- modo demonstração quando as variáveis do Firebase ainda não foram configuradas.

## Stack

- React 19 + TypeScript + Vinext/Next API
- Firebase Authentication e Cloud Firestore
- Firebase Functions para chamada segura da Groq
- CSS moderno, Lucide Icons e gráficos SVG leves

## Configuração

1. Copie `.env.example` para `.env.local`.
2. Crie um projeto no Firebase e habilite Authentication por e-mail/senha.
3. Crie o banco Cloud Firestore e publique `firestore.rules` e `firestore.indexes.json`.
4. Preencha as variáveis `NEXT_PUBLIC_FIREBASE_*`.
5. Cadastre os documentos dos usuários em `/users/{uid}`:

```json
{ "name": "Nome do gerente", "role": "manager", "unitId": "house190-teixeira" }
```

Para administrador:

```json
{ "name": "Administrador", "role": "admin" }
```

6. Cadastre a chave da Groq como segredo, nunca no frontend:

```bash
firebase functions:secrets:set GROQ_API_KEY
```

## Desenvolvimento

```bash
npm install
npm run dev
```

## Validação

```bash
npm run build
npm test
```

## Deploy

O frontend também está preparado para hospedagem gratuita no GitHub Pages:

```bash
npm run build:github
```

Endereço principal: `https://houseburgertx-beep.github.io/METAS/`

O projeto inclui estes caminhos:

- frontend estático no GitHub Pages;
- Firebase Hosting/Cloud Run com `firebase.json`, mais a função segura `analyzePerformance`.

O Firebase Authentication e o Firestore podem ser acessados pelo frontend hospedado no GitHub Pages. A `GROQ_API_KEY` nunca deve ser colocada no site estático: a análise real deve chamar a função segura incluída em `functions/src/index.js`.

Instale também as dependências da função antes do deploy Firebase:

```bash
cd functions
npm install
cd ..
firebase deploy
```

## Coleções esperadas

- `/users`
- `/units`
- `/goals`
- `/dailySales`
- `/monthlyPerformance`
- `/aiAnalyses`
- `/settings`

As subdivisões de Delivery e iFood são apenas analíticas. Os cálculos de faturamento somam exclusivamente `salao + delivery + ifood`.

## Segurança

- `GROQ_API_KEY` é lida apenas no backend;
- as regras do Firestore verificam `role` e `unitId` no servidor;
- gerentes não podem consultar documentos de outras unidades;
- alterações administrativas exigem `role: admin`;
- `.env*` com valores reais não deve ser versionado.

## Integração Takeat

O Cloudflare Worker autentica cada unidade separadamente, consulta `GET /table-sessions` no período diário de Brasília e devolve somente os totais consolidados. O frontend envia o token do Firebase; o Worker valida a assinatura e confere `role`/`unitId` no Firestore antes de consultar a Takeat.

Cadastre no Cloudflare, em **Configurações → Variáveis e segredos**, as seis credenciais dos usuários exclusivos criados na Área do Gestor da Takeat:

```text
TAKEAT_HOUSE190_TEIXEIRA_EMAIL
TAKEAT_HOUSE190_TEIXEIRA_PASSWORD
TAKEAT_HOUSE190_EUNAPOLIS_EMAIL
TAKEAT_HOUSE190_EUNAPOLIS_PASSWORD
TAKEAT_HOUSE_FOOD_PARK_EMAIL
TAKEAT_HOUSE_FOOD_PARK_PASSWORD
```

Marque as senhas como segredo criptografado. Não salve valores reais no repositório. O sistema usa `total_price`, que já considera descontos e não inclui taxa de serviço, ignora sessões não concluídas/canceladas e não soma subdivisões novamente.

Por padrão, canal contendo `ifood` é iFood; sessões com `is_delivery`, retirada ou canal de entrega são Delivery; o restante é Salão. Após a primeira sincronização, confira `sourceSummary.channels` no lançamento salvo. Se a operação retornar nomes próprios diferentes, cadastre `TAKEAT_CHANNEL_MAP_JSON` como segredo com o mapeamento por unidade.
