# BitQuest Refactor — Registre de Decisions

Decisions tècniques preses durant la refactorització.
Cada decisió inclou la justificació perquè sigui traçable.
**Decisor:** `[A]` = agent autònom | `[U]` = validat per l'usuari

---

## 1. Infraestructura de Tests

### D1. Ubicació dels fitxers de test
**Decisió:** Co-located (cada test al costat del seu fitxer)
- `components/room/phase1-user-interface.test.tsx`
- `lib/balance-utils.test.ts`
- `hooks/use-feedback.test.ts`

**Justificació:** Estàndard de la indústria per projectes Next.js/React. Facilita trobar tests, i quan s'elimina un fitxer el test s'elimina amb ell. Vitest ho suporta nativament.

### D2. Tipus de tests per components
**Decisió:** Tests funcionals d'elements crítics (sense snapshots complets)
- Verificar que elements clau existeixen (botons, llistes, títols)
- Verificar interaccions bàsiques (click → callback cridat)
- No fer snapshots complets: els components tenen molt JSX amb Tailwind i qualsevol canvi estètic trenca el snapshot sense valor real

**Justificació:** Els snapshots en projectes amb Tailwind generen massa soroll. Tests funcionals donen confiança real sense fragilitat.

### D3. Estratègia de mocking
**Decisió:** Mocks simples amb `vi.mock()` per mòduls
- Mock de `lib/api-client.ts` als tests de hooks
- Mock de hooks als tests de components
- No instal·lar MSW — és overkill per un projecte educatiu sense API externa

**Justificació:** El backend és in-memory al mateix servidor. No cal interceptar xarxa. Mocks de mòdul són suficients i molt més simples.

---

## 2. Neteja de Codi

### D4. Socket.io — eliminació completa `[U]`
**Decisió:** Eliminar Socket.io completament. Migrar a `next dev`.
- Eliminar `server.ts` (punt d'entrada custom amb Socket.io)
- Eliminar `lib/io.ts` (broadcastRoomUpdate, initIO, getIO)
- Eliminar `lib/socket.ts` (client Socket.io)
- Eliminar totes les crides a `broadcastRoomUpdate()` de les API routes
- Actualitzar `package.json` scripts: `dev` → `next dev`, `start` → `next start`
- Desinstal·lar `socket.io` i `socket.io-client`
- Eliminar imports comentats de Socket.io a `use-room-polling.ts`

**Justificació (usuari):** Mala experiència prèvia amb Socket.io. Prioritzem estabilitat. El polling HTTP funciona bé per l'ús actual (aula amb ~25 alumnes). Reimplementació de real-time fora de l'abast d'aquest pla de refactor.

### D5. `server-monitor.ts`
**Decisió:** Mantenir-lo
**Justificació:** Eina de debug útil per diagnosticar problemes de rendiment en sessions amb molts alumnes. Està desactivat (`monitor.start()` comentat) i no afecta el bundle ni el rendiment. Cost de mantenir-lo: zero.

### D6. Eliminació de components Shadcn no usats
**Decisió:** L'agent fa grep automàtic i elimina tot component sense cap import
- Abans d'eliminar, verificar: imports directes (`from './component'`), re-exports, i ús dins altres components UI
- Si un component no té cap referència al projecte (excloent el propi fitxer), s'elimina
- Commit específic per aquesta neteja per facilitar revert si cal

**Justificació:** Procediment segur — grep és determinista, i git history preserva tot.

---

## 3. Components Compartits

### D7. Directori dels nous components compartits
**Decisió:** `components/ui/` (al costat dels Shadcn existents)
- Fitxers: `feedback-alert.tsx`, `panel-header.tsx`, `status-badge.tsx`, `empty-state.tsx`, `item-list.tsx`

**Justificació:** Ja existeix un directori `components/ui/` amb components reutilitzables (card, button, badge...). Els nous components segueixen la mateixa filosofia — són primitives UI, no lògica de negoci. Crear un directori separat fragmentaria sense valor.

### D9. `StatusBadge` — disseny
**Decisió:** Rep `color` i `label` directament (opció simple)
```tsx
<StatusBadge color="amber" label={t('status.pending')} />
```
- Opcionalment accepta `variant` presets per estats comuns (`pending`, `approved`, `rejected`)
- El component no coneix estats de negoci — és purament visual

**Justificació:** Màxima flexibilitat, mínim acoblament. Cada fase pot definir els seus colors sense modificar el component compartit.

### D8. Estils dels components compartits `[U]`
**Decisió:** Unificació visual — un sol esquema de colors per totes les fases
- Els components compartits tenen estils fixos i consistents
- S'eliminen les variacions de color per fase (amber fase 6, violet fase 3, etc.)
- Esquema unificat basat en el tema global del projecte (dark mode amb accents neutres)
- Accepten `className` override via `cn()` per casos excepcionals

**Justificació (usuari):** Prefereix unificació visual. Simplifica el codi i dona coherència a l'experiència d'alumne.

---

## 4. Arquitectura de State Management

### D10. RoomContext complet `[U]`
**Decisió:** Crear un `RoomContext` que contingui TOTES les dades i TOTES les accions
- `RoomProvider` encapsula polling + hooks de domini
- Qualsevol component fill fa `useRoom()` per accedir a dades i accions
- **0 props** al `TeacherDashboard` i sub-components
- Mitigar re-renders amb `useMemo`, `React.memo` i selectors parcials (`useRoomBlocks()`)

```tsx
// Estructura
<RoomProvider roomId={roomId} participantId={participantId}>
  {isTeacher ? <TeacherDashboard /> : <StudentView />}
</RoomProvider>

// Consumer
function Phase6Controls() {
  const { room, blocks, createBlock } = useRoom();
  return <button onClick={createBlock}>Crear bloc</button>;
}
```

**Justificació (usuari):** Elimina completament el prop drilling (59 props → 0). Facilita la descomposició del teacher-dashboard i dels components de fase.

### D11. Polling centralitzat via Context `[U]`
**Decisió:** Només `use-room-state.ts` fa polling (1 request/2s). Distribueix dades via RoomContext.
- Els hooks de domini (`use-transactions`, `use-mining-actions`, etc.) consumeixen del context
- Els hooks de domini NOMÉS exposen accions (callbacks), no fan polling propi
- Cap canvi en el nombre de requests HTTP (segueix sent 1 cada 2s)

```
use-room-state.ts → GET /api/rooms?code=X cada 2s → RoomContext
       ↓ context
use-transactions.ts     (llegeix del context, exposa sendTx, voteTx)
use-mining-actions.ts   (llegeix del context, exposa createBlock)
use-teacher-actions.ts  (llegeix del context, exposa resetPhase)
```

**Justificació (usuari):** Manté la simplicitat d'1 sola request però amb codi organitzat per domini.

---

### D12. Gestió d'errors a `api-client.ts`
**Decisió:** Result pattern — retorna `{ data, error }`, mai llança excepcions
```typescript
const { data, error } = await api.transactions.create(payload);
if (error) showError(error.message);
```

**Justificació:** Evita try/catch dispersos als consumers. El pattern és explícit (forces a gestionar l'error) i simplifica el codi dels hooks. Compatible amb el hook `useFeedback`.

### D17. Format de resposta API
**Decisió:** Mantenir format actual, no estandarditzar ara
- Canviar el format requereix actualitzar tots els consumers (frontend)
- El benefici és marginal per un projecte educatiu single-server
- Si es fa en el futur, fer-ho a l'api-client (capa d'abstracció)

**Justificació:** Risc alt, benefici baix. L'api-client ja abstreu les diferències de format.

### D18. Organització de lògica de `blocks/route.ts`
**Decisió:** `lib/actions/blocks/*.ts` — lògica de negoci fora d'`app/api/`
```
lib/actions/
├── blocks/
│   ├── create-pending.ts
│   ├── create-genesis.ts
│   ├── submit-block.ts
│   └── ...
├── transactions/
│   └── ...
└── shared/
    └── coin-utils.ts
```

**Justificació:** Separar lògica de negoci del routing HTTP. Les routes d'API fan: validar request → cridar acció → retornar resposta. La lògica viu a `lib/actions/` i és testejable sense HTTP.

### D15. TransactionForm compartit `[U]`
**Decisió:** `BaseTransactionForm` amb slots/children per camps extra
- El component base gestiona: selecció de destinatari, camp d'import, botó d'enviar, validació bàsica
- Cada fase afegeix camps extra via children/slots (fee, UTXO selector, sender)
- **Condició:** Si les validacions condicionals entre fases creen conflictes (ex: fee=0 vàlid en unes fases i invàlid en altres), es reverteix a formularis independents per fase
- La validació es delega al consumer via prop `onValidate?: (data) => string | null`

```tsx
<BaseTransactionForm
  participants={otherStudents}
  onSubmit={handleSend}
  onValidate={(data) => data.fee < 1 ? t('error.feeRequired') : null}
>
  <FeeInput />  {/* slot extra per fase 8 */}
</BaseTransactionForm>
```

**Justificació (usuari):** Flexibilitat amb reutilització. Si no funciona, revert a formularis independents.

### D16. Verificació post-refactor `[U]`
**Decisió:** Tests funcionals (Fase 0) + checklist manual per fase
- Tests funcionals validen elements clau i interaccions
- Checklist manual: obrir app → crear sala → provar flux de cada fase
- No invertir en Playwright/Cypress en aquest moment

**Justificació (usuari):** Proporció esforç/benefici adequada. E2E seria una inversió extra fora d'abast.

---

---

## 6. Organització de Fitxers

### D13. Directori sub-components del teacher
**Decisió:** `components/room/teacher/` (subdirectori nou)
- `teacher-dashboard.tsx` es mou a `teacher/index.tsx` (orquestrador)
- Sub-components: `teacher/phase1-controls.tsx`, `teacher/phase2-controls.tsx`, etc.
- L'import extern no canvia si re-exportem des de l'index

**Justificació:** Agrupa fitxers relacionats. 15 fitxers amb prefix `teacher-` al directori `room/` farien massa soroll.

### D14. Panells educatius dins el teacher
**Decisió:** Cada `teacher/phaseN-controls.tsx` importa directament els panells que necessita
- `teacher/phase3-controls.tsx` importa `Phase3CryptoPanel`
- `teacher/phase5-controls.tsx` importa `Phase5TeacherPanel`
- Els panells NO es mouen dins `teacher/` — són components reutilitzables que tant alumne com professor usen

**Justificació:** Cada sub-component és autònom. L'orquestrador (`index.tsx`) només decideix quin renderitzar segons la fase activa.

---

## 6. Fitxers Grans

### D19. Format de traduccions
**Decisió:** JSON amb un fitxer per idioma (`ca.json`, `es.json`, `en.json`)
```
lib/i18n/
├── index.ts      (setup i18next, ~50 línies)
├── ca.json
├── es.json
└── en.json
```

**Justificació:** Format estàndard d'i18next. Suportat nativament sense configuració extra. Els editors tenen syntax highlighting per JSON. Facilita contribucions de traducció sense tocar TypeScript.

### D20. Format de dades del changelog
**Decisió:** JSON (`changelog.json`)
```json
[
  { "version": "0.4.9", "date": "2026-03-15", "changes": ["Fase 9: adreces..."] }
]
```

**Justificació:** Parsejable per codi, editable per humans, versionable amb git. Markdown requeriria parsing complex.

---

## 7. Branques i Commits

### D21. Estratègia de branques
**Decisió:** Branca per fase, merge seqüencial a `main`
- `refactor/fase0-tests`
- `refactor/fase1-cleanup`
- `refactor/fase2-shared-utils`
- etc.
- Cada branca es crea des de `main` (o des de l'anterior ja merged)
- PR per fase amb descripció del que s'ha fet

**Justificació:** Permet revisar i revertir per fase. Si una fase introdueix regressions, es pot revertir sencera sense afectar les altres.

### D22. Granularitat de commits
**Decisió:** Un commit per sub-tasca del pla
- Ex: "Eliminar hooks/use-toast.ts duplicat", "Crear lib/balance-utils.ts amb tests"
- Missatge en català, descriptiu, amb referència a la secció del pla

**Justificació:** Commits atòmics faciliten git bisect si apareix una regressió. Cada commit compila i passa tests.

### D23. Ordre Fase 2 vs Fase 3
**Decisió:** Mantenir l'ordre del pla (Fase 2 primer, Fase 3 després)
- Fase 2 crea utils/components que no depenen de l'api-client
- Fase 3 crea api-client + reestructura hooks
- Si cal, s'actualitzen els components de Fase 2 durant la Fase 3

**Justificació:** Fase 2 és de risc baix (components UI purs). Millor tenir-la completada com a base estable abans d'abordar la reestructuració de hooks (risc mig).
