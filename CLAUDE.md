# BitQuest — Context per Claude Code

## Projecte
App educativa Next.js que simula Bitcoin per alumnes de 6è primària (11-12 anys).
UI senzilla, visual, amb mínim text i màxima claredat.

## Treballem a
- Directori: `nextjs_space/`
- Branca: `refactor-unstable`

## Estat actual
**Refactorització completada** — Fases 0-8 del REFACTOR-PLAN.md executades.
- Socket.io eliminat, codi mort netejat
- RoomContext amb `useRoom()` — 0 props per components
- Teacher Dashboard descompost en 10 sub-components per fase
- Store descompost en 7 mòduls per domini
- blocks/route.ts descompost en 11 accions
- i18n extret a JSON (ca/es/en)
- Changelog extret a JSON, version-footer reescrit (~88 línies)
- 9 fitxers de test, 117 tests

## Arquitectura post-refactor
```
contexts/room-context.tsx    — RoomProvider + useRoom() hook
hooks/use-room-polling.ts    — God hook (1820 línies, font única de dades)
components/room/teacher/     — 10 sub-components per fase + orquestrador
lib/store/                   — 7 mòduls (room, tx, block, network, crypto, phase9, types)
lib/actions/blocks/          — 11 accions + mining-utils
lib/i18n/                    — index.ts + ca.json + es.json + en.json
lib/changelog.json           — Changelog en JSON
lib/api-client.ts            — ApiResult<T> pattern
lib/balance-utils.ts         — getBalance, updateBalance compartits
lib/transaction-utils.ts     — Utilitats de transaccions
```

## Regles
- Idioma comunicació: català | Codi: anglès
- `npm install --legacy-peer-deps` per conflicte ESLint
- Components usen `useRoom()` — no prop drilling
- NO usar SVG SMIL `<animate>` — usar requestAnimationFrame
