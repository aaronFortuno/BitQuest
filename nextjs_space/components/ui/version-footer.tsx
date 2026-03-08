'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCommit } from 'lucide-react';

const VERSION = 'v0.4.2';

const CHANGELOG = [
  {
    version: 'v0.4.2',
    date: '2026-03-08',
    changes: {
      ca: [
        'Professor com a participant actiu a Fase 2: pot proposar transaccions (legítimes i fraudulentes)',
        'Dashboard professor reestructurat: 4 panells idèntics a la interfície alumne (2 columnes 60/40)',
        'Select de remitent inclou TOTS els participants per demostrar suplantació d\'identitat',
        'Avís visual quan el professor proposa en nom d\'un altre (identitat falsa)',
        'Botons de vot normal + forçar acceptació/rebuig al panell de votacions pendents',
        'Alumnes veuen l\'admin als selectors de remitent/destinatari',
        'Corregit: TX de l\'admin ja no s\'auto-aproven (majoria compta tots els participants)',
        'Botó de reflexió (?) mogut a "Votacions pendents" (era a "Transaccions acceptades")',
        'Eliminats panells redundants "Activitat dels estudiants" i "Registre de transaccions"',
        'Layout 60/40 a les dues interfícies (professor i alumne) per optimitzar espai',
      ],
      es: [
        'Profesor como participante activo en Fase 2: puede proponer transacciones (legítimas y fraudulentas)',
        'Dashboard profesor reestructurado: 4 paneles idénticos a la interfaz alumno (2 columnas 60/40)',
        'Select de remitente incluye TODOS los participantes para demostrar suplantación de identidad',
        'Aviso visual cuando el profesor propone en nombre de otro (identidad falsa)',
        'Botones de voto normal + forzar aceptación/rechazo en el panel de votaciones pendientes',
        'Alumnos ven al admin en los selectores de remitente/destinatario',
        'Corregido: TX del admin ya no se auto-aprueban (mayoría cuenta todos los participantes)',
        'Botón de reflexión (?) movido a "Votaciones pendientes" (era en "Transacciones aceptadas")',
        'Eliminados paneles redundantes "Actividad de los estudiantes" y "Registro de transacciones"',
        'Layout 60/40 en ambas interfaces (profesor y alumno) para optimizar espacio',
      ],
      en: [
        'Teacher as active participant in Phase 2: can propose transactions (legitimate and fraudulent)',
        'Teacher dashboard restructured: 4 panels identical to student interface (2-column 60/40)',
        'Sender select includes ALL participants to demonstrate identity spoofing',
        'Visual warning when teacher proposes on behalf of another (false identity)',
        'Normal vote buttons + force accept/reject in pending votations panel',
        'Students can see the admin in sender/receiver selectors',
        'Fixed: admin TX no longer auto-approved (majority counts all participants)',
        'Reflection button (?) moved to "Pending votations" (was in "Accepted transactions")',
        'Removed redundant "Student activity" and "Transaction registry" panels',
        '60/40 layout on both interfaces (teacher and student) to optimize space',
      ],
    },
  },
  {
    version: 'v0.4.1',
    date: '2026-03-08',
    changes: {
      ca: [
        'Fase 1 polida i llesta per producció',
        'Reset automàtic de transaccions i saldos en entrar a Fase 1',
        'Saldos editables pel professor a la taula "Comptes del banc"',
        'Panell del banc compactat en 1 fila: botó + límit lliure numèric',
        'Detecció de "Saldo insuficient" corregida (només compta transaccions aprovades)',
        'Badge "Saldo insuficient" al registre de transaccions aprovades sospitoses',
        'Interfície alumne reestructurada: layout 2 columnes (era 3)',
        'Formulari de transferència compacte en 1 fila: selector + import + botó',
        'Transaccions estil bancari: vermell (enviat), verd (rebut), taronja (pendent), gris (rebutjada)',
        'Eliminat panell d\'instruccions redundant a la interfície alumne',
        'Polling reduït de 5s a 2s per actualitzacions més ràpides',
      ],
      es: [
        'Fase 1 pulida y lista para producción',
        'Reset automático de transacciones y saldos al entrar en Fase 1',
        'Saldos editables por el profesor en la tabla "Cuentas del banco"',
        'Panel del banco compactado en 1 fila: botón + límite libre numérico',
        'Detección de "Saldo insuficiente" corregida (solo cuenta transacciones aprobadas)',
        'Badge "Saldo insuficiente" en el registro de transacciones aprobadas sospechosas',
        'Interfaz alumno reestructurada: layout 2 columnas (era 3)',
        'Formulario de transferencia compacto en 1 fila: selector + importe + botón',
        'Transacciones estilo bancario: rojo (enviado), verde (recibido), naranja (pendiente), gris (rechazada)',
        'Eliminado panel de instrucciones redundante en la interfaz alumno',
        'Polling reducido de 5s a 2s para actualizaciones más rápidas',
      ],
      en: [
        'Phase 1 polished and production-ready',
        'Auto-reset transactions and balances when entering Phase 1',
        'Editable balances for teacher in "Bank accounts" table',
        'Bank panel compacted to 1 row: button + numeric free limit',
        'Fixed "Insufficient balance" detection (only counts approved transactions)',
        '"Insufficient balance" badge on suspicious approved transactions',
        'Student interface restructured: 2-column layout (was 3)',
        'Compact transfer form in 1 row: selector + amount + button',
        'Bank-style transactions: red (sent), green (received), orange (pending), grey (rejected)',
        'Removed redundant instructions panel from student interface',
        'Polling reduced from 5s to 2s for faster updates',
      ],
    },
  },
  {
    version: 'v0.4.0',
    date: '2026-03-07',
    changes: {
      ca: [
        'Fase 0 completament jugable i llesta per producció',
        'Mode fosc complet amb paleta zinc i accents amber',
        'Header compacte: controls docent, saldo alumne, instruccions per rol',
        'Dashboard docent: 2 columnes, indicador groc de sobrecost, dark mode',
        'Interfície alumne: layout 2 columnes, editor click-to-edit, auto-save',
        'Instruccions separades: panell lateral (docent) i dropdown (alumne)',
        'Navegació de fases compacta amb accions directes',
        'Selector d\'idioma només icona, barres d\'scroll ocultes',
        'Icona de moneda Font Awesome (fa-cent-sign)',
      ],
      es: [
        'Fase 0 completamente jugable y lista para producción',
        'Modo oscuro completo con paleta zinc y acentos amber',
        'Header compacto: controles docente, saldo alumno, instrucciones por rol',
        'Dashboard docente: 2 columnas, indicador amarillo de sobregasto, dark mode',
        'Interfaz alumno: layout 2 columnas, editor click-to-edit, auto-save',
        'Instrucciones separadas: panel lateral (docente) y dropdown (alumno)',
        'Navegación de fases compacta con acciones directas',
        'Selector de idioma solo icono, barras de scroll ocultas',
        'Icono de moneda Font Awesome (fa-cent-sign)',
      ],
      en: [
        'Phase 0 fully playable and production-ready',
        'Full dark mode with zinc palette and amber accents',
        'Compact header: teacher controls, student balance, role-aware instructions',
        'Teacher dashboard: 2-column layout, yellow overspend indicator, dark mode',
        'Student interface: 2-column layout, click-to-edit editor, auto-save',
        'Separate instructions: side panel (teacher) and dropdown (student)',
        'Compact phase navigation with direct actions',
        'Icon-only language selector, hidden scrollbars',
        'Font Awesome coin icon (fa-cent-sign)',
      ],
    },
  },
  {
    version: 'v0.3.0',
    date: '2026-03-07',
    changes: {
      ca: [
        'Comunicació en temps real amb Socket.io (substitueix HTTP polling)',
        'Servidor custom amb Next.js + Socket.io integrats',
        'Actualitzacions instantànies entre professor i alumnes',
      ],
      es: [
        'Comunicación en tiempo real con Socket.io (sustituye HTTP polling)',
        'Servidor custom con Next.js + Socket.io integrados',
        'Actualizaciones instantáneas entre profesor y alumnos',
      ],
      en: [
        'Real-time communication with Socket.io (replaces HTTP polling)',
        'Custom server with Next.js + Socket.io integrated',
        'Instant updates between teacher and students',
      ],
    },
  },
  {
    version: 'v0.2.0',
    date: '2026-03-07',
    changes: {
      ca: [
        'Migració a in-memory store (eliminat PostgreSQL/Prisma)',
        'Neteja de 39 dependències no usades',
        'Totes les dades són efímeres per sessió educativa',
      ],
      es: [
        'Migración a in-memory store (eliminado PostgreSQL/Prisma)',
        'Limpieza de 39 dependencias no usadas',
        'Todos los datos son efímeros por sesión educativa',
      ],
      en: [
        'Migration to in-memory store (removed PostgreSQL/Prisma)',
        'Cleanup of 39 unused dependencies',
        'All data is ephemeral per educational session',
      ],
    },
  },
  {
    version: 'v0.1.0',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 9: Simulació Lliure i Reptes Finals',
        'Els estudiants poden experimentar amb tots els elements de Bitcoin',
        'Rols: Usuari, Miner o Ambdós amb 100 BTC inicials',
        'Repte 1: Atac del 51% - intentar revertir transaccions',
        'Repte 2: Congestió Extrema - observar el mercat de comissions',
        'Repte 3: Fork - veure com es resolen cadenes competidores',
        'Repte 4: Economia Sostenible - analitzar si les comissions poden mantenir la seguretat',
        'Repte 5: Impacte Ambiental - calcular energia gastada en mineria',
        'Estadístiques globals en temps real per al professor',
        'Registre d\'activitat i rànquing de riquesa',
      ],
      es: [
        'Nueva Fase 9: Simulación Libre y Desafíos Finales',
        'Los estudiantes pueden experimentar con todos los elementos de Bitcoin',
        'Roles: Usuario, Minero o Ambos con 100 BTC iniciales',
        'Desafío 1: Ataque del 51% - intentar revertir transacciones',
        'Desafío 2: Congestión Extrema - observar el mercado de comisiones',
        'Desafío 3: Fork - ver cómo se resuelven cadenas competidoras',
        'Desafío 4: Economía Sostenible - analizar si las comisiones pueden mantener la seguridad',
        'Desafío 5: Impacto Ambiental - calcular energía gastada en minería',
        'Estadísticas globales en tiempo real para el profesor',
        'Registro de actividad y ranking de riqueza',
      ],
      en: [
        'New Phase 9: Free Simulation & Final Challenges',
        'Students can experiment with all Bitcoin elements',
        'Roles: User, Miner or Both with 100 BTC initial balance',
        'Challenge 1: 51% Attack - attempt to reverse transactions',
        'Challenge 2: Extreme Congestion - observe fee market',
        'Challenge 3: Fork - see how competing chains are resolved',
        'Challenge 4: Sustainable Economy - analyze if fees can maintain security',
        'Challenge 5: Environmental Impact - calculate energy spent mining',
        'Real-time global statistics for teacher',
        'Activity log and wealth ranking',
      ],
    },
  },
  {
    version: 'v0.0.9.1',
    date: '2026-02-02',
    changes: {
      ca: [
        'Correccions menors d\'interfície',
        'Canvi de codi d\'idioma: AD → CA per al català',
        'Panell del Banc ara només visible a la Fase 1',
        'Actualització de l\'historial de canvis',
      ],
      es: [
        'Correcciones menores de interfaz',
        'Cambio de código de idioma: AD → CA para catalán',
        'Panel del Banco ahora solo visible en la Fase 1',
        'Actualización del historial de cambios',
      ],
      en: [
        'Minor interface fixes',
        'Language code change: AD → CA for Catalan',
        'Bank Panel now only visible in Phase 1',
        'Changelog update',
      ],
    },
  },
  {
    version: 'v0.0.9',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 8: Halving i Economia de Bitcoin',
        'Recompensa inicial de 50 BTC per bloc',
        'Halving cada 10 blocs (simulat)',
        'Visualització de la corba d\'emissió de Bitcoin',
        'Gràfic de recompenses acumulades vs comissions',
        'Estadístiques econòmiques: BTC en circulació, recompensa actual',
        'Demo: accelerar halvings per veure l\'impacte',
        'Pregunta clau: Què passarà quan les recompenses siguin zero?',
      ],
      es: [
        'Nueva Fase 8: Halving y Economía de Bitcoin',
        'Recompensa inicial de 50 BTC por bloque',
        'Halving cada 10 bloques (simulado)',
        'Visualización de la curva de emisión de Bitcoin',
        'Gráfico de recompensas acumuladas vs comisiones',
        'Estadísticas económicas: BTC en circulación, recompensa actual',
        'Demo: acelerar halvings para ver el impacto',
        'Pregunta clave: ¿Qué pasará cuando las recompensas sean cero?',
      ],
      en: [
        'New Phase 8: Halving and Bitcoin Economics',
        'Initial reward of 50 BTC per block',
        'Halving every 10 blocks (simulated)',
        'Bitcoin emission curve visualization',
        'Cumulative rewards vs fees chart',
        'Economic statistics: BTC in circulation, current reward',
        'Demo: accelerate halvings to see impact',
        'Key question: What will happen when rewards reach zero?',
      ],
    },
  },
  {
    version: 'v0.0.8',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 7: Ajust de Dificultat',
        'La dificultat s\'ajusta cada 10 blocs (configurable)',
        'Temps objectiu per bloc: 30 segons (configurable)',
        'Visualització del període actual i estadístiques',
        'Gràfic d\'historial de dificultats',
        'Ajust automàtic: ↑ si massa ràpid, ↓ si massa lent',
        'Informació detallada de cada període',
        'Pregunta clau: Com mantenim un temps de bloc consistent?',
      ],
      es: [
        'Nueva Fase 7: Ajuste de Dificultad',
        'La dificultad se ajusta cada 10 bloques (configurable)',
        'Tiempo objetivo por bloque: 30 segundos (configurable)',
        'Visualización del período actual y estadísticas',
        'Gráfico de historial de dificultades',
        'Ajuste automático: ↑ si muy rápido, ↓ si muy lento',
        'Información detallada de cada período',
        'Pregunta clave: ¿Cómo mantenemos un tiempo de bloque consistente?',
      ],
      en: [
        'New Phase 7: Difficulty Adjustment',
        'Difficulty adjusts every 10 blocks (configurable)',
        'Target block time: 30 seconds (configurable)',
        'Current period visualization and statistics',
        'Difficulty history chart',
        'Automatic adjustment: ↑ if too fast, ↓ if too slow',
        'Detailed period information',
        'Key question: How do we maintain consistent block times?',
      ],
    },
  },
  {
    version: 'v0.0.7',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 6: Proof of Work (Mineria)',
        'Els estudiants competeixen per trobar un NONCE vàlid',
        'Cada clic incrementa el nonce i calcula un nou hash SHA-256',
        'Objectiu: trobar un hash que comenci amb zeros (dificultat fixa: 2)',
        'El primer que troba un hash vàlid guanya la recompensa (50 BTC)',
        'Panell d\'estat de xarxa: bloc actual, dificultat, miners actius',
        'Zona de mineria: editar nonce, veure hash resultant',
        'Zona d\'enviament: anunciar bloc a la xarxa',
        'Historial i rànquing: blocs minats, recompenses acumulades',
        'Demo: intentar enviar blocs invàlids per veure el rebuig',
        'Pregunta clau: Com evitem que algú inundi la xarxa amb blocs falsos?',
      ],
      es: [
        'Nueva Fase 6: Proof of Work (Minería)',
        'Los estudiantes compiten para encontrar un NONCE válido',
        'Cada clic incrementa el nonce y calcula un nuevo hash SHA-256',
        'Objetivo: encontrar un hash que empiece con ceros (dificultad fija: 2)',
        'El primero que encuentra un hash válido gana la recompensa (50 BTC)',
        'Panel de estado de red: bloque actual, dificultad, mineros activos',
        'Zona de minería: editar nonce, ver hash resultante',
        'Zona de envío: anunciar bloque a la red',
        'Historial y ranking: bloques minados, recompensas acumuladas',
        'Demo: intentar enviar bloques inválidos para ver el rechazo',
        'Pregunta clave: ¿Cómo evitamos que alguien inunde la red con bloques falsos?',
      ],
      en: [
        'New Phase 6: Proof of Work (Mining)',
        'Students compete to find a valid NONCE',
        'Each click increments the nonce and calculates a new SHA-256 hash',
        'Goal: find a hash that starts with zeros (fixed difficulty: 2)',
        'First one to find a valid hash wins the reward (50 BTC)',
        'Network status panel: current block, difficulty, active miners',
        'Mining zone: edit nonce, see resulting hash',
        'Submit zone: announce block to the network',
        'History and ranking: mined blocks, accumulated rewards',
        'Demo: try to submit invalid blocks to see rejection',
        'Key question: How do we prevent someone from flooding the network with fake blocks?',
      ],
    },
  },
  {
    version: 'v0.0.6',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 5: Xarxa de Nodes i Mempool',
        'Cada estudiant representa un node de la xarxa Bitcoin',
        'Visualització de la xarxa amb connexions entre nodes',
        'Simulació de propagació de transaccions en temps real',
        'Mempool local: transaccions rebudes pel teu node',
        'Mempool global: totes les transaccions pendents de confirmació',
        'Demo: desconnectar nodes per veure com afecta la propagació',
        'Demo: omplir el mempool per introduir el concepte de prioritat',
        'Introducció al concepte de comissions (fees)',
        'Pregunta clau: Qui decideix quines transaccions es confirmen?',
      ],
      es: [
        'Nueva Fase 5: Red de Nodos y Mempool',
        'Cada estudiante representa un nodo de la red Bitcoin',
        'Visualización de la red con conexiones entre nodos',
        'Simulación de propagación de transacciones en tiempo real',
        'Mempool local: transacciones recibidas por tu nodo',
        'Mempool global: todas las transacciones pendientes de confirmación',
        'Demo: desconectar nodos para ver cómo afecta la propagación',
        'Demo: llenar el mempool para introducir el concepto de prioridad',
        'Introducción al concepto de comisiones (fees)',
        'Pregunta clave: ¿Quién decide qué transacciones se confirman?',
      ],
      en: [
        'New Phase 5: Node Network and Mempool',
        'Each student represents a node in the Bitcoin network',
        'Network visualization with connections between nodes',
        'Real-time transaction propagation simulation',
        'Local mempool: transactions received by your node',
        'Global mempool: all pending transactions awaiting confirmation',
        'Demo: disconnect nodes to see how it affects propagation',
        'Demo: fill the mempool to introduce the concept of priority',
        'Introduction to the concept of fees',
        'Key question: Who decides which transactions get confirmed?',
      ],
    },
  },
  {
    version: 'v0.0.5',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 4: Model UTXO (Unspent Transaction Outputs)',
        'Cada moneda és una peça única amb identificador (UTXO#A1)',
        'Cada estudiant comença amb 3 UTXOs (10, 5, 2 BTC)',
        'Constructor de transaccions: selecciona inputs i defineix outputs',
        'Sistema de canvi: retorna monedes sobrants a tu mateix',
        'Validació: els outputs no poden superar els inputs',
        'Prevenció del doble pagament: UTXOs gastats es marquen',
        'Registre global de transaccions UTXO',
        'Interfície de 3 zones: cartera, constructor, transaccions globals',
      ],
      es: [
        'Nueva Fase 4: Modelo UTXO (Unspent Transaction Outputs)',
        'Cada moneda es una pieza única con identificador (UTXO#A1)',
        'Cada estudiante empieza con 3 UTXOs (10, 5, 2 BTC)',
        'Constructor de transacciones: selecciona inputs y define outputs',
        'Sistema de cambio: devuelve monedas sobrantes a ti mismo',
        'Validación: los outputs no pueden superar los inputs',
        'Prevención del doble pago: UTXOs gastados se marcan',
        'Registro global de transacciones UTXO',
        'Interfaz de 3 zonas: cartera, constructor, transacciones globales',
      ],
      en: [
        'New Phase 4: UTXO Model (Unspent Transaction Outputs)',
        'Each coin is a unique piece with identifier (UTXO#A1)',
        'Each student starts with 3 UTXOs (10, 5, 2 BTC)',
        'Transaction builder: select inputs and define outputs',
        'Change system: return excess coins to yourself',
        'Validation: outputs cannot exceed inputs',
        'Double spend prevention: spent UTXOs are marked',
        'Global UTXO transaction registry',
        '3-zone interface: wallet, builder, global transactions',
      ],
    },
  },
  {
    version: 'v0.0.4',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 3: Criptografia de clau pública i signatures digitals',
        'Generació de parells de claus (pública/privada) per a cada estudiant',
        'Registre públic de claus visible per tothom',
        'Sistema de signatura de missatges amb hash i clau privada',
        'Verificació de signatures: detecta missatges falsos',
        'Canal públic de missatges signats',
        'Funcionalitat de "missatge fals" pel professor (demo)',
        'Interfície de 4 zones: perfil, registre de claus, editor de missatges, canal públic',
      ],
      es: [
        'Nueva Fase 3: Criptografía de clave pública y firmas digitales',
        'Generación de pares de claves (pública/privada) para cada estudiante',
        'Registro público de claves visible para todos',
        'Sistema de firma de mensajes con hash y clave privada',
        'Verificación de firmas: detecta mensajes falsos',
        'Canal público de mensajes firmados',
        'Funcionalidad de "mensaje falso" para el profesor (demo)',
        'Interfaz de 4 zonas: perfil, registro de claves, editor de mensajes, canal público',
      ],
      en: [
        'New Phase 3: Public key cryptography and digital signatures',
        'Key pair generation (public/private) for each student',
        'Public key registry visible to everyone',
        'Message signing system with hash and private key',
        'Signature verification: detects fake messages',
        'Public channel for signed messages',
        '"Fake message" functionality for teacher (demo)',
        '4-zone interface: profile, key registry, message editor, public channel',
      ],
    },
  },
  {
    version: 'v0.0.3',
    date: '2026-02-02',
    changes: {
      ca: [
        'Nova Fase 2: Consens distribuït (el registre compartit)',
        'Registre compartit visible per tots els participants',
        'Sistema de propostes: qualsevol estudiant pot proposar transaccions',
        'Votació democràtica: tots voten per acceptar o rebutjar',
        'Consens per majoria: >50% dels vots decideix',
        'Possibilitat de proposar transaccions en nom d\'altres (per demostrar problemes d\'autenticació)',
        'Panel de control del professor amb forçar acceptació/rebuig',
        'Estadístiques de participació en votacions',
      ],
      es: [
        'Nueva Fase 2: Consenso distribuido (el registro compartido)',
        'Registro compartido visible para todos los participantes',
        'Sistema de propuestas: cualquier estudiante puede proponer transacciones',
        'Votación democrática: todos votan para aceptar o rechazar',
        'Consenso por mayoría: >50% de los votos decide',
        'Posibilidad de proponer transacciones en nombre de otros (para demostrar problemas de autenticación)',
        'Panel de control del profesor con forzar aceptación/rechazo',
        'Estadísticas de participación en votaciones',
      ],
      en: [
        'New Phase 2: Distributed consensus (shared ledger)',
        'Shared ledger visible to all participants',
        'Proposal system: any student can propose transactions',
        'Democratic voting: everyone votes to accept or reject',
        'Majority consensus: >50% of votes decides',
        'Ability to propose transactions on behalf of others (to demonstrate authentication issues)',
        'Teacher control panel with force accept/reject',
        'Voting participation statistics',
      ],
    },
  },
  {
    version: 'v0.0.2',
    date: '2026-02-02',
    changes: {
      ca: [
        'Simplificació de la Fase 1: el professor fa de Banc',
        'Eliminat el rol de Banc per als estudiants',
        'Límit de transferència de 5 monedes màxim',
        'Missatge "visita l\'oficina" per imports superiors',
        'Instruccions específiques per cada fase al dashboard',
        'Suport multiidioma: Català, Español, English',
        'Selector d\'idioma a tota l\'aplicació',
      ],
      es: [
        'Simplificación de la Fase 1: el profesor hace de Banco',
        'Eliminado el rol de Banco para los estudiantes',
        'Límite de transferencia de 5 monedas máximo',
        'Mensaje "visita la oficina" para importes superiores',
        'Instrucciones específicas para cada fase en el dashboard',
        'Soporte multiidioma: Català, Español, English',
        'Selector de idioma en toda la aplicación',
      ],
      en: [
        'Phase 1 simplification: teacher acts as Bank',
        'Removed Bank role for students',
        'Maximum transfer limit of 5 coins',
        '"Visit office" message for higher amounts',
        'Phase-specific instructions in dashboard',
        'Multi-language support: Català, Español, English',
        'Language selector throughout the app',
      ],
    },
  },
  {
    version: 'v0.0.1.1',
    date: '2026-01-28',
    changes: {
      ca: [
        'Implementació de la Fase 1: Solució centralitzada (el banc)',
        'Sistema de sol·licituds de transaccions',
        'Aprovació/rebuig de transaccions pel Banc',
        'Funcionalitat de desconnectar el Banc (demo)',
        'Millores al footer amb versió i changelog',
        'Canvi de "estudiants" a "peers" a la interfície',
        'Popup d\'ajuda millorat a la landing page',
      ],
      es: [
        'Implementación de la Fase 1: Solución centralizada (el banco)',
        'Sistema de solicitudes de transacciones',
        'Aprobación/rechazo de transacciones por el Banco',
        'Funcionalidad de desconectar el Banco (demo)',
        'Mejoras en el footer con versión y changelog',
        'Cambio de "estudiantes" a "peers" en la interfaz',
        'Popup de ayuda mejorado en la landing page',
      ],
      en: [
        'Phase 1 implementation: Centralized solution (the bank)',
        'Transaction request system',
        'Bank transaction approval/rejection',
        'Bank disconnection feature (demo)',
        'Footer improvements with version and changelog',
        'Changed "students" to "peers" in interface',
        'Improved help popup on landing page',
      ],
    },
  },
  {
    version: 'v0.0.1-rc2',
    date: '2026-01-28',
    changes: {
      ca: [
        'Detecció de transaccions sospitoses al registre',
        'Comptador d\'activitat sospitosa millorat',
        'Indicador de "Saldo insuficient" a les transaccions',
      ],
      es: [
        'Detección de transacciones sospechosas en el registro',
        'Contador de actividad sospechosa mejorado',
        'Indicador de "Saldo insuficiente" en las transacciones',
      ],
      en: [
        'Suspicious transaction detection in registry',
        'Improved suspicious activity counter',
        '"Insufficient balance" indicator on transactions',
      ],
    },
  },
  {
    version: 'v0.0.1-rc1',
    date: '2026-01-28',
    changes: {
      ca: [
        'Correcció del sistema de saldos en transaccions',
        'Actualització automàtica de saldos (sender i receiver)',
        'Suport per saldos negatius',
        'Missatges de feedback millorats amb timeout',
      ],
      es: [
        'Corrección del sistema de saldos en transacciones',
        'Actualización automática de saldos (sender y receiver)',
        'Soporte para saldos negativos',
        'Mensajes de feedback mejorados con timeout',
      ],
      en: [
        'Balance system fix in transactions',
        'Automatic balance update (sender and receiver)',
        'Negative balance support',
        'Improved feedback messages with timeout',
      ],
    },
  },
  {
    version: 'v0.0.1',
    date: '2026-01-28',
    changes: {
      ca: [
        'Llançament inicial de BitQuest',
        'Fase 0: El problema del doble pagament',
        'Sistema de sales amb codis d\'accés',
        'Interfície d\'estudiant amb editor de moneder',
        'Dashboard del professor amb estadístiques',
      ],
      es: [
        'Lanzamiento inicial de BitQuest',
        'Fase 0: El problema del doble gasto',
        'Sistema de salas con códigos de acceso',
        'Interfaz de estudiante con editor de monedero',
        'Dashboard del profesor con estadísticas',
      ],
      en: [
        'Initial BitQuest release',
        'Phase 0: The double spending problem',
        'Room system with access codes',
        'Student interface with wallet editor',
        'Teacher dashboard with statistics',
      ],
    },
  },
];

export default function VersionFooter() {
  const { t, i18n } = useTranslation();
  const [showChangelog, setShowChangelog] = useState(false);

  const getCurrentLangChanges = (changes: { ca: string[]; es: string[]; en: string[] }) => {
    const lang = i18n.language as keyof typeof changes;
    return changes[lang] || changes.ca;
  };

  return (
    <>
      <footer className="py-4 text-center">
        <button
          onClick={() => setShowChangelog(true)}
          className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
        >
          BitQuest {VERSION}
        </button>
      </footer>

      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowChangelog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCommit className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('changelog')}</h2>
                </div>
                <button
                  onClick={() => setShowChangelog(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
                {CHANGELOG.map((release) => (
                  <div key={release.version}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded text-sm font-mono font-medium">
                        {release.version}
                      </span>
                      <span className="text-xs text-gray-400">{release.date}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                      {getCurrentLangChanges(release.changes).map((change, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
