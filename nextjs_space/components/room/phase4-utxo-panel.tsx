'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Wallet, ArrowRight, FileText,
  Shield, Lock, CheckCircle, XCircle, AlertTriangle,
  Fingerprint, RefreshCw, Ban, Radio, Users,
} from 'lucide-react';
import { Participant, Room, UTXO, UTXOTransaction } from '@/lib/types';
import { miniHash, modPow, parsePublicKey, type RSAKeyPair } from '@/lib/crypto';
import { StepCard, AccordionBlock } from '@/components/ui/educational-blocks';

interface Phase4UtxoPanelProps {
  participant: Participant;
  room: Room;
  utxos: UTXO[];
  utxoTransactions: UTXOTransaction[];
  defaultCollapsed?: boolean;
}

function hex(n: number): string {
  return n.toString(16).toUpperCase().padStart(6, '0');
}

export default function Phase4UtxoPanel({
  participant,
  room,
  utxos,
  utxoTransactions,
  defaultCollapsed = false,
}: Phase4UtxoPanelProps) {
  const { t } = useTranslation();
  const [panelCollapsed, setPanelCollapsed] = useState(defaultCollapsed);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set([1]));

  // Double-spend demo state
  const [demoState, setDemoState] = useState<'idle' | 'firstSpend' | 'doubleSpend'>('idle');

  // Load keys from localStorage (same pattern as phase3-user-interface)
  const [localPrivateKey, setLocalPrivateKey] = useState<RSAKeyPair['privateKey'] | null>(null);
  const [localPublicKey, setLocalPublicKey] = useState<{ e: number; n: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && participant.id) {
      const storedPriv = localStorage.getItem(`bitquest_privateKey_${participant.id}`);
      const storedPub = localStorage.getItem(`bitquest_publicKey_${participant.id}`);
      if (storedPriv) setLocalPrivateKey(JSON.parse(storedPriv));
      if (storedPub) setLocalPublicKey(JSON.parse(storedPub));
    }
  }, [participant.id]);

  const hasKeys = !!localPrivateKey && !!localPublicKey;

  // Get student's own UTXOs for Block 1 real data
  const myUtxos = utxos.filter(u => u.ownerId === participant.id && !u.isSpent);
  const myTotalBalance = myUtxos.reduce((sum, u) => sum + u.amount, 0);

  const toggleBlock = (n: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  // Signing demo computation (Block 3)
  const signingDemo = useMemo(() => {
    if (!hasKeys || !localPrivateKey || !localPublicKey) return null;
    const txString = `UTXO#A1 -> Bob:7,Me:3`;
    const hashResult = miniHash(txString);
    const hashDecimal = parseInt(hashResult.hash, 16);
    const hashMod = hashDecimal % localPublicKey.n;
    const signature = Number(modPow(BigInt(hashMod), BigInt(localPrivateKey.d), BigInt(localPublicKey.n)));
    const recovered = Number(modPow(BigInt(signature), BigInt(localPublicKey.e), BigInt(localPublicKey.n)));
    const isValid = recovered === hashMod;
    return { txString, hash: hashResult.hash, hashDecimal, hashMod, signature, recovered, isValid };
  }, [hasKeys, localPrivateKey, localPublicKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="zone-card bg-surface"
    >
      <button
        onClick={() => setPanelCollapsed(!panelCollapsed)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          {t('phase4Panel.title')}
        </h3>
        {panelCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
      </button>

      <AnimatePresence>
      {!panelCollapsed && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
      <div className="space-y-2">
        {/* ═══ Block 1: What is a UTXO? ═══ */}
        <AccordionBlock
          icon={<Wallet className="w-4 h-4 text-amber-400" />}
          label={t('phase4Panel.block1Title')}
          expanded={expandedBlocks.has(1)}
          onToggle={() => toggleBlock(1)}
        >
          <div className="p-4 space-y-4">
            <p className="text-sm text-secondary leading-relaxed">
              {t('phase4Panel.block1Intro')}
            </p>

            {/* Bank vs UTXO comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StepCard
                title={t('phase4Panel.bankModel')}
                tooltip={t('phase4Panel.tooltipBankModel')}
              >
                <div className="space-y-1">
                  <p className="text-xl font-bold text-blue-400">17 BTC</p>
                  <p className="text-xs text-secondary">{t('phase4Panel.bankModelDesc')}</p>
                </div>
              </StepCard>

              <StepCard
                title={t('phase4Panel.utxoModel')}
                tooltip={t('phase4Panel.tooltipUtxoModel')}
              >
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-sm font-bold">10</span>
                    <span className="text-muted">+</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-sm font-bold">5</span>
                    <span className="text-muted">+</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-sm font-bold">2</span>
                    <span className="text-muted">=</span>
                    <span className="font-bold text-amber-400">17</span>
                  </div>
                  <p className="text-xs text-secondary">{t('phase4Panel.utxoModelDesc')}</p>
                </div>
              </StepCard>
            </div>

            {/* Real UTXOs or static example */}
            <div className="mt-3">
              <p className="text-xs text-muted mb-2">{myUtxos.length > 0 ? t('phase4Panel.yourUtxos') : t('phase4Panel.exampleUtxos')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(myUtxos.length > 0 ? myUtxos.slice(0, 3) : [
                  { utxoId: 'UTXO#A1', amount: 10 },
                  { utxoId: 'UTXO#A2', amount: 5 },
                  { utxoId: 'UTXO#A3', amount: 2 },
                ]).map((utxo, i) => (
                  <StepCard
                    key={i}
                    title={utxo.utxoId}
                    tooltip={t('phase4Panel.tooltipUtxoBill')}
                  >
                    <p className="text-2xl font-bold text-amber-400">{utxo.amount} BTC</p>
                  </StepCard>
                ))}
              </div>
              {myUtxos.length > 0 && (
                <p className="text-xs text-amber-400/70 mt-2">
                  {t('phase4Panel.totalLabel')}: <span className="font-bold">{myTotalBalance} BTC</span> ({myUtxos.length} UTXOs)
                </p>
              )}
            </div>
          </div>
        </AccordionBlock>

        {/* Arrow */}
        <div className="flex justify-center">
          <span className="text-2xl text-amber-400">↓</span>
        </div>

        {/* ═══ Block 2: Anatomy of a UTXO transaction ═══ */}
        <AccordionBlock
          icon={<FileText className="w-4 h-4 text-amber-400" />}
          label={t('phase4Panel.block2Title')}
          expanded={expandedBlocks.has(2)}
          onToggle={() => toggleBlock(2)}
        >
          <div className="p-4 space-y-4">
            <p className="text-sm text-secondary leading-relaxed">
              {t('phase4Panel.block2Intro')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StepCard
                title={`1. ${t('phase4Panel.selectInputs')}`}
                tooltip={t('phase4Panel.tooltipSelectInputs')}
              >
                <div className="space-y-1">
                  <p className="text-lg font-bold text-amber-400">UTXO#A1</p>
                  <p className="text-xs text-secondary font-mono">10 BTC</p>
                  <p className="text-xs text-amber-400/70">{t('phase4Panel.inputConsumed')}</p>
                </div>
              </StepCard>

              <StepCard
                title={`2. ${t('phase4Panel.defineOutputs')}`}
                tooltip={t('phase4Panel.tooltipDefineOutputs')}
              >
                <div className="space-y-1">
                  <p className="text-sm font-mono">
                    <span className="text-emerald-400 font-bold">→ Bob: 7 BTC</span>
                  </p>
                  <p className="text-xs text-secondary">{t('phase4Panel.newUtxoCreated')}</p>
                </div>
              </StepCard>

              <StepCard
                title={`3. ${t('phase4Panel.conservation')}`}
                tooltip={t('phase4Panel.tooltipConservation')}
              >
                <div className="space-y-1">
                  <p className="text-sm font-mono">
                    <span className="text-amber-400">10</span>
                    <span className="text-muted"> ≥ </span>
                    <span className="text-emerald-400">7</span>
                    <span className="text-muted"> + </span>
                    <span className="text-blue-400">3</span>
                  </p>
                  <p className="text-xs text-green-400 font-semibold">✓ {t('phase4Panel.conservationOk')}</p>
                </div>
              </StepCard>

              <StepCard
                title={`4. ${t('phase4Panel.change')}`}
                tooltip={t('phase4Panel.tooltipChange')}
              >
                <div className="space-y-1">
                  <p className="text-sm font-mono">
                    <span className="text-blue-400 font-bold">→ Jo: 3 BTC</span>
                  </p>
                  <p className="text-xs text-secondary">{t('phase4Panel.changeExplain')}</p>
                </div>
              </StepCard>
            </div>

            {/* Visual summary */}
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#92400e20', border: '1px solid #92400e40' }}>
              <div className="text-center flex-1">
                <p className="text-xs text-muted">{t('phase4Panel.inputs')}</p>
                <p className="font-mono font-bold text-amber-400">10 BTC</p>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="text-center flex-1">
                <p className="text-xs text-muted">{t('phase4Panel.outputs')}</p>
                <p className="font-mono font-bold text-emerald-400">7 + 3 = 10 BTC</p>
              </div>
            </div>
          </div>
        </AccordionBlock>

        {/* Arrow */}
        <div className={`flex justify-center transition-opacity duration-300 ${hasKeys ? 'opacity-100' : 'opacity-20'}`}>
          <span className="text-2xl text-amber-400">↓</span>
        </div>

        {/* ═══ Block 3: Transaction signature ═══ */}
        <AccordionBlock
          icon={<Fingerprint className="w-4 h-4 text-amber-400" />}
          label={t('phase4Panel.block3Title')}
          expanded={expandedBlocks.has(3)}
          onToggle={() => toggleBlock(3)}
          disabled={!hasKeys}
        >
          <div className="p-4 space-y-4">
            {!hasKeys ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-yellow-300">{t('phase4Panel.noKeysWarning')}</p>
              </div>
            ) : signingDemo ? (
              <>
                <p className="text-sm text-secondary leading-relaxed">
                  {t('phase4Panel.block3Intro')}
                </p>

                {/* TX string */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-muted mb-1">{t('phase4Panel.txString')}</p>
                  <p className="font-mono text-sm text-amber-300">&quot;{signingDemo.txString}&quot;</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Hash step */}
                  <StepCard
                    title={<><Fingerprint className="w-3.5 h-3.5 text-amber-400 inline" /> 1. Hash</>}
                    tooltip={t('phase4Panel.tooltipHash')}
                  >
                    <p className="font-mono text-xl font-bold text-amber-400 mb-1">{signingDemo.hash}</p>
                    <div className="text-xs text-secondary font-mono space-y-0.5">
                      <p>miniHash(&quot;{signingDemo.txString.slice(0, 20)}...&quot;)</p>
                      <p>= {signingDemo.hash} (hex)</p>
                      <p>= {signingDemo.hashDecimal} (dec)</p>
                      <p>mod n = {signingDemo.hashMod}</p>
                    </div>
                  </StepCard>

                  {/* Sign step */}
                  <StepCard
                    title={<><Lock className="w-3.5 h-3.5 text-red-400 inline" /> 2. {t('phase4Panel.signStep')}</>}
                    tooltip={t('phase4Panel.tooltipSign')}
                  >
                    <p className="font-mono text-xl font-bold text-red-300 mb-1">{signingDemo.signature}</p>
                    <div className="text-xs text-secondary font-mono space-y-0.5">
                      <p>{signingDemo.hashMod}<sup>d={localPrivateKey!.d}</sup> mod {localPublicKey!.n}</p>
                      <p>= {signingDemo.signature}</p>
                    </div>
                  </StepCard>

                  {/* Verify step */}
                  <StepCard
                    title={<><Shield className="w-3.5 h-3.5 text-emerald-400 inline" /> 3. {t('phase4Panel.verifyStep')}</>}
                    tooltip={t('phase4Panel.tooltipVerify')}
                  >
                    <p className="font-mono text-xl font-bold text-emerald-300 mb-1">{signingDemo.recovered}</p>
                    <div className="text-xs text-secondary font-mono space-y-0.5">
                      <p>{signingDemo.signature}<sup>e={localPublicKey!.e}</sup> mod {localPublicKey!.n}</p>
                      <p>= {signingDemo.recovered}</p>
                    </div>
                  </StepCard>

                  {/* Result */}
                  <StepCard
                    title={`4. ${t('phase4Panel.resultStep')}`}
                    tooltip={t('phase4Panel.tooltipResult')}
                  >
                    <div className={`flex items-center gap-2 text-lg font-semibold ${signingDemo.isValid ? 'text-green-400' : 'text-red-400'}`}>
                      {signingDemo.isValid ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      {signingDemo.isValid ? t('phase4Panel.signatureValid') : t('phase4Panel.signatureInvalid')}
                    </div>
                    <p className="text-xs text-secondary font-mono mt-1">
                      {signingDemo.recovered} {signingDemo.isValid ? '===' : '!=='} {signingDemo.hashMod}
                    </p>
                  </StepCard>
                </div>
              </>
            ) : null}
          </div>
        </AccordionBlock>

        {/* Arrow */}
        <div className="flex justify-center">
          <span className="text-2xl text-amber-400">↓</span>
        </div>

        {/* ═══ Block 4: Double-spend protection ═══ */}
        <AccordionBlock
          icon={<Shield className="w-4 h-4 text-amber-400" />}
          label={t('phase4Panel.block4Title')}
          expanded={expandedBlocks.has(4)}
          onToggle={() => toggleBlock(4)}
        >
          <div className="p-4 space-y-4">
            <p className="text-sm text-secondary leading-relaxed">
              {t('phase4Panel.block4Intro')}
            </p>

            {/* Key insight: why not just flip isSpent back? */}
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-4 h-4 text-purple-400" />
                <p className="text-sm font-medium text-purple-300">{t('phase4Panel.whyNotFlip')}</p>
              </div>
              <p className="text-xs text-purple-300/80 leading-relaxed">
                {t('phase4Panel.whyNotFlipExplain')}
              </p>
            </div>

            {/* Visual: broadcast propagation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StepCard
                title={<><Lock className="w-3.5 h-3.5 text-amber-400 inline" /> 1. {t('phase4Panel.stepSign')}</>}
                tooltip={t('phase4Panel.tooltipStepSign')}
              >
                <p className="font-mono text-sm text-amber-300">TX#1 signed</p>
                <p className="text-xs text-secondary mt-1">{t('phase4Panel.stepSignDesc')}</p>
              </StepCard>

              <StepCard
                title={<><Radio className="w-3.5 h-3.5 text-blue-400 inline" /> 2. {t('phase4Panel.stepBroadcast')}</>}
                tooltip={t('phase4Panel.tooltipStepBroadcast')}
              >
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3].map(i => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-xs">
                      Node {i}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-secondary mt-1">{t('phase4Panel.stepBroadcastDesc')}</p>
              </StepCard>

              <StepCard
                title={<><Users className="w-3.5 h-3.5 text-emerald-400 inline" /> 3. {t('phase4Panel.stepConsensus')}</>}
                tooltip={t('phase4Panel.tooltipStepConsensus')}
              >
                <div className="space-y-0.5 mt-1">
                  {[1,2,3].map(i => (
                    <p key={i} className="text-xs font-mono text-emerald-300">
                      Node {i}: UTXO#A1 → <span className="text-red-400">spent</span>
                    </p>
                  ))}
                </div>
              </StepCard>
            </div>

            {/* Diagram: valid vs rejected */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <p className="font-medium text-emerald-400">{t('phase4Panel.firstSpendTitle')}</p>
                </div>
                <p className="font-mono text-sm text-emerald-300">UTXO#A1 → TX#1 ✅</p>
                <p className="text-xs text-emerald-400/70 mt-1">{t('phase4Panel.firstSpendDesc')}</p>
              </div>

              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <p className="font-medium text-red-400">{t('phase4Panel.doubleSpendTitle')}</p>
                </div>
                <p className="font-mono text-sm text-red-300">UTXO#A1 → TX#2 ❌</p>
                <p className="text-xs text-red-400/70 mt-1">{t('phase4Panel.doubleSpendDesc')}</p>
              </div>
            </div>

            {/* Interactive demo */}
            <div className="mt-4 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <p className="text-sm font-medium text-body mb-3">{t('phase4Panel.demoTitle')}</p>

              {demoState === 'idle' && (
                <button
                  onClick={() => setDemoState('firstSpend')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                >
                  {t('phase4Panel.demoSpend')}
                </button>
              )}

              {demoState === 'firstSpend' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <StepCard
                    title={t('phase4Panel.demoCheckUtxo')}
                    tooltip={t('phase4Panel.tooltipDemoCheck')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-sm">UTXO#A1</span>
                      <span className="text-xs text-emerald-400 font-semibold">isSpent: false ✓</span>
                    </div>
                  </StepCard>

                  <StepCard
                    title={t('phase4Panel.demoTxCreated')}
                    tooltip={t('phase4Panel.tooltipDemoTx')}
                  >
                    <p className="font-mono text-sm text-emerald-300">TX#1: UTXO#A1 (10 BTC) → Bob: 7, Jo: 3</p>
                    <p className="text-xs text-emerald-400 font-semibold mt-1">✅ {t('phase4Panel.demoTxValid')}</p>
                  </StepCard>

                  <StepCard
                    title={<><Radio className="w-3.5 h-3.5 text-blue-400 inline" /> {t('phase4Panel.demoBroadcastStep')}</>}
                    tooltip={t('phase4Panel.tooltipDemoBroadcast')}
                  >
                    <div className="space-y-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-blue-300">Node {i}:</span>
                          <span className="text-xs text-red-400 font-semibold">UTXO#A1 → spent</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-blue-400/70 mt-1">{t('phase4Panel.demoBroadcastDesc')}</p>
                  </StepCard>

                  <button
                    onClick={() => setDemoState('doubleSpend')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                  >
                    {t('phase4Panel.demoDoubleSpend')}
                  </button>
                </motion.div>
              )}

              {demoState === 'doubleSpend' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Previous TX summary */}
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-emerald-400">TX#1: UTXO#A1 → Bob: 7, Jo: 3 ✅ ({t('phase4Panel.demoAllNodesKnow')})</p>
                  </div>

                  {/* Double spend attempt */}
                  <StepCard
                    title={<><Ban className="w-3.5 h-3.5 text-red-400 inline" /> {t('phase4Panel.demoCheckAgain')}</>}
                    tooltip={t('phase4Panel.tooltipDemoCheckAgain')}
                  >
                    <div className="space-y-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">Node {i}:</span>
                          <span className="text-xs text-red-400 font-semibold">UTXO#A1 isSpent: true ✗</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-red-400/70 mt-1">{t('phase4Panel.demoAllNodesReject')}</p>
                  </StepCard>

                  <StepCard
                    title={t('phase4Panel.demoRejected')}
                    tooltip={t('phase4Panel.tooltipDemoRejected')}
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="w-6 h-6 text-red-400" />
                      <div>
                        <p className="text-sm font-semibold text-red-400">{t('phase4Panel.demoTxRejected')}</p>
                        <p className="text-xs text-red-400/70">{t('phase4Panel.demoRejectedReason')}</p>
                      </div>
                    </div>
                  </StepCard>

                  <button
                    onClick={() => setDemoState('idle')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('phase4Panel.demoReset')}
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </AccordionBlock>
      </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
