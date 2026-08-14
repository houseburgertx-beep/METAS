# HOUSE GESTÃO

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

O projeto inclui dois caminhos:

- deploy da aplicação full-stack pelo ambiente de Sites já configurado;
- Firebase Hosting/Cloud Run com `firebase.json`, mais a função segura `analyzePerformance`.

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
