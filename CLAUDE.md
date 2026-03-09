# BitQuest — Context per Claude Code

## Projecte
App educativa Next.js que simula Bitcoin per alumnes de 6è primària (11-12 anys).
UI senzilla, visual, amb mínim text i màxima claredat.

## Treballem a
- Directori: `nextjs_space/`
- Branca: `feature/phase5-network-redesign`
- Pla mestre: `PHASE5-PLAN.md` (arrel del repo) — **LLEGIR SEMPRE PRIMER**

## Estat actual
**Fase 5: Xarxa de Nodes i Mempool** — Pas 7 (polish) en revisió.
L'usuari vol polir les animacions de propagació abans de passar al pas 8.
Veure les "Notes de revisió Pas 7" al PHASE5-PLAN.md per detalls.

## Regles
- Cada pas completat → commit amb descripció en català
- No passar al següent pas sense resoldre problemes actuals
- Documenta progrés al PHASE5-PLAN.md
- Idioma comunicació: català | Codi: anglès
- `npm install --legacy-peer-deps` per conflicte ESLint

## Nota tècnica crítica
**NO usar SVG SMIL `<animate>`** per animacions dinàmiques en React.
Usar `requestAnimationFrame`. SMIL usa el timeline del document (temps des de
page load), no des de la inserció de l'element. Veure memory/bitquest-phase5.md.
