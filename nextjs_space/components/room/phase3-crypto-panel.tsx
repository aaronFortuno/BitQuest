'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Dice2, Dice5, Key, Lock, Unlock,
  Shield, CheckCircle, XCircle, Fingerprint, KeyRound,
  ArrowRight,
} from 'lucide-react';
import {
  TINY_PRIMES, isPrime, gcd, findAllPublicExponents,
  modInverse, miniHash, modPow, HASH_K, HASH_INIT,
  randomPrimeInRange,
  type HashStep,
} from '@/lib/crypto';
import { StepCard, AccordionBlock } from '@/components/ui/educational-blocks';

// StepCard and AccordionBlock imported from @/components/ui/educational-blocks

// ─── Helper: show candidate e values with ✓/✗ ───
function CandidateList({ candidates, phi, chosen }: { candidates: number[]; phi: number; chosen: number }) {
  const toShow = candidates.slice(0, 5);
  return (
    <div className="mt-1.5 space-y-0.5">
      {toShow.map(c => {
        const g = gcd(c, phi);
        const ok = g === 1;
        const isCurrent = c === chosen;
        return (
          <p key={c} className={`text-xs font-mono ${isCurrent ? 'font-bold' : ''} ${ok ? 'text-green-500' : 'text-red-400'}`}>
            gcd({c}, {phi}) = {g} {ok ? '✓' : '✗'}
            {isCurrent && <span className="text-emerald-300"> ← e</span>}
          </p>
        );
      })}
      {candidates.length > 5 && (
        <p className="text-xs text-muted">+{candidates.length - 5} més...</p>
      )}
    </div>
  );
}

// ─── Helper: hex display ───
function hex(n: number): string {
  return n.toString(16).toUpperCase().padStart(6, '0');
}

// ─── Hash step navigator ───
function HashStepView({ message }: { message: string }) {
  const { t } = useTranslation();
  const [viewStep, setViewStep] = useState(0);

  // Recompute step index when message changes
  useEffect(() => {
    setViewStep(Math.max(0, message.length - 1));
  }, [message.length]);

  const hashResult = useMemo(() => miniHash(message), [message]);

  const currentStep = hashResult.steps[viewStep];
  const prevState = viewStep === 0 ? HASH_INIT : hashResult.steps[viewStep - 1].addK;
  const kIndex = viewStep % HASH_K.length;
  const kValue = HASH_K[kIndex];
  const substring = message.slice(0, viewStep + 1);

  return (
    <div className="space-y-4">
      {/* Initial state explanation */}
      <StepCard
        title={t('phase3.hashInitialState')}
        tooltip={t('phase3.tooltipHashInit')}
      >
        <p className="font-mono text-xl font-bold text-indigo-400">{hex(HASH_INIT)}</p>
        <p className="text-xs text-secondary mt-1">{t('phase3.hashInitExplain')}</p>
      </StepCard>

      {/* Step navigator: show the substring being built */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-secondary">{t('phase3.hashRoundLabel')}:</span>
        <div className="flex gap-1 flex-wrap">
          {message.split('').map((char, i) => (
            <button
              key={i}
              onClick={() => setViewStep(i)}
              className={`w-8 h-8 rounded text-sm font-mono font-bold transition-all ${
                i === viewStep
                  ? 'bg-amber-500 text-white scale-110 shadow-lg'
                  : i < viewStep
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-surface text-muted border border-default'
              }`}
            >
              {char}
            </button>
          ))}
        </div>
      </div>

      {/* Current substring display */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#1e1b4b30' }}>
        <span className="text-xs text-muted">{t('phase3.hashProcessing')}:</span>
        <span className="font-mono text-sm">
          {substring.split('').map((ch, i) => (
            <span
              key={i}
              className={i === viewStep ? 'text-amber-400 font-bold' : 'text-indigo-300'}
            >
              {ch}
            </span>
          ))}
        </span>
      </div>

      {/* Computation StepCards for current round */}
      {currentStep && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1: Previous state + ASCII code */}
          <StepCard
            title={`1. ${t('phase3.hashCharCode')}`}
            tooltip={t('phase3.tooltipHashAscii')}
          >
            <div className="space-y-1">
              <p className="text-xs text-secondary">
                &quot;{currentStep.char}&quot; → ASCII
              </p>
              <p className="text-xl font-bold text-amber-400">{currentStep.charCode}</p>
              <p className="text-xs font-mono text-secondary">
                {currentStep.charCode} × 0x1F3D = {hex(currentStep.charCode * 0x1F3D & 0xFFFFFF)}
              </p>
            </div>
          </StepCard>

          {/* Step 2: XOR mix */}
          <StepCard
            title={`2. ${t('phase3.hashStepXor')}`}
            tooltip={t('phase3.tooltipHashXor')}
          >
            <p className="text-xl font-bold text-yellow-400 mb-1">{hex(currentStep.mix)}</p>
            <div className="text-xs font-mono text-secondary space-y-0.5">
              <p>{hex(prevState)} ⊕ {hex(currentStep.charCode * 0x1F3D & 0xFFFFFF)}</p>
              <p>= {hex(currentStep.mix)}</p>
            </div>
          </StepCard>

          {/* Step 3: Rotate bits */}
          <StepCard
            title={`3. ${t('phase3.hashStepRotate')}`}
            tooltip={t('phase3.tooltipHashRotate')}
          >
            <p className="text-xl font-bold text-orange-400 mb-1">{hex(currentStep.rotate)}</p>
            <p className="text-xs font-mono text-secondary">
              {hex(currentStep.mix)} ⟲ 7 bits
            </p>
          </StepCard>

          {/* Step 4: Add constant K */}
          <StepCard
            title={`4. ${t('phase3.hashStepAddK')}`}
            tooltip={t('phase3.tooltipHashAddK')}
          >
            <p className="text-xl font-bold text-emerald-400 mb-1">{hex(currentStep.addK)}</p>
            <div className="text-xs font-mono text-secondary space-y-0.5">
              <p>{hex(currentStep.rotate)} + K[{kIndex}]</p>
              <p>= {hex(currentStep.rotate)} + {hex(kValue)}</p>
              <p>= {hex(currentStep.addK)}</p>
            </div>
          </StepCard>
        </div>
      )}

      {/* State progression bar */}
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        <div className="flex items-center gap-1 text-xs font-mono whitespace-nowrap">
          <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300">{hex(HASH_INIT)}</span>
          {hashResult.steps.map((step, i) => (
            <span key={i} className="flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-muted flex-shrink-0" />
              <span
                className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                  i === viewStep
                    ? 'bg-emerald-500/30 text-emerald-300 font-bold ring-1 ring-emerald-500/50'
                    : i < viewStep
                    ? 'bg-surface text-secondary'
                    : 'bg-surface text-muted'
                }`}
                onClick={() => setViewStep(i)}
              >
                {hex(step.addK)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Final hash result */}
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#064e3b40', border: '1px solid #10b98140' }}>
        <div>
          <p className="text-xs text-muted mb-0.5">{t('phase3.hashFinalResult')}</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#34d399' }}>{hashResult.hash}</p>
        </div>
        <p className="text-xs max-w-[14rem] leading-relaxed" style={{ color: '#6ee7b7' }}>
          {t('phase3.hashTryChanging')}
        </p>
      </div>
    </div>
  );
}

export default function Phase3CryptoPanel({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  const { t } = useTranslation();
  const [p, setP] = useState('');
  const [q, setQ] = useState('');
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set([1]));
  const [eIndex, setEIndex] = useState(0);
  const [demoMessage, setDemoMessage] = useState('');
  const [panelCollapsed, setPanelCollapsed] = useState(defaultCollapsed);

  const toggleBlock = (n: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  // Small primes: 1-2 digits (2–97)
  const randomSmallPrime = () => TINY_PRIMES[Math.floor(Math.random() * TINY_PRIMES.length)];
  // Large primes: 3-6 digits (100–999999)
  const randomLargePrime = () => randomPrimeInRange(100, 999999);

  const pNum = p ? parseInt(p, 10) : null;
  const qNum = q ? parseInt(q, 10) : null;
  const pValid = pNum !== null && !isNaN(pNum) && isPrime(pNum);
  const qValid = qNum !== null && !isNaN(qNum) && isPrime(qNum);

  const ALL_E_CANDIDATES = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

  const steps = useMemo(() => {
    if (!pValid || !qValid || pNum === qNum) return null;
    const n = pNum! * qNum!;
    const phi = (pNum! - 1) * (qNum! - 1);
    const allE = findAllPublicExponents(phi);
    if (allE.length === 0) return null;
    const chosenE = allE[eIndex % allE.length];
    const d = modInverse(chosenE, phi);
    if (!d) return null;
    return { n, phi, e: chosenE, d, allE };
  }, [pNum, qNum, pValid, qValid, eIndex]);

  const handlePChange = useCallback((val: string) => {
    setP(val);
    setEIndex(Math.floor(Math.random() * 19));
  }, []);
  const handleQChange = useCallback((val: string) => {
    setQ(val);
    setEIndex(Math.floor(Math.random() * 19));
  }, []);

  // Hash computation
  const hashResult = useMemo(() => {
    if (!demoMessage.trim()) return null;
    return miniHash(demoMessage);
  }, [demoMessage]);

  // Sign + verify (needs both keys and hash)
  const signVerify = useMemo(() => {
    if (!steps || !hashResult) return null;
    const hashDecimal = parseInt(hashResult.hash, 16);
    const hashMod = hashDecimal % steps.n;
    const signature = Number(modPow(BigInt(hashMod), BigInt(steps.d), BigInt(steps.n)));
    const recovered = Number(modPow(BigInt(signature), BigInt(steps.e), BigInt(steps.n)));
    const isValid = recovered === hashMod;
    return { hash: hashResult.hash, hashDecimal, hashMod, signature, recovered, isValid };
  }, [steps, hashResult]);

  // Activation states
  const block1Active = true;
  const block2Active = !!steps;
  const block3Active = !!steps;
  const block4Active = !!steps && !!hashResult;

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
          <Key className="w-5 h-5" />
          {t('phase3.publicKeyCrypto')}
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
        {/* ═══ Block 1: Choose primes ═══ */}
        <AccordionBlock
          icon={<Dice5 className="w-4 h-4 text-indigo-400" />}
          label={t('phase3.choosePrimes')}
          expanded={expandedBlocks.has(1)}
          onToggle={() => toggleBlock(1)}
          disabled={!block1Active}
        >
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-secondary whitespace-nowrap min-w-[2rem]">p =</label>
                <input
                  type="number"
                  value={p}
                  onChange={(e) => handlePChange(e.target.value)}
                  placeholder={t('phase3.enterPrime')}
                  className="input-field w-32 text-center py-1.5"
                />
                <button
                  onClick={() => handlePChange(String(randomSmallPrime()))}
                  className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors"
                  title={t('phase3.randomSmall')}
                >
                  <Dice2 className="w-4 h-4 text-indigo-400" />
                </button>
                <button
                  onClick={() => handlePChange(String(randomLargePrime()))}
                  className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors"
                  title={t('phase3.randomLarge')}
                >
                  <Dice5 className="w-4 h-4 text-indigo-400" />
                </button>
                {p && (
                  <span className={`text-xs font-medium whitespace-nowrap ${pValid ? 'text-green-500' : 'text-red-500'}`}>
                    {pValid ? `\u2705 ${t('phase3.isPrimeLabel')}` : `\u274C ${t('phase3.notPrime')}`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-secondary whitespace-nowrap min-w-[2rem]">q =</label>
                <input
                  type="number"
                  value={q}
                  onChange={(e) => handleQChange(e.target.value)}
                  placeholder={t('phase3.enterPrime')}
                  className="input-field w-32 text-center py-1.5"
                />
                <button
                  onClick={() => {
                    let newQ: number;
                    do { newQ = randomSmallPrime(); } while (pNum !== null && newQ === pNum);
                    handleQChange(String(newQ));
                  }}
                  className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors"
                  title={t('phase3.randomSmall')}
                >
                  <Dice2 className="w-4 h-4 text-indigo-400" />
                </button>
                <button
                  onClick={() => {
                    let newQ: number;
                    do { newQ = randomLargePrime(); } while (pNum !== null && newQ === pNum);
                    handleQChange(String(newQ));
                  }}
                  className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors"
                  title={t('phase3.randomLarge')}
                >
                  <Dice5 className="w-4 h-4 text-indigo-400" />
                </button>
                {q && (
                  <span className={`text-xs font-medium whitespace-nowrap ${qValid ? 'text-green-500' : 'text-red-500'}`}>
                    {qValid ? `\u2705 ${t('phase3.isPrimeLabel')}` : `\u274C ${t('phase3.notPrime')}`}
                  </span>
                )}
              </div>
            </div>

            {pNum === qNum && pNum !== null && (
              <p className="text-xs text-red-400">p i q han de ser diferents</p>
            )}

            {pValid && qValid && pNum !== qNum && steps && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StepCard title="n = p × q" tooltip={t('phase3.tooltipN')}>
                  <p className="text-xl font-bold text-indigo-400 mb-1">{steps.n}</p>
                  <p className="text-xs text-secondary font-mono">{pNum} × {qNum} = {steps.n}</p>
                </StepCard>

                <StepCard title={`φ(n) — ${t('phase3.eulerTotient')}`} tooltip={t('phase3.tooltipPhi')}>
                  <p className="text-xl font-bold text-purple-400 mb-1">{steps.phi}</p>
                  <div className="text-xs text-secondary font-mono space-y-0.5">
                    <p>p−1 = {pNum! - 1}</p>
                    <p>q−1 = {qNum! - 1}</p>
                    <p>{pNum! - 1} × {qNum! - 1} = {steps.phi}</p>
                  </div>
                </StepCard>

                <StepCard title={`${t('phase3.publicExponent')} (e)`} tooltip={t('phase3.tooltipE')}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xl font-bold text-emerald-400">{steps.e}</p>
                    {steps.allE.length > 1 && (
                      <button
                        onClick={() => setEIndex(prev => prev + 1)}
                        className="p-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded transition-colors"
                        title={`${steps.allE.length} candidats vàlids`}
                      >
                        <Dice5 className="w-3 h-3 text-emerald-400" />
                      </button>
                    )}
                  </div>
                  <CandidateList candidates={ALL_E_CANDIDATES} phi={steps.phi} chosen={steps.e} />
                </StepCard>

                <StepCard title={`${t('phase3.modularInverse')} (d)`} tooltip={t('phase3.tooltipD')}>
                  <p className="text-xl font-bold text-red-400 mb-1">{steps.d}</p>
                  <div className="text-xs text-secondary font-mono space-y-0.5">
                    <p>d × e = {steps.d} × {steps.e} = {steps.d * steps.e}</p>
                    <p>{steps.d * steps.e} mod {steps.phi} = {(steps.d * steps.e) % steps.phi}</p>
                    <p className="text-green-400 font-semibold">
                      {(steps.d * steps.e) % steps.phi === 1 ? '✓ d × e mod φ = 1' : '✗'}
                    </p>
                  </div>
                </StepCard>
              </div>
            )}

            {(!pValid || !qValid) && (p || q) && !(pNum === qNum && pNum !== null) && (
              <p className="text-xs text-muted">{t('phase3.enterPrime')}</p>
            )}
          </div>
        </AccordionBlock>

        {/* Arrow */}
        <div className={`flex justify-center transition-opacity duration-300 ${block2Active ? 'opacity-100' : 'opacity-20'}`}>
          <span className="text-2xl text-indigo-400">↓</span>
        </div>

        {/* ═══ Block 2: Key pair ═══ */}
        <AccordionBlock
          icon={<KeyRound className="w-4 h-4 text-purple-400" />}
          label={t('phase3.keyPairResult')}
          expanded={expandedBlocks.has(2)}
          onToggle={() => toggleBlock(2)}
          disabled={!block2Active}
        >
          <div className="p-4 space-y-4">
            {steps && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Unlock className="w-5 h-5 text-emerald-400" />
                      <h4 className="font-semibold text-emerald-400">{t('phase3.resultPublicKey')}</h4>
                    </div>
                    <p className="font-mono text-lg text-emerald-300">(e={steps.e}, n={steps.n})</p>
                    <p className="text-xs text-emerald-400/70 mt-2">{t('phase3.sharePublic')}</p>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-5 h-5 text-red-400" />
                      <h4 className="font-semibold text-red-400">{t('phase3.resultPrivateKey')}</h4>
                    </div>
                    <p className="font-mono text-lg text-red-300">d={steps.d}</p>
                    <p className="text-xs text-red-400/70 mt-2">{t('phase3.keepPrivate')}</p>
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                  <p className="text-sm text-body">
                    {t('phase3.anyoneCanVerify')}, {t('phase3.onlyYouCanSign').toLowerCase()}.
                  </p>
                </div>
              </>
            )}
          </div>
        </AccordionBlock>

        {/* Arrow */}
        <div className={`flex justify-center transition-opacity duration-300 ${block3Active ? 'opacity-100' : 'opacity-20'}`}>
          <span className="text-2xl text-indigo-400">↓</span>
        </div>

        {/* ═══ Block 3: Hash — progressive step-by-step ═══ */}
        <AccordionBlock
          icon={<Fingerprint className="w-4 h-4 text-amber-400" />}
          label={t('phase3.hashDigestion')}
          expanded={expandedBlocks.has(3)}
          onToggle={() => toggleBlock(3)}
          disabled={!block3Active}
        >
          <div className="p-4 space-y-4">
            {/* Explanation */}
            <p className="text-sm text-secondary leading-relaxed">
              {t('phase3.hashExplainIntro')}
            </p>

            {/* Message input */}
            <div>
              <label className="text-sm text-secondary block mb-1">{t('phase3.hashInput')}</label>
              <input
                type="text"
                value={demoMessage}
                onChange={(e) => setDemoMessage(e.target.value)}
                placeholder={t('phase3.hashInputPlaceholder')}
                className="w-full input-field py-2"
              />
            </div>

            {demoMessage.trim() && (
              <HashStepView message={demoMessage} />
            )}
          </div>
        </AccordionBlock>

        {/* Arrow */}
        <div className={`flex justify-center transition-opacity duration-300 ${block4Active ? 'opacity-100' : 'opacity-20'}`}>
          <span className="text-2xl text-indigo-400">↓</span>
        </div>

        {/* ═══ Block 4: Sign & Verify ═══ */}
        <AccordionBlock
          icon={<Shield className="w-4 h-4 text-emerald-400" />}
          label={t('phase3.signVerifyDemo')}
          expanded={expandedBlocks.has(4)}
          onToggle={() => toggleBlock(4)}
          disabled={!block4Active}
        >
          <div className="p-4 space-y-4">
            {signVerify && steps ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Sign */}
                <StepCard
                  title={<><Lock className="w-3.5 h-3.5 text-red-400 inline" /> {t('phase3.demoSignResult')}</>}
                  tooltip={t('phase3.demoSignExplain')}
                >
                  <p className="font-mono text-xl text-red-300 mb-2">{signVerify.signature}</p>
                  <div className="text-xs text-secondary font-mono space-y-0.5">
                    <p>hash (hex) = {signVerify.hash}</p>
                    <p>hash (dec) = {signVerify.hashDecimal}</p>
                    <p>hash mod n = {signVerify.hashDecimal} mod {steps.n} = {signVerify.hashMod}</p>
                    <p className="pt-1 border-t border-default mt-1">
                      {signVerify.hashMod}<sup>d={steps.d}</sup> mod {steps.n} = <span className="text-red-300 font-bold">{signVerify.signature}</span>
                    </p>
                  </div>
                </StepCard>

                {/* Verify */}
                <StepCard
                  title={<><Shield className="w-3.5 h-3.5 text-emerald-400 inline" /> {t('phase3.demoVerifyResult')}</>}
                  tooltip={t('phase3.demoVerifyExplain')}
                >
                  <p className="font-mono text-xl text-emerald-300 mb-2">{signVerify.recovered}</p>
                  <div className="text-xs text-secondary font-mono space-y-0.5">
                    <p>{signVerify.signature}<sup>e={steps.e}</sup> mod {steps.n} = <span className="text-emerald-300 font-bold">{signVerify.recovered}</span></p>
                    <p className="pt-1 border-t border-default mt-1">
                      hash mod n = {signVerify.hashMod}
                    </p>
                  </div>
                  <div className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${signVerify.isValid ? 'text-green-400' : 'text-red-400'}`}>
                    {signVerify.isValid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {signVerify.recovered} {signVerify.isValid ? '===' : '!=='} {signVerify.hashMod}
                    {' — '}
                    {signVerify.isValid ? t('phase3.demoVerifyMatch') : t('phase3.demoVerifyFail')}
                  </div>
                </StepCard>
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-4">{t('phase3.hashInputPlaceholder')}</p>
            )}
          </div>
        </AccordionBlock>
      </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
