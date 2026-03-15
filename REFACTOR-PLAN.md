# BitQuest — Pla Mestre de Refactorització i Optimització

**Data:** 2026-03-15
**Branca:** `refactor-unstable`
**Estat:** Totes les decisions resoltes. Pla executable per agents autònoms.
**Documents relacionats:** `DECISIONS.md` (registre complet de decisions amb justificacions)

---

## Diagnòstic: Xifres reals (31.539 línies totals)

| Mètrica | Valor | Problemàtica |
|---------|-------|-------------|
| `teacher-dashboard.tsx` | 2.625 línies | Monòlit inmantenible, 59 props |
| `use-room-polling.ts` | 1.835 línies | Hook "god object" amb 42+ fetch calls |
| `i18n.ts` | 3.002 línies | Fitxer únic amb 3 idiomes hardcoded en TS |
| `blocks/route.ts` | 1.279 línies | 11 accions en un sol POST handler |
| `version-footer.tsx` | 1.093 línies | Changelog hardcoded al component |
| `store.ts` | 1.012 línies | Store monolític, 50+ funcions |
| Components de fase (×9) | 326–800 línies/u | 8 patrons duplicats entre ells |
| Panells suport (×4) | 558–857 línies/u | Lògica acoblada |
| Components UI Shadcn | 55 fitxers | ~12 no utilitzats |
| Hooks duplicats | `use-toast.ts` × 2 | Còpia exacta en 2 ubicacions |
| Socket.io | `server.ts` + `io.ts` + `socket.ts` | Desactivat al client, broadcast sense receptor |

---

## Principis

1. **Zero regressió funcional** — Tests primer, refactor després.
2. **Incremental** — Cada commit compila i passa tests.
3. **De dins cap a fora** — Primer utils/hooks, després components.
4. **Un fitxer, una responsabilitat** — Objectiu: cap fitxer > 300 línies.
5. **Commits atòmics** — Un commit per sub-tasca, missatge en català.
6. **Branques per fase** — `refactor/faseN-nom`, merge seqüencial a `refactor-unstable`.

---

## FASE 0: Infraestructura de Tests

**Agents:** 1 principal | **Risc:** Baix

### 0.1 — Configurar Vitest
- [ ] Instal·lar: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [ ] Crear `vitest.config.ts` amb alias `@/` → `./`
- [ ] Crear `test/setup.ts` amb providers globals (i18n mock, theme)
- [ ] Afegir script `"test": "vitest"` a `package.json`
- [ ] **NO instal·lar MSW** — mocks simples amb `vi.mock()` (decisió D3)

### 0.2 — Tests funcionals dels components actuals
- [ ] **NO fer snapshots** — tests funcionals que verifiquen elements clau (decisió D2)
- [ ] Per cada `phaseN-user-interface.tsx`: verificar que botons, títols i llistes es renderitzen
- [ ] Per `teacher-dashboard.tsx`: verificar que el selector de fase i controls bàsics existeixen
- [ ] Tests co-located: `phase1-user-interface.test.tsx` al costat del component (decisió D1)

### 0.3 — Tests unitaris de les utilitats existents
- [ ] `lib/crypto.ts` — hash, RSA key generation
- [ ] `lib/client-hash.ts` — SHA256 client-side
- [ ] `lib/room-utils.ts` — generateRoomCode, createCoinFile
- [ ] `lib/store.ts` — getRoom, addParticipant, createTransaction, etc.

### 0.4 — Documentació tècnica
- [ ] Crear `ARCHITECTURE.md` amb mapa de dependències i flux de dades
- [ ] Documentar cada endpoint API: verb, params, response shape

---

## FASE 1: Neteja — Eliminació de Codi Mort

**Agents:** 1-2 en paral·lel | **Risc:** Baix

### 1.1 — Eliminar Socket.io completament (decisió D4)
Ordre estricte:
1. [ ] Eliminar totes les crides a `broadcastRoomUpdate()` de les API routes
   - Fitxers afectats: totes les routes a `app/api/` que importen `io.ts`
   - Simplement eliminar la línia `broadcastRoomUpdate(roomCode)` i l'import
2. [ ] Eliminar `lib/io.ts`
3. [ ] Eliminar `lib/socket.ts`
4. [ ] Eliminar `server.ts`
5. [ ] Actualitzar `package.json` scripts:
   - `"dev"` → `"next dev"`
   - `"start"` → `"NODE_ENV=production next start"`
   - Eliminar dependència de `tsx` si ja no s'usa enlloc
6. [ ] Desinstal·lar `socket.io` i `socket.io-client`
7. [ ] Eliminar imports comentats de Socket.io a `use-room-polling.ts`
8. [ ] Verificar que `npm run dev` i `npm run build` funcionen

### 1.2 — Eliminar hook duplicat
- [ ] Eliminar `hooks/use-toast.ts` (duplicat exacte de `components/ui/use-toast.ts`)
- [ ] Grep d'imports: actualitzar qualsevol `from '@/hooks/use-toast'` → `from '@/components/ui/use-toast'`

### 1.3 — Eliminar components Shadcn no usats (decisió D6)
- [ ] Per cada candidat, fer grep d'imports a TOT el projecte (excloent el propi fitxer)
- [ ] Eliminar fitxers amb 0 imports
- [ ] Candidats: `date-range-picker`, `task-card`, `calendar`, `carousel`, `input-otp`, `resizable`, `menubar`, `context-menu`, `navigation-menu`, `breadcrumb`, `aspect-ratio`, `hover-card`
- [ ] Commit específic per aquesta neteja

### 1.4 — Eliminar codi comentat
- [ ] Escanejar tots els `.ts`/`.tsx` per blocs comentats > 3 línies
- [ ] Eliminar-los (git history els preserva)

### 1.5 — Verificació
- [ ] `npm run build` exitós
- [ ] `npm run dev` arrenca correctament
- [ ] Tests existents passen

---

## FASE 2: Utilitats i Components Compartits

**Agents:** 2 en paral·lel (Agent A: lib/utils, Agent B: components/ui) | **Risc:** Baix-Mig

### 2.1 — `lib/balance-utils.ts` + tests
```typescript
export function getBalance(coinFileJson: string, defaultBalance = 10): number
export function getParticipantBalance(participant: Participant): number
export function updateBalance(coinFileJson: string, delta: number): string
```
- [ ] Crear fitxer + `balance-utils.test.ts`
- [ ] Substituir implementacions locals a: `bank-interface`, `phase1-user-interface`, `phase2-user-interface`, `teacher-dashboard`, `phase4-utxo-panel`
- [ ] Substituir `updateCoinFileBalance()` duplicat a API routes (4 còpies)

### 2.2 — `lib/transaction-utils.ts` + tests
```typescript
export function getParticipantTransactions(txs: Transaction[], participantId: string): Transaction[]
export function filterByStatus(txs: Transaction[], status: TxStatus): Transaction[]
export function getPendingVotes(txs: Transaction[], participantId: string): Transaction[]
```
- [ ] Substituir lògica de filtratge a: phase1, phase2, phase4, phase8

### 2.3 — `hooks/use-feedback.ts` + tests
```typescript
export function useFeedback(duration = 5000) {
  return { feedback, showSuccess, showError, showWarning, showInfo, clearFeedback }
}
```
- [ ] Substituir les 9 implementacions idèntiques als components de fase + teacher-dashboard

### 2.4 — `components/ui/feedback-alert.tsx`
- Estil unificat (decisió D8b): colors neutres, sense variació per fase
- Accepta `className` override via `cn()` per casos excepcionals

### 2.5 — `components/ui/panel-header.tsx`
```tsx
export function PanelHeader({ icon, title, count, action, className }: PanelHeaderProps)
```
- Substituir 12+ patrons de capçalera icon+title+count

### 2.6 — `components/ui/empty-state.tsx`
- Substituir 9+ patrons de "no hi ha elements"

### 2.7 — `components/ui/status-badge.tsx`
```tsx
// Pur visual, sense coneixement d'estats de negoci (decisió D9)
export function StatusBadge({ color, label, className }: StatusBadgeProps)
```

### 2.8 — `components/ui/item-list.tsx`
```tsx
export function ItemList<T>({ items, renderItem, emptyMessage, maxHeight, className }: ItemListProps<T>)
```

### 2.9 — Verificació
- [ ] Tots els tests passen
- [ ] `npm run build` exitós
- [ ] Tots els nous fitxers tenen tests co-located

---

## FASE 3: RoomContext + Descomposició del God Hook

**Agents:** 2-3 seqüencials (api-client → hooks → context) | **Risc:** Mig

### 3.1 — `lib/api-client.ts` + tests
Result pattern: retorna `{ data, error }`, mai llança excepcions (decisió D12).
```typescript
export const api = {
  rooms: {
    getByCode: (code: string): Promise<ApiResult<RoomResponse>>,
    create: (name: string): Promise<ApiResult<Room>>,
    updatePhase: (id: string, phase: number): Promise<ApiResult<void>>,
    reset: (id: string): Promise<ApiResult<void>>,
  },
  transactions: { list, create, approve, vote, force },
  blocks: { list, createPending, createGenesis, submitBlock, calculateHash, reset, toggleMining, ... },
  mempool: { list, create, fill },
  pools: { list, create, join, leave, delete, toggle },
  keys: { register, list },
  messages: { send, list, sendFake },
  participants: { get, update },
  utxos: { list, create },
  utxoTransactions: { list, create },
  nodeConnections: { list, initialize, destroy, reconnect },
  simulation: { get, init, reset, updateSettings, fundAll, generateAddress, createTransaction },
}
```
- [ ] Cada mètode encapsula: `fetch(apiUrl(...))` + parse response + return `{ data, error }`
- [ ] Tests unitaris amb `vi.mock` de fetch global

### 3.2 — Separar hooks per domini
Descompondre `use-room-polling.ts` en:

| Nou hook | Responsabilitat | Fases |
|----------|----------------|-------|
| `hooks/use-room-state.ts` | Polling central (GET /api/rooms) + state | Totes |
| `hooks/use-transactions.ts` | send, approve, reject, vote, force | 0-2 |
| `hooks/use-crypto-actions.ts` | generateKeys, broadcastKey, sendMessage | 3 |
| `hooks/use-utxo-actions.ts` | createUtxoTx, listUtxos | 4 |
| `hooks/use-network-actions.ts` | initNetwork, destroyConnection, toggleSending, fillMempool, createMempoolTx | 5 |
| `hooks/use-mining-actions.ts` | createPending, createGenesis, submitBlock, calculateHash, resetBlockchain, toggleMining, difficulty | 6-7 |
| `hooks/use-pool-actions.ts` | createPool, joinPool, leavePool, deletePool, togglePools | 7 |
| `hooks/use-market-actions.ts` | createTx amb fee, halving settings, auto-mine settings | 8 |
| `hooks/use-simulation-actions.ts` | initPhase9, generateAddress, createPhase9Tx, fundAll, resetPhase9 | 9 |
| `hooks/use-teacher-actions.ts` | updatePhase, resetRoom, updateBalance, bankControls | Totes |

- [ ] Cada hook usa `api-client.ts`
- [ ] Cada hook té tests co-located
- [ ] Els hooks consumeixen dades del RoomContext (pas 3.3)

### 3.3 — Crear RoomContext complet (decisions D10 + D11)
```typescript
// contexts/room-context.tsx

interface RoomContextValue {
  // Dades (del polling central)
  room: Room | null;
  participant: Participant | null;
  isTeacher: boolean;
  blocks: Block[];
  mempoolTransactions: MempoolTransaction[];
  nodeConnections: NodeConnection[];
  miningPools: MiningPool[];
  // ... totes les dades

  // Accions (dels hooks de domini)
  // Transaccions
  sendTransaction: (payload) => Promise<ApiResult>;
  approveTransaction: (id) => Promise<ApiResult>;
  // Mining
  createBlock: () => Promise<ApiResult>;
  // ... totes les accions

  // Meta
  isLoading: boolean;
  refetch: () => void;
}

export function RoomProvider({ children, roomId, participantId }) {
  const roomState = useRoomState(roomId);           // polling cada 2s
  const txActions = useTransactions();                // callbacks
  const miningActions = useMiningActions();            // callbacks
  const teacherActions = useTeacherActions();          // callbacks
  // ...

  const value = useMemo(() => ({
    ...roomState,
    ...txActions,
    ...miningActions,
    ...teacherActions,
  }), [roomState, txActions, miningActions, teacherActions]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() { return useContext(RoomContext); }

// Selectors parcials per evitar re-renders innecessaris
export function useRoomBlocks() { return useRoom().blocks; }
export function useRoomMempool() { return useRoom().mempoolTransactions; }
```

### 3.4 — Integrar a `app/room/page.tsx`
```tsx
// ABANS: 59+ props drilling
// DESPRÉS:
function RoomPage() {
  return (
    <RoomProvider roomId={roomId} participantId={participantId}>
      {isTeacher ? <TeacherDashboard /> : <StudentView />}
    </RoomProvider>
  );
}
```
- [ ] Eliminar tot el prop drilling de `page.tsx`
- [ ] `TeacherDashboard` rep **0 props**
- [ ] Cada `phaseN-user-interface` rep **0 props** (usa `useRoom()`)

### 3.5 — Eliminar `use-room-polling.ts` original
- [ ] Verificar que cap fitxer l'importa
- [ ] Eliminar

### 3.6 — Verificació
- [ ] Tots els tests passen
- [ ] `npm run build` exitós
- [ ] `npm run dev` + crear sala + provar fases 1-9 manualment

---

## FASE 4: Descomposició del Teacher Dashboard

**Agents:** 2-3 en paral·lel | **Risc:** Mig-Alt

### 4.1 — Crear estructura de directori
```
components/room/teacher/
├── index.tsx                    (orquestrador, <100 línies)
├── teacher-phase-selector.tsx
├── teacher-student-list.tsx
├── teacher-phase0-controls.tsx
├── teacher-phase1-controls.tsx
├── teacher-phase2-controls.tsx
├── teacher-phase3-controls.tsx
├── teacher-phase4-controls.tsx
├── teacher-phase5-controls.tsx
├── teacher-phase6-controls.tsx
├── teacher-phase7-controls.tsx
├── teacher-phase8-controls.tsx
├── teacher-phase9-controls.tsx
├── teacher-stats-panel.tsx
└── teacher-common-controls.tsx  (reset, bank, phase navigation)
```

### 4.2 — Migrar seccions
- [ ] Cada sub-component fa `useRoom()` directament (0 props del pare)
- [ ] L'orquestrador (`index.tsx`) fa switch per `room.currentPhase`
- [ ] Cada `teacher-phaseN-controls.tsx` importa directament els panells que necessita (decisió D14)
- [ ] Re-exportar des de `index.tsx` per mantenir imports externs

### 4.3 — Eliminar `teacher-dashboard.tsx` original
- [ ] Actualitzar imports a `page.tsx` i qualsevol altre consumidor

### 4.4 — Verificació
- [ ] Tots els tests passen
- [ ] Dashboard funcional per totes les fases

---

## FASE 5: Optimització Components de Fase Alumne

**Agents:** 3 en paral·lel (fases 1-3 / 4-6 / 7-9) | **Risc:** Mig

### 5.1 — Aplicar components compartits (Fase 2) a tots els components
Per cada `phaseN-user-interface.tsx`:
- [ ] Substituir feedback local → `useFeedback()` + `<FeedbackAlert />`
- [ ] Substituir capçaleres → `<PanelHeader />`
- [ ] Substituir badges → `<StatusBadge />`
- [ ] Substituir llistes buides → `<EmptyState />`
- [ ] Substituir llistes → `<ItemList />`
- [ ] Substituir `getBalance()` local → `balance-utils`
- [ ] Substituir fetch directes → `useRoom()` (ja fet a Fase 3)

### 5.2 — Components compartits de fase
- [ ] `BaseTransactionForm` amb slots/children (decisió D15)
  - Base: recipient selector + amount input + submit button + `onValidate` prop
  - Fase 8: afegeix `<FeeInput />` com a child
  - Fase 9: afegeix `<UtxoSelector />` i `<AddressInput />` com a children
  - **Si les validacions condicionals generen conflictes → revertir a formularis independents**
- [ ] `TransactionList` — llista reutilitzable amb filtre per estat
- [ ] `BlockchainView` — ja existeix `blockchain-visualization.tsx`, verificar que es reutilitza a fases 6-9
- [ ] `MempoolView` — llista de mempool compartida (fases 5, 8, 9)

### 5.3 — Verificació per fase
- [ ] Tests funcionals passen per cada component
- [ ] Verificació visual manual per cada fase (checklist, decisió D16)

---

## FASE 6: Optimització API Backend

**Agents:** 2 en paral·lel (routes + store) | **Risc:** Mig

### 6.1 — Descompondre `blocks/route.ts`
Moure lògica de negoci a `lib/actions/` (decisió D18):
```
lib/actions/blocks/
├── create-pending.ts
├── create-genesis.ts
├── submit-block.ts
├── calculate-hash.ts
├── reset.ts
├── toggle-mining.ts
├── difficulty.ts
├── halving.ts
└── select-transactions.ts
```
- `app/api/blocks/route.ts` queda com a dispatcher: parseja request → crida acció → retorna resposta

### 6.2 — Extreure funcions compartides
- [ ] `updateCoinFileBalance()` → ja a `lib/balance-utils.ts` (Fase 2.1)
- [ ] Funcions de hash/validació duplicades entre `blocks/route.ts` i `simulation/route.ts` → `lib/actions/shared/mining-utils.ts`
- [ ] Lògica de reconnexió duplicada entre `node-connections/route.ts` i `participants/[id]/route.ts` → `lib/actions/shared/network-utils.ts`

### 6.3 — Descompondre `store.ts`
```
lib/store/
├── index.ts          (re-exports de tot)
├── room-store.ts     (rooms, participants)
├── tx-store.ts       (transactions, votes)
├── block-store.ts    (blocks, mining)
├── network-store.ts  (connections, mempool)
├── crypto-store.ts   (keys, messages)
├── phase9-store.ts   (addresses, phase9 UTXOs, phase9 mempool)
└── types.ts          (RoomState, globalThis keys)
```

### 6.4 — Mantenir format de resposta actual (decisió D17)
- NO canviar format de resposta de les API routes
- L'abstracció es fa a `api-client.ts` (Fase 3)

### 6.5 — Verificació
- [ ] Tests de store passen
- [ ] `npm run build` exitós
- [ ] Tests E2E manual: crear sala, enviar transaccions, minar blocs

---

## FASE 7: Fitxers Grans

**Agents:** 2 en paral·lel | **Risc:** Baix

### 7.1 — Separar i18n (decisió D19)
```
lib/i18n/
├── index.ts      (setup i18next, importa JSONs, ~50 línies)
├── ca.json       (català)
├── es.json       (castellà)
└── en.json       (anglès)
```
- [ ] Extreure objecte de traduccions de cada idioma al JSON corresponent
- [ ] Actualitzar `index.ts` per carregar JSONs
- [ ] Verificar que `t()` funciona a totes les pantalles

### 7.2 — Extreure changelog (decisió D20)
- [ ] Crear `public/changelog.json` amb array d'objectes `{ version, date, changes[] }`
- [ ] `version-footer.tsx` passa a llegir el JSON i renderitzar-lo (~100 línies)

### 7.3 — Verificació
- [ ] Traduccions funcionen en ca/es/en
- [ ] Footer mostra changelog correctament

---

## FASE 8: Documentació Final

**Agents:** 1 | **Risc:** Cap

- [ ] Actualitzar `ARCHITECTURE.md` amb estructura post-refactor
- [ ] Actualitzar `CLAUDE.md` amb nova estructura de directoris i patrons
- [ ] Actualitzar memòria del projecte (`memory/project_current_state.md`)
- [ ] Verificació final:
  - [ ] `npm run build` exitós
  - [ ] `npm run test` exitós
  - [ ] Cap fitxer > 300 línies (excepte JSONs d'i18n i changelog)
  - [ ] Cap import trencat

---

## Mètriques d'Èxit

| Mètrica | Abans | Objectiu |
|---------|-------|----------|
| Fitxer més gran (excl. i18n/changelog) | 2.625 línies | < 300 línies |
| Hook més gran | 1.835 línies | < 200 línies |
| Fitxers amb > 500 línies | 8 | 0 |
| Patrons duplicats | 8 × 9 fases | 0 |
| Components UI no usats | ~12 | 0 |
| Codi mort (fitxers) | 5 (`socket.ts`, `io.ts`, `server.ts`, `use-toast` dup, Shadcn) | 0 |
| Props al TeacherDashboard | 59 | 0 (RoomContext) |
| Cobertura tests | 0% | > 70% utils, > 50% components |
| `npm run build` | ✅ | ✅ |

---

## Ordre d'Execució

```
Sessió 1:  Fase 0 (tests setup) + Fase 1 (neteja Socket.io + codi mort)
Sessió 2:  Fase 2 (utils compartits) + Fase 7 (i18n/footer)
Sessió 3:  Fase 3 (api-client + hooks + RoomContext)
Sessió 4:  Fase 4 (teacher-dashboard descomposició)
Sessió 5:  Fase 5 (components de fase alumne)
Sessió 6:  Fase 6 (backend) + Fase 8 (docs)
```
