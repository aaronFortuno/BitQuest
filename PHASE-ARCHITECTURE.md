# BitQuest — Arquitectura de Fases (UI/UX)

> **Propòsit**: Document de referència per a l'arquitectura d'interfícies de cada fase.
> Descriu els panells, funcionalitats, dades i accions tant per al **professor** com per als **alumnes**.
>
> **INSTRUCCIONS PER A CLAUDE**: Actualitza aquest document cada vegada que:
> - Es finalitzi la implementació d'una nova fase
> - Es modifiquin, afegeixin o eliminin panells o funcionalitats rellevants d'una fase existent
> - Hi hagi canvis significatius d'arquitectura, UX o UI en qualsevol fase
>
> Cada fase ha de tenir documentades les seccions: Fitxers, Layout, Panells Alumne, Panells Professor, Accions, Dades Mostrades i Notes.

---

## Estructura general

- **Professor**: Sempre veu `TeacherDashboard` (`components/room/teacher-dashboard.tsx`), que mostra un panell diferent segons `currentPhase`.
- **Alumne**: Veu un component diferent per fase (`student-interface.tsx`, `phase1-user-interface.tsx`, `phase2-user-interface.tsx`, etc.), seleccionat a `app/room/page.tsx` dins `renderStudentInterface()`.
- **Routing**: `/room?code=ABC` amb query params. El professor i l'alumne comparteixen la mateixa pàgina, diferenciada per `isTeacher`.
- **Polling**: `hooks/use-room-polling.ts` proporciona totes les dades i accions (fetch cada 2s + Socket.io com a secundari).

---

## Fase 0 — El problema del doble pagament

### Objectiu educatiu
Demostrar que els diners digitals (fitxers) es poden copiar i manipular. No hi ha cap autoritat central — l'alumne pot editar el seu saldo manualment.

### Fitxers
| Rol | Fitxer |
|-----|--------|
| Alumne | `components/room/student-interface.tsx` |
| Professor | `components/room/teacher-dashboard.tsx` → secció `currentPhase === 0` |

### Interfície Alumne

**Layout**: Grid 2 columnes (1 col en mòbil).

#### Columna esquerra
1. **Panell "Enviar monedes"** (violet)
   - Dropdown per seleccionar destinatari (estudiants actius, excloent-se a ell mateix)
   - Input numèric per l'import (mínim 1)
   - Botó "Enviar"
   - Feedback de confirmació o avís (saldo negatiu permès — és el punt de la fase!)

2. **Panell "El meu arxiu de monedes"** (amber)
   - Editor JSON en textarea (editable directament!)
   - Botó d'ajuda amb text educatiu sobre l'arxiu
   - Auto-save on blur si hi ha canvis
   - Avís "Recorda: pots fer trampes!"

#### Columna dreta
3. **Panell "Registre de transaccions"** (green)
   - Llista scrollable de totes les transaccions de la sala
   - Per cada TX: `Remitent → Destinatari` + import
   - Transaccions destacades visualment (highlighted)

### Interfície Professor

**Layout**: Grid 2 columnes.

#### Columna esquerra — Activitat dels estudiants
- **Taula** amb columnes: Nom | TX | Enviat | Rebut | Saldo Arxiu | Saldo Real
- Fila en vermell si hi ha **discrepància** (saldo arxiu ≠ saldo calculat per transaccions)
- Icona ⚠️ (AlertTriangle) per discrepància
- Icona ⚡ (AlertCircle) si ha gastat més del que tenia (overspent)
- Banner d'alerta vermell si es detecta qualsevol discrepància

#### Columna dreta — Historial de transaccions
- Llista cronològica (més recent primer), scrollable (max 600px)
- Per cada TX: `Remitent → Destinatari` + import
- TX sospitoses marcades en vermell amb badge "Transaccions impossibles"
- Botó ⭐ per destacar transaccions (visible per tots els alumnes)

### Accions
| Rol | Acció | API/Funció |
|-----|-------|------------|
| Alumne | Enviar monedes | `sendTransaction()` → `POST /api/transactions` |
| Alumne | Editar arxiu monedes | `updateCoinFile()` → `POST /api/coin-files` |
| Professor | Destacar transacció | `highlightTransaction()` → `POST /api/transactions/highlight` |

### Dades
- `room.participants[].coinFile` — JSON amb `{ propietari, saldo }`
- `room.transactions[]` — Totes les TX de la sala (status sempre 'approved' a fase 0)
- Saldo inicial: 10 monedes

---

## Fase 1 — Solució centralitzada (El Banc)

### Objectiu educatiu
Introduir una autoritat central (el Banc = professor) que valida transaccions. Demostrar els problemes: censura, punt únic de fallada, dependència.

### Fitxers
| Rol | Fitxer |
|-----|--------|
| Alumne | `components/room/phase1-user-interface.tsx` |
| Professor | `components/room/teacher-dashboard.tsx` → secció `currentPhase === 1` |

### Interfície Alumne

**Layout**: Grid 2 columnes.

#### Columna esquerra
1. **Panell "El meu compte"** (violet/purple)
   - Nom de l'alumne + saldo actual
   - Botó d'ajuda: "El teu saldo està controlat pel banc"

2. **Panell "Enviar transferència"** (formulari compacte, 1 fila)
   - Dropdown destinatari + input import + botó enviar
   - Badge amb el nombre de TX pendents
   - Banner d'alerta si el banc està desconnectat (no es pot enviar)
   - Text d'ajuda amb el límit màxim de transferència
   - Feedback de confirmació/error/rebuig

#### Columna dreta
3. **Panell "Les meves transaccions"**
   - Llista scrollable (max 500px) de TX pròpies (enviades + rebudes)
   - Ordenades de més recent a més antiga
   - Per cada TX: icona d'estat + direcció + import amb color
     - ⏳ Pendent (amber)
     - ✅ Enviada aprovada (red) / Rebuda aprovada (green)
     - ❌ Rebutjada (gray) + motiu de rebuig
   - Text "Esperant aprovació" per les pendents

### Interfície Professor

**Layout**: Grid 2 columnes. Columna esquerra: 3 panells apilats.

#### Columna esquerra

1. **Panell de control del Banc** (emerald)
   - Botó toggle "Tancar Banc" / "Reconnectar Banc" (vermell/verd)
   - Input numèric "Límit de transferència"

2. **Cua de transaccions pendents** (amber)
   - Títol amb badge del nombre de pendents
   - Llista scrollable (max 256px)
   - Per cada TX pendent:
     - `Remitent → Destinatari` + import
     - Badge de saldo: verd "Saldo suficient (X)" o vermell "Saldo insuficient (X)"
     - Botons: ✅ Aprovar | ❌ Rebutjar
     - Botons desactivats si el banc està desconnectat

3. **Taula de comptes bancaris** (amber)
   - Columnes: Nom | TX | Enviat | Rebut | Saldo
   - Saldo és un **input editable** (el professor pot modificar saldos!)
   - Commit on blur o Enter
   - Color vermell si saldo < 0, verd si ≥ 0

#### Columna dreta — Registre de transaccions
- Llista scrollable (max 600px) de totes les TX
- Per cada TX: icona d'estat + `Remitent → Destinatari` + import
  - Pendent: borda esquerra amber
  - Rebutjada: borda esquerra vermella + motiu
  - Aprovada sospitosa: badge vermell "Saldo insuficient"
- Botó ⭐ per destacar

### Accions
| Rol | Acció | API/Funció |
|-----|-------|------------|
| Alumne | Enviar transferència | `sendTransaction()` → `POST /api/transactions` (status: 'pending') |
| Professor | Aprovar TX | `approveTransaction()` → `POST /api/transactions/approve` |
| Professor | Rebutjar TX | `rejectTransaction()` → `POST /api/transactions/reject` |
| Professor | Tancar/obrir banc | `toggleBankDisconnection()` → `POST /api/rooms/bank` |
| Professor | Canviar límit TX | `updateTransferLimit()` → `POST /api/rooms/transfer-limit` |
| Professor | Editar saldo alumne | `updateParticipantCoinFile()` → `POST /api/coin-files` |
| Professor | Destacar TX | `highlightTransaction()` → `POST /api/transactions/highlight` |

### Dades
- `room.isBankDisconnected` — Estat del banc
- `room.maxTransferAmount` — Límit de transferència (default: 5)
- TX amb status `pending`, `approved`, `rejected`
- Saldo calculat des de `participant.coinFile`

---

## Fase 2 — Consens distribuït (Votació)

### Objectiu educatiu
Eliminar l'autoritat central. Les transaccions es proposen i es voten democràticament per tots els participants. Demostrar els avantatges i problemes del consens.

### Fitxers
| Rol | Fitxer |
|-----|--------|
| Alumne | `components/room/phase2-user-interface.tsx` |
| Professor | `components/room/teacher-dashboard.tsx` → secció `currentPhase === 2` |

### Interfície Alumne

**Layout**: Grid 2 columnes.

#### Columna esquerra
1. **Panell "Saldo i formulari de proposta"**
   - Nom + saldo actual
   - Formulari en 1 fila: dropdown remitent + dropdown destinatari + input import + botó enviar
   - El remitent pot ser un altre alumne (proposta falsa!) → avís taronja
   - Feedback de confirmació/error

2. **Panell "Votacions pendents"** (expandible)
   - Botó d'ajuda amb pregunta de reflexió sobre consens
   - Per cada TX en votació:
     - `Remitent → Destinatari: Import`
     - Saldo disponible del remitent
     - Comptadors: ✅ vots a favor | ❌ vots en contra | ⏳ vots pendents
     - Botons de vot (desactivats si ja ha votat)

#### Columna dreta
3. **Panell "Transaccions acceptades"** (verd, scrollable max 300px)
   - Per cada TX: ✅ `Remitent → Destinatari: Import` + recompte de vots

4. **Panell "Transaccions rebutjades"** (vermell, scrollable max 300px)
   - Per cada TX: ❌ `Remitent → Destinatari: Import` + recompte de vots + motiu

### Interfície Professor

**Layout**: Grid 2 columnes (proporció 3fr/2fr).
- Alerta de feedback a la part superior (success/error/warning).

#### Columna esquerra

1. **Formulari de proposta del professor**
   - Títol amb nom del professor + saldo disponible
   - Formulari: dropdown remitent (tots els participants amb saldo) + dropdown destinatari + input import + botó enviar
   - Avís si el remitent no és el professor (proposta falsa)

2. **Panell "Votacions pendents"** (purple, flex-1)
   - Botó d'ajuda amb pregunta de reflexió
   - Per cada TX en votació:
     - `Remitent → Destinatari: Import` + saldo del remitent
     - Comptadors de vots (a favor / en contra / pendents)
     - Botons de vot per al professor (desactivats si ja ha votat)
     - **Botons exclusius professor**: "Forçar acceptar" (emerald) | "Forçar rebutjar" (vermell)
   - Estat buit: "No hi ha votacions pendents"

#### Columna dreta

3. **Panell "Transaccions acceptades"** (verd, scrollable max 300px)
   - Per cada TX: ✅ + detalls + recompte vots

4. **Panell "Transaccions rebutjades"** (vermell, scrollable max 300px)
   - Per cada TX: ❌ + detalls + recompte vots + motiu

### Accions
| Rol | Acció | API/Funció |
|-----|-------|------------|
| Alumne/Professor | Proposar TX | `sendTransaction()` → `POST /api/transactions` (status: 'voting') |
| Alumne/Professor | Votar a favor/contra | `voteOnTransaction()` → `POST /api/transactions/vote` |
| Professor | Forçar acceptar | `forceTransaction(id, 'accept')` → `POST /api/transactions/force` |
| Professor | Forçar rebutjar | `forceTransaction(id, 'reject')` → `POST /api/transactions/force` |

### Dades
- TX amb status `voting`, `approved`, `rejected`
- `tx.votesFor`, `tx.votesAgainst`, `tx.voterIds[]`
- `tx.proposedById` — Qui ha proposat la TX (pot ser diferent del sender)
- Total voters = nombre d'estudiants actius

---

## Fases pendents de documentar

> Afegir documentació aquí quan es finalitzi la implementació de cada fase.

- [ ] Fase 3 — Signatures digitals
- [ ] Fase 4 — Model UTXO
- [ ] Fase 5 — Xarxa i Mempool
- [ ] Fase 6 — Proof of Work
- [ ] Fase 7 — Ajust de dificultat
- [ ] Fase 8 — Incentius econòmics
- [ ] Fase 9 — Simulació lliure
