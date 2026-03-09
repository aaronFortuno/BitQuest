# Fase 5: Xarxa de Nodes i Mempool — Pla de Redisseny

## Versio del pla: 1.0
## Branca: `feature/phase5-network-redesign`
## Base: `v0.4.5` (commit `1cd9775`)

---

## Context

La Fase 4 ja cobreix la creacio de transaccions, broadcast i validacio d'UTXOs.
La Fase 5 ha de centrar-se en un concepte diferent: **com funciona la xarxa P2P**,
com viatja la informacio de node a node, i per que cada node te una visio parcial
de la realitat en un moment donat.

**Public objectiu**: alumnes de 6e de primaria. Interficie senzilla, visual, amb
minim text i maxima claredat.

**Missatge clau**: "Tu no estas connectat a tothom. Depens dels teus veins per
saber que passa. I el que tu veus pot ser diferent del que veu un altre node
en un moment donat."

---

## Arquitectura objectiu

### Interficie alumne (3 zones)

```
+-----------------------------+---------------------------+
|                             |                           |
|   ZONA A: Mini-graf         |   ZONA C: Mempool local   |
|   (el meu node + 2-3       |   (TX que m'han arribat,  |
|    veins, animat)           |    amb indicador de       |
|                             |    propagacio als veins)  |
|                             |                           |
+-----------------------------+                           |
|                             |                           |
|   ZONA B: Enviar TX         |                           |
|   (bloquejat fins que       |                           |
|    el professor l'activi)   |                           |
|                             |                           |
+-----------------------------+---------------------------+
```

- **Zona A**: Visualitzacio del node propi (destacat al centre) amb els seus 2-3
  veins connectats amb linies. Animacio suau (nodes "flotants"). Quan una TX
  es propaga, les linies s'il·luminen (1.5-3s per salt). Si perds un vei,
  el node desapareix i automaticament es busca una nova connexio (animacio).

- **Zona B**: Formulari simplificat per enviar TX. Inicialment **bloquejat**
  (el professor el controla). Format: destinatari (dropdown) + quantitat (1-5).
  Sense fees.

- **Zona C**: Llista de transaccions que han arribat al node de l'alumne.
  Cada TX mostra: "TX#N: NomA -> NomB (X BTC)" amb indicador visual de
  l'estat de propagacio (si la TX s'esta reenviant als veins).

### Interficie professor (3 zones)

```
+-------------------------------------------------------+
|                                                       |
|   ZONA 1: Mapa complet de la xarxa                   |
|   (tots els nodes, totes les connexions)              |
|   Clic a node = enviar TX / desconnectar (segons mode)|
|   Clic a linia = destruir connexio                    |
|                                                       |
+-------------------------------------------------------+
|                                                       |
|   ZONA 2: Controls                                    |
|   - Toggle mode: "Enviar TX" / "Desconnectar"        |
|   - Boto: "Inicialitzar xarxa"                       |
|   - Toggle: "Permetre alumnes enviar"                 |
|   - Stats basiques                                    |
|                                                       |
+-------------------------------------------------------+
```

### Comportament de xarxa

- Cada node te exactament **2-3 connexions** (no ring+cross com ara)
- **Propagacio realista**: quan un node rep una TX, la reenvia als veins
  que encara no la tenen, seguint el graf real de connexions (1.5-3s per salt)
- **Malla viva**: si un node perd un vei (el professor el desconnecta o
  destrueix la linia), el node automaticament busca una nova connexio
  a un node accessible (amb animacio visual)
- **Desconnexio de linia**: el professor pot destruir una connexio
  individual entre dos nodes (no desconnectar tot el node)

---

## Passos d'implementacio

### Pas 1: Afegir camp `studentSendingEnabled` a Room
**Fitxers**: `lib/types.ts`, `lib/store.ts`, `app/api/rooms/route.ts`

- Afegir `studentSendingEnabled?: boolean` a la interficie `Room` (types.ts)
- Afegir `studentSendingEnabled: boolean` a `RoomData` (store.ts, defecte: false)
- Assegurar que el camp es retorna a l'API GET de rooms
- Afegir endpoint o camp al PATCH de rooms per canviar-lo

**Verificacio**: El camp existeix i es pot llegir/escriure via API.

---

### Pas 2: Refactoritzar la topologia de xarxa
**Fitxers**: `app/api/node-connections/route.ts`, `lib/store.ts`

Canviar l'algoritme d'inicialitzacio de xarxa:
- Cada node rep exactament 2-3 connexions (no mes)
- Algoritme: per cada node, connectar-lo a 2-3 nodes aleatoris que encara
  tinguin menys de 3 connexions
- Assegurar que el graf es connex (tots els nodes es poden arribar entre ells)

Afegir nous endpoints:
- **DELETE** `/api/node-connections?id={connectionId}`: destruir una connexio
  individual (desactivar-la, `isActive = false`)
- **POST** `/api/node-connections/reconnect`: logica de reconnexio automatica.
  Donat un node que ha perdut un vei, buscar un node accessible amb menys de
  3 connexions i crear una nova connexio.

Afegir funcions al store:
- `deactivateNodeConnection(connectionId)`: posa `isActive = false`
- `getNodeConnections(nodeId, roomId)`: retorna connexions actives d'un node
- `getConnectedNodeIds(nodeId, roomId)`: retorna IDs dels veins d'un node

**Verificacio**: Inicialitzar xarxa amb 10 nodes dona 2-3 connexions per node,
graf connex. Destruir una connexio funciona. Reconnexio crea nova connexio.

---

### Pas 3: Refactoritzar la propagacio de transaccions
**Fitxers**: `app/api/mempool/route.ts`, `lib/store.ts`

Canviar `simulatePropagation()`:
- En lloc de propagar "a tots linealment", seguir el graf real de connexions
- Implementar BFS (Breadth-First Search) des del node emissor
- Cada "salt" entre nodes = delay de 1500-3000ms (aleatori)
- A cada pas, el node que rep la TX la reenvia als seus veins que no la tenen
- Actualitzar `propagatedTo` a cada pas i fer broadcast via Socket.io
- Nodes desconnectats (`isNodeDisconnected=true`) no reben ni propaguen
- Connexions inactives (`isActive=false`) no es fan servir per propagar

Eliminar `fee` del POST body (ignorar-lo, posar 0 per defecte).

Afegir endpoint per a transaccions del professor:
- **POST** `/api/mempool/teacher`: el professor pot crear una TX des de
  qualsevol node (especificant `originNodeId` en lloc de `senderId`)

**Verificacio**: Crear TX des d'un node i veure que es propaga salt a salt
seguint les connexions. Nodes sense connexio no reben la TX.

---

### Pas 4: Reescriure la interficie alumne
**Fitxers**: `components/room/phase5-user-interface.tsx`

Reescriure completament el component:

**Zona A — Mini-graf del node**:
- SVG/Canvas amb el node propi al centre i els 2-3 veins al voltant
- Nodes com a cercles amb el nom de l'alumne dins
- Linies de connexio entre nodes
- Animacio: nodes amb lleuger moviment (flotant amb framer-motion)
- Propagacio visual: quan una TX viatja per una linia, la linia canvia
  de color progressivament (ex: gris -> groc -> verd)
- Si perdem un vei: la linia es trenca (animacio), busquem nou vei,
  nova linia apareix (animacio)

**Zona B — Enviar TX**:
- Visible pero bloquejat per defecte (overlay amb missatge "El professor
  activara aquesta funcio quan sigui el moment")
- Quan actiu: dropdown destinatari + input quantitat (1-5) + boto enviar
- Sense fees

**Zona C — Mempool local**:
- Llista scrollable de TX que han arribat al meu node
- Cada TX: "TX#N: Nom1 -> Nom2 (X BTC)"
- Indicador visual de propagacio: barra animada o icona de "reenviant..."
  quan la TX s'esta propagant als meus veins
- TX noves apareixen amb animacio (fade in des de la dreta)

**Verificacio**: L'alumne veu el seu node, els veins, les TX arriben animades,
el formulari esta bloquejat fins que el professor l'activi.

---

### Pas 5: Reescriure la interficie professor (teacher-dashboard, seccio fase 5)
**Fitxers**: `components/room/teacher-dashboard.tsx` (seccio fase 5)

Reescriure la seccio `currentPhase === 5`:

**Zona 1 — Mapa complet de xarxa**:
- Visualitzacio SVG amb TOTS els nodes i TOTES les connexions
- Layout: force-directed simple (nodes es repel·len, connexions els atrauen)
  o layout circular millorat
- Cada node mostra el nom de l'alumne
- Nodes desconnectats en vermell
- Connexions actives en blau, inactives en vermell puntejat
- Interaccio segons mode:
  - **Mode TX** (defecte): clic a un node = genera TX aleatoria des d'aquell
    node. Veiem la propagacio en temps real (linies s'il·luminen)
  - **Mode desconnectar**: clic a un node = desconnecta/reconnecta el node
    complet. Clic a una linia = destrueix aquella connexio individual
- Propagacio visual: les linies canvien de color quan una TX hi "viatja"

**Zona 2 — Controls**:
- Toggle mode: icona de TX / icona de tisores (o similar)
- Boto "Inicialitzar xarxa" (regenerar topologia)
- Toggle "Permetre alumnes enviar" (actualitza `studentSendingEnabled`)
- Stats compactes: nodes actius, connexions, TX al mempool

**Verificacio**: El professor veu tota la xarxa, pot enviar TX clicant un node,
pot desconnectar nodes/linies, pot habilitar l'enviament dels alumnes.

---

### Pas 6: Actualitzar el hook i el router
**Fitxers**: `hooks/use-room-polling.ts`, `app/room/page.tsx`

Hook — noves funcions:
- `toggleStudentSending(enabled: boolean)`: PATCH a rooms per canviar
  `studentSendingEnabled`
- `destroyConnection(connectionId: string)`: DELETE a node-connections
- `createTeacherTransaction(originNodeId: string)`: POST a mempool/teacher
- Modificar `createMempoolTransaction`: treure parametre `fee`

Hook — eliminar:
- `fillMempool` (ja no cal)

Router (page.tsx):
- Passar noves props a Phase5UserInterface
- Passar noves props a teacher-dashboard (seccio fase 5)

**Verificacio**: Totes les funcions noves criden correctament a l'API.
La UI renderitza amb les noves props.

---

### Pas 7: Polish i animacions
**Fitxers**: `phase5-user-interface.tsx`, `teacher-dashboard.tsx`

- Afinar animacions de propagacio (temporitzacio, colors)
- Afinar animacio de reconnexio de nodes
- Afinar layout responsiu (mòbil/tablet)
- Testejar amb 5-10 nodes simulats
- Assegurar que la visualitzacio escala be fins a 30 nodes

**Verificacio**: Tot es veu be i funciona fluid amb 30 nodes.

---

### Pas 8: Actualitzar traduccions i panell d'instruccions
**Fitxers**: `lib/i18n.ts`, `components/room/instructions-panel.tsx`

- Revisar/actualitzar traduccions de la fase 5 (ca + es)
- Eliminar claus obsoletes (fees, global mempool, etc.)
- Afegir noves claus (mode desconnectar, permetre alumnes, etc.)
- Actualitzar el panell d'instruccions de la fase 5

**Verificacio**: Tots els textos es mostren correctament en catala i castella.

---

## Fitxers afectats (resum)

| Fitxer | Accio |
|--------|-------|
| `lib/types.ts` | Modificar (Room, MempoolTransaction) |
| `lib/store.ts` | Modificar (RoomData, noves funcions) |
| `app/api/node-connections/route.ts` | Reescriure (topologia + DELETE) |
| `app/api/mempool/route.ts` | Reescriure (propagacio per graf + teacher endpoint) |
| `components/room/phase5-user-interface.tsx` | Reescriure complet |
| `components/room/teacher-dashboard.tsx` | Modificar (seccio fase 5) |
| `hooks/use-room-polling.ts` | Modificar (noves funcions, eliminar fillMempool) |
| `app/room/page.tsx` | Modificar (noves props) |
| `lib/i18n.ts` | Modificar (traduccions) |
| `components/room/instructions-panel.tsx` | Modificar (contingut fase 5) |

---

## Estat de progres

- [x] Pas 1: Camp `studentSendingEnabled` (commit: veure git log)
- [ ] Pas 2: Topologia de xarxa (2-3 connexions per node)
- [ ] Pas 3: Propagacio per graf (BFS amb delays)
- [ ] Pas 4: Interficie alumne (reescriptura)
- [ ] Pas 5: Interficie professor (reescriptura seccio fase 5)
- [ ] Pas 6: Hook i router
- [ ] Pas 7: Polish i animacions
- [ ] Pas 8: Traduccions i instruccions
