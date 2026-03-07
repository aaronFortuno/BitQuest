# UPDATE-PLAN.md - Pla de finalitzacio de BitQuest

## Estat actual

El projecte te totes les 10 fases implementades (backend + frontend) sobre Next.js 14 amb **in-memory store** (sense base de dades). La sincronitzacio funciona via HTTP polling cada 2s. Hi ha ~20.000 linies de TypeScript funcionals.

### Migració completada: PostgreSQL/Prisma -> In-Memory Store

- **Data**: 2026-03-07
- **Fitxer creat**: `nextjs_space/lib/store.ts` — Store in-memory amb Map<string, RoomState>
- **Fitxers migrats**: 20 rutes API a `nextjs_space/app/api/`
- **Fitxers eliminats**: `prisma/schema.prisma`, `lib/db.ts`, `.env`
- **Dependencies eliminades**: `prisma`, `@prisma/client`, `@next-auth/prisma-adapter`
- Totes les dades són efímeres i es destrueixen quan el servidor es reinicia (disseny original per a sessions educatives)

### Resum per fase

| Fase | Backend | Frontend | Estat |
|------|---------|----------|-------|
| 0 - Doble pagament | OK | OK | Complet |
| 1 - Banc central | OK | OK | Complet |
| 2 - Consens distribuit | OK | OK | Complet |
| 3 - Signatures digitals | OK | OK | Complet |
| 4 - UTXO | OK | OK | Complet |
| 5 - Xarxa i Mempool | OK | OK | Complet |
| 6 - Proof of Work | OK | OK | Complet |
| 7 - Ajust dificultat | OK (integrat a fase 6) | Sense UI propia | Parcial |
| 8 - Incentius economics | OK | OK | Complet |
| 9 - Simulacio lliure | OK | OK | Complet |

---

## Tasques pendents per finalitzar el projecte

### 1. ARQUITECTURA: Separar frontend i backend per a GitHub Pages + Render

**Prioritat: ALTA**

L'arquitectura actual (Next.js monolitic) no es compatible amb GitHub Pages. Cal separar:

- [ ] **1.1** Crear servidor Express + Socket.io independent (`server/`)
  - Migrar totes les API Routes de `app/api/` a endpoints Express
  - Configurar CORS per permetre peticions des de GitHub Pages
  - Usar in-memory store (ja migrat, sense BD)
  - Configurar Socket.io per a comunicacio en temps real

- [ ] **1.2** Convertir el frontend a SPA exportable (`client/`)
  - Usar Vite + React (o Next.js amb `output: 'export'`)
  - Configurar variable d'entorn `VITE_API_URL` per apuntar al servidor
  - Adaptar totes les crides `fetch('/api/...')` per usar la URL del servidor
  - Configurar GitHub Pages amb SPA fallback (404.html -> index.html)

- [ ] **1.3** Configurar desplegament
  - GitHub Pages: deploy automatic via GitHub Actions (build + push a `gh-pages`)
  - Render.com: deploy automatic des de la branca `main` (carpeta `server/`)
  - Variable d'entorn `CORS_ORIGIN` al servidor (URL de GitHub Pages)
  - No cal `DATABASE_URL` (in-memory store)

### 2. COMUNICACIO EN TEMPS REAL: Socket.io

**Prioritat: ALTA** — **COMPLETAT** (2026-03-07)

- [x] **2.1** Servidor custom amb Socket.io (`server.ts`)
  - Custom HTTP server amb Next.js + Socket.io integrats
  - Events: `join-room`, `leave-room` (Socket.io rooms per sala)
  - Broadcast `room:update` des de totes les API routes amb mutacions
  - Helper `lib/io.ts` amb `broadcastRoomUpdate(roomCode)`

- [x] **2.2** Client Socket.io + fallback polling
  - `lib/socket.ts` actualitzat amb `joinRoom`, `leaveRoom`, `onRoomUpdate`
  - `use-room-polling.ts` escolta `room:update` per refetch immediat
  - Polling reduït a 5s (fallback) — era 2s
  - Mining polling reduït a 2s (fallback) — era 1s

### 3. FASE 7: UI independent per a l'ajust de dificultat

**Prioritat: MITJANA**

La logica de l'ajust de dificultat existeix al backend pero esta integrada dins la UI de la fase 6. Cal una interficie dedicada.

- [ ] **3.1** Crear `phase7-user-interface.tsx`
  - Grafic de dificultat vs temps (Chart.js o Recharts)
  - Visualitzacio de periodes d'ajust (cada N blocs)
  - Comparativa temps real vs temps objectiu per bloc
  - Indicador de tendencia (dificultat pujant/baixant/estable)
  - Explicacio pedagogica del mecanisme d'ajust

- [ ] **3.2** Integrar a la pagina de sala
  - Afegir import a `room/[code]/page.tsx`
  - Afegir cas al switch de fases
  - Controls al teacher-dashboard per a parametres de dificultat

### 4. TESTING I QUALITAT

**Prioritat: MITJANA**

No hi ha tests al projecte.

- [ ] **4.1** Tests unitaris basics
  - Logica de criptografia (hash, signatures)
  - Validacio de transaccions
  - Calcul UTXO
  - Logica de dificultat i halving

- [ ] **4.2** Test d'integracio
  - Flux complet: crear sala -> unir-se -> enviar transaccio -> minar bloc
  - Provar cada fase amb 2-3 participants simulats

### 5. NETEJA DE DEPENDECIES

**Prioritat: BAIXA**

El `package.json` te ~130 dependencies, moltes no usades (AWS SDK, mapbox, next-auth, gray-matter, csv...).

- [ ] **5.1** Auditar i eliminar dependencies no usades
  - Eliminar: `@aws-sdk/*`, `mapbox-gl`, `next-auth`, `gray-matter`, `csv`, `react-datepicker`, `react-day-picker`, `swr` (usa tanstack query), `formik` (usa react-hook-form)
  - ~~Eliminar `@next-auth/*`, `prisma`, `@prisma/client`~~ **COMPLETAT** (2026-03-07)
  - Consolidar: triar entre `date-fns` i `dayjs` (mantenir un)
  - Consolidar: triar entre `recharts` i `chart.js` (mantenir un)

- [ ] **5.2** Actualitzar dependencies crítiques
  - Next.js 14.2 -> revisar si cal actualitzar

### 6. MILLORES UX/UI

**Prioritat: BAIXA**

- [ ] **6.1** Responsivitat mobil
  - Adaptar components per a tablets (us habitual a aules)
  - Testejar en pantalles 768px-1024px

- [ ] **6.2** Explorador de blockchain
  - Vista visual de la cadena de blocs completa
  - Clicar un bloc per veure detalls (transaccions, hash, nonce...)

- [ ] **6.3** Feedback pedagogic millorat
  - Missatges explicatius quan es completen accions clau
  - Connexio explícita entre cada fase i Bitcoin real

### 7. DOCUMENTACIO

**Prioritat: BAIXA**

- [ ] **7.1** Guia del professor
  - Com iniciar una sessio
  - Explicacions per fase amb preguntes guiades
  - Timing recomanat per fase

- [ ] **7.2** Guia tecnica de desplegament
  - Pas a pas per configurar GitHub Pages + Render.com
  - Variables d'entorn necessaries
  - Troubleshooting comu

---

## Ordre d'execucio recomanat

```
Fase 1: Separar frontend/backend (tasca 1)
   └─> Permet desplegar a GitHub Pages + Render

Fase 2: Activar Socket.io (tasca 2)
   └─> Millora drastica de l'experiencia en temps real

Fase 3: UI Fase 7 + Tests (tasques 3, 4)
   └─> Completa la funcionalitat i assegura qualitat

Fase 4: Neteja + Millores + Docs (tasques 5, 6, 7)
   └─> Polish final
```

## Decisio arquitectonica clau: Separar o no?

### Opcio A: Separar (GitHub Pages + Render) - RECOMANADA
- **Pro**: Frontend gratuit a GitHub Pages, servidor lleuger a Render
- **Pro**: Escalabilitat independent
- **Contra**: Mes feina inicial de refactoring
- **Contra**: CORS i configuracio addicional

### Opcio B: Mantenir monolitic (Next.js a Render)
- **Pro**: Zero refactoring, deploy directe
- **Pro**: Mes simple de mantenir
- **Contra**: Tot el cost al servidor (Render free tier: spin-down 15min)
- **Contra**: Spin-down afecta tant frontend com backend

### Opcio C: Hibrida (Next.js static export + API externa)
- **Pro**: Menys refactoring que Opcio A
- **Pro**: Next.js `output: 'export'` genera HTML estatic
- **Contra**: Perd funcionalitats server-side de Next.js (API routes, SSR)
- **Contra**: Igualment cal servidor extern per API + BD

**Recomanacio**: Per a us educatiu amb pressupost zero, l'**Opcio B** (deploy monolitic a Render) es la mes pragmatica. El spin-down de 15min es acceptable si el professor obre l'app uns minuts abans de la classe. L'**Opcio A** nomes val la pena si el spin-down es un problema real.
