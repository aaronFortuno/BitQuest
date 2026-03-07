# BitQuest - Simulador Educatiu de Bitcoin

BitQuest es un simulador educatiu interactiu dissenyat per ensenyar els fonaments de Bitcoin i la tecnologia blockchain a estudiants de secundaria (11-18 anys). A traves de 10 fases progressives, els alumnes descobreixen per que existeix Bitcoin resolent problemes reals de manera practica.

## Arquitectura

```
┌───────────────────────────────────┐
│         Next.js 14 (App Router)   │
│  ┌─────────────┬────────────────┐ │
│  │  React UI   │  API Routes    │ │
│  │  (Client)   │  (Server)      │ │
│  │             │                │ │
│  │  Components │  /api/rooms    │ │
│  │  Hooks      │  /api/blocks   │ │
│  │  i18n       │  /api/mempool  │ │
│  │  Zustand    │  /api/keys     │ │
│  │             │  /api/utxos    │ │
│  │             │  /api/...      │ │
│  └──────┬──────┴───────┬────────┘ │
│         │   Polling 2s │          │
│         └──────────────┘          │
│                │                  │
│         Prisma ORM                │
│                │                  │
│         PostgreSQL                │
└───────────────────────────────────┘
```

- **Frontend**: React 18 + TypeScript + TailwindCSS + Radix UI + Framer Motion
- **Backend**: Next.js API Routes (serverless)
- **Base de dades**: PostgreSQL amb Prisma ORM
- **Sincronitzacio**: HTTP polling cada 2 segons (infraestructura Socket.io present pero no activa)
- **i18n**: Catala (ca) i Angles (en) amb i18next
- **Criptografia**: Web Crypto API / crypto-js (SHA-256, RSA simplificat, signatures digitals)

## Fases educatives

| Fase | Tema | Concepte clau |
|------|------|---------------|
| 0 | El problema del doble pagament | Per que no podem copiar diners digitals? |
| 1 | Solucio centralitzada (Banc) | Un "banc" valida transaccions - punt unic de fallada |
| 2 | Consens distribuit | Votacio entre nodes per validar transaccions |
| 3 | Signatures digitals | Claus publica/privada, signatura i verificacio |
| 4 | Model UTXO | Inputs/outputs de transaccions, canvi |
| 5 | Xarxa de nodes i Mempool | Propagacio de transaccions, topologia de xarxa |
| 6 | Proof of Work (Mineria) | Trobar hash valid amb N zeros inicials |
| 7 | Ajust de dificultat | Regulacio automatica per mantenir temps de bloc |
| 8 | Incentius economics | Recompenses de bloc, fees, halving |
| 9 | Simulacio lliure | Reptes oberts: atac 51%, congestio, forks... |

## Estructura del projecte

```
BitQuest/
├── nextjs_space/                    # Aplicacio principal
│   ├── app/
│   │   ├── page.tsx                 # Landing page (crear/unir-se a sala)
│   │   ├── room/[code]/page.tsx     # Pagina de sala (routing dinamic)
│   │   └── api/                     # 21 endpoints API
│   │       ├── rooms/               # CRUD sales + join + phase + reset + bank
│   │       ├── transactions/        # Transaccions fases 0-2 + votacio + force
│   │       ├── keys/                # Generacio claus (fase 3)
│   │       ├── messages/            # Missatges signats + verificacio + fake
│   │       ├── utxos/               # Gestio UTXOs (fase 4)
│   │       ├── utxo-transactions/   # Transaccions UTXO (fase 4)
│   │       ├── mempool/             # Mempool (fase 5)
│   │       ├── node-connections/    # Topologia xarxa (fase 5)
│   │       ├── blocks/              # Mineria + blockchain (fases 6-8)
│   │       ├── simulation/          # Simulacio lliure (fase 9)
│   │       └── socketio/            # Handler Socket.io
│   ├── components/
│   │   ├── room/                    # Components per fase
│   │   │   ├── student-interface.tsx       # Fase 0
│   │   │   ├── bank-interface.tsx          # Fase 1 (rol banc)
│   │   │   ├── phase1-user-interface.tsx   # Fase 1
│   │   │   ├── phase2-user-interface.tsx   # Fase 2
│   │   │   ├── phase3-user-interface.tsx   # Fase 3
│   │   │   ├── phase4-user-interface.tsx   # Fase 4
│   │   │   ├── phase5-user-interface.tsx   # Fase 5
│   │   │   ├── phase6-user-interface.tsx   # Fases 6-7
│   │   │   ├── phase8-user-interface.tsx   # Fase 8
│   │   │   ├── phase9-user-interface.tsx   # Fase 9
│   │   │   ├── teacher-dashboard.tsx       # Panel del professor (1700+ linies)
│   │   │   ├── header.tsx                  # Capcalera amb info sala
│   │   │   └── phase-navigation.tsx        # Navegacio entre fases
│   │   └── ui/                      # Components UI reutilitzables (Radix)
│   ├── hooks/
│   │   └── use-room-polling.ts      # Hook principal de sincronitzacio (1000+ linies)
│   ├── lib/
│   │   ├── types.ts                 # Interficies TypeScript completes
│   │   ├── i18n.ts                  # Traduccions CA/EN
│   │   ├── db.ts                    # Client Prisma
│   │   ├── room-utils.ts            # Utilitats de sala
│   │   └── socket.ts                # Client Socket.io
│   ├── prisma/
│   │   └── schema.prisma            # 9 models: Room, Participant, Transaction,
│   │                                # SignedMessage, UTXO, UTXOTransaction,
│   │                                # MempoolTransaction, NodeConnection, Block
│   ├── .env                         # DATABASE_URL (PostgreSQL)
│   ├── package.json                 # ~130 dependencies
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
└── .prompts-abacus/                 # Documentacio de disseny original
    ├── Prompt integre.md            # Especificacio mestra completa
    └── Fase 0-9.txt                 # Especificacions per fase
```

## Model de sessio

1. El **professor** crea una sala i obte un codi d'acces (format `XXX-XXX`)
2. Els **alumnes** s'uneixen amb el codi
3. El professor controla quina fase esta activa
4. Tots els participants comparteixen el mateix estat de blockchain
5. Dades en memoria del servidor (PostgreSQL), sincronitzades via polling HTTP

## Requisits

- **Node.js** >= 18
- **PostgreSQL** (o servei compatible)
- **npm** o **yarn**

## Instal·lacio i execucio local

```bash
cd nextjs_space
npm install              # o yarn install
npx prisma generate      # Generar client Prisma
npx prisma db push       # Sincronitzar esquema a BD
npm run dev              # Iniciar servidor de desenvolupament (port 3000)
```

## Variables d'entorn

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

## Desplegament

El projecte esta dissenyat per funcionar com una aplicacio Next.js full-stack:

- **Opcio actual**: Servidor Node.js amb PostgreSQL (Render.com, Railway, Fly.io...)
- **Frontend**: Podria exportar-se a GitHub Pages com a SPA, pero requereix un backend separat per a les API Routes i la BD

## Estat d'implementacio

~85-90% completat. Totes les 10 fases tenen logica de backend i interficies d'usuari funcionals. Consulta [UPDATE-PLAN.md](./UPDATE-PLAN.md) per als passos restants.

## Llicencia

Projecte educatiu.
