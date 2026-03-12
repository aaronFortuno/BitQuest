'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Boxes, Hash, Pickaxe, Link,
  ArrowRight, Play, Square, RotateCcw, AlertTriangle,
  CheckCircle, XCircle,
} from 'lucide-react';
import { AccordionBlock } from '@/components/ui/educational-blocks';

// ─── SHA-256 helper (Web Crypto API) ───
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Mempool transaction type ───
interface MempoolTx {
  id: string;
  from: string;
  to: string;
  amount: number;
}

// ─── Generate mempools from participant names ───
function generateMempools(names: string[]): { a: MempoolTx[]; b: MempoolTx[]; c: MempoolTx[]; nodeNames: [string, string, string] } {
  const nodeNames: [string, string, string] = [
    names[0] || 'Node A',
    names[1] || 'Node B',
    names[2] || 'Node C',
  ];

  const n = names.length;
  const txAll: MempoolTx[] = [
    { id: 'TX#1', from: names[0 % n], to: names[1 % n], amount: 3 },
    { id: 'TX#2', from: names[2 % n], to: names[3 % n], amount: 5 },
    { id: 'TX#3', from: names[1 % n], to: names[2 % n], amount: 2 },
    { id: 'TX#4', from: names[3 % n], to: names[0 % n], amount: 1 },
    { id: 'TX#5', from: names[0 % n], to: names[3 % n], amount: 4 },
    { id: 'TX#6', from: names[2 % n], to: names[1 % n], amount: 7 },
  ];

  const a = [txAll[0], txAll[1], txAll[2], txAll[3], txAll[4]];
  const b = [txAll[2], txAll[4], txAll[0], txAll[1]];
  const c = [txAll[1], txAll[3], txAll[0], txAll[5], txAll[2]];

  return { a, b, c, nodeNames };
}

// ─── Section 1: Mini mempool card ───
function MiniMempool({ label, txs, color }: { label: string; txs: MempoolTx[]; color: string }) {
  return (
    <div className="rounded-lg border border-default overflow-hidden">
      <div className={`px-3 py-2 ${color} flex items-center gap-2`}>
        <Boxes className="w-3.5 h-3.5" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="p-2 space-y-1">
        {txs.map((tx, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono bg-surface border border-default"
          >
            <span className="text-amber-400 font-bold">{tx.id}</span>
            <span className="text-secondary">
              {tx.from}→{tx.to}
            </span>
            <span className="text-emerald-400 font-bold">{tx.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section 2: Hash explorer ───
function HashExplorer() {
  const { t } = useTranslation();
  const [text, setText] = useState('Hola BitQuest!');
  const [hash, setHash] = useState('');

  useEffect(() => {
    let cancelled = false;
    sha256(text).then(h => { if (!cancelled) setHash(h); });
    return () => { cancelled = true; };
  }, [text]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary leading-relaxed">
        {t('phase6Panel.section2Intro')}
      </p>

      <div>
        <label className="text-xs text-muted block mb-1">{t('phase6Panel.section2Data')}</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          className="w-full input-field py-2 font-mono text-sm resize-none"
          placeholder={t('phase6Panel.section2Placeholder')}
        />
      </div>

      <div className="p-3 rounded-lg" style={{ background: '#064e3b40', border: '1px solid #10b98140' }}>
        <p className="text-xs text-muted mb-1">{t('phase6Panel.section2HashLabel')}</p>
        <p className="font-mono text-sm font-bold break-all" style={{ color: '#34d399' }}>
          {hash || '...'}
        </p>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-300 leading-relaxed">
          {t('phase6Panel.section2Note')}
        </p>
      </div>
    </div>
  );
}

// ─── Section 3: Mining with nonce ───
function MiningExplorer({ sampleTx }: { sampleTx: string }) {
  const { t } = useTranslation();
  const [blockNum] = useState(1);
  const [data, setData] = useState(sampleTx);
  const [nonce, setNonce] = useState(0);
  const [hash, setHash] = useState('');
  const [difficulty] = useState(4);
  const [mining, setMining] = useState(false);
  const miningRef = useRef(false);
  const nonceRef = useRef(0);

  const target = '0'.repeat(difficulty);

  useEffect(() => {
    let cancelled = false;
    const blockContent = `${blockNum}:${'0'.repeat(64)}:${data}:${nonce}`;
    sha256(blockContent).then(h => { if (!cancelled) setHash(h); });
    return () => { cancelled = true; };
  }, [blockNum, data, nonce]);

  const isValid = hash.startsWith(target);

  const startMining = useCallback(() => {
    setMining(true);
    miningRef.current = true;
    nonceRef.current = 0;
    setNonce(0);

    const mine = async () => {
      while (miningRef.current) {
        const currentNonce = nonceRef.current;
        const blockContent = `${blockNum}:${'0'.repeat(64)}:${data}:${currentNonce}`;
        const h = await sha256(blockContent);

        if (!miningRef.current) break;

        if (h.startsWith(target)) {
          setNonce(currentNonce);
          setHash(h);
          setMining(false);
          miningRef.current = false;
          break;
        }

        if (currentNonce % 100 === 0) {
          setNonce(currentNonce);
          setHash(h);
          await new Promise(r => setTimeout(r, 0));
        }

        nonceRef.current++;
      }
    };

    mine();
  }, [blockNum, data, target]);

  const stopMining = useCallback(() => {
    setMining(false);
    miningRef.current = false;
  }, []);

  const resetMining = useCallback(() => {
    stopMining();
    setNonce(0);
  }, [stopMining]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary leading-relaxed">
        {t('phase6Panel.section3Intro', { target })}
      </p>

      <div className={`rounded-lg border-2 transition-colors ${
        isValid ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
      }`}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted w-24">{t('phase6Panel.block')}:</label>
            <span className="font-mono text-lg font-bold text-amber-400">#{blockNum}</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted w-24">{t('phase6Panel.nonce')}:</label>
            <input
              type="number"
              value={nonce}
              onChange={e => { stopMining(); setNonce(parseInt(e.target.value) || 0); }}
              className="input-field w-32 text-center font-mono py-1.5"
              disabled={mining}
            />
            {mining && (
              <span className="text-xs text-amber-400 animate-pulse">{t('phase6Panel.searching')}</span>
            )}
          </div>

          <div className="flex items-start gap-3">
            <label className="text-xs text-muted w-24 pt-2">{t('phase6Panel.data')}:</label>
            <textarea
              value={data}
              onChange={e => { stopMining(); setData(e.target.value); setNonce(0); }}
              rows={2}
              className="flex-1 input-field py-2 font-mono text-sm resize-none"
              disabled={mining}
            />
          </div>

          <div className="flex items-start gap-3">
            <label className="text-xs text-muted w-24 pt-1">{t('phase6Panel.hash')}:</label>
            <div className="flex-1">
              <p className={`font-mono text-sm font-bold break-all ${
                isValid ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {hash || '...'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {isValid ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> {t('phase6Panel.validHash', { target })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3.5 h-3.5" /> {t('phase6Panel.invalidHash', { target })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          {!mining ? (
            <button
              onClick={startMining}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> {t('phase6Panel.mine')}
            </button>
          ) : (
            <button
              onClick={stopMining}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors flex items-center gap-2"
            >
              <Square className="w-4 h-4" /> {t('phase6Panel.stop')}
            </button>
          )}
          <button
            onClick={resetMining}
            className="px-3 py-2 rounded-lg text-sm bg-surface border border-default text-secondary hover:text-body transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> {t('phase6Panel.reset')}
          </button>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-purple-300 leading-relaxed">
          {t('phase6Panel.nonceExplain')}
        </p>
      </div>
    </div>
  );
}

// ─── Section 4: Blockchain (3 linked blocks) ───
interface BlockData {
  blockNumber: number;
  data: string;
  nonce: number;
  previousHash: string;
  hash: string;
}

function BlockchainExplorer({ blockTexts, genesisLabel }: { blockTexts: [string, string, string]; genesisLabel: string }) {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<BlockData[]>([
    { blockNumber: 1, data: genesisLabel, nonce: 0, previousHash: '0'.repeat(64), hash: '' },
    { blockNumber: 2, data: blockTexts[0], nonce: 0, previousHash: '', hash: '' },
    { blockNumber: 3, data: blockTexts[1], nonce: 0, previousHash: '', hash: '' },
  ]);
  const difficulty = 4;
  const target = '0'.repeat(difficulty);
  const [miningIndex, setMiningIndex] = useState<number | null>(null);
  const miningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function recomputeChain() {
      const updated = [...blocks];
      let changed = false;

      for (let i = 0; i < updated.length; i++) {
        const prevHash = i === 0 ? '0'.repeat(64) : updated[i - 1].hash;
        if (updated[i].previousHash !== prevHash) {
          updated[i] = { ...updated[i], previousHash: prevHash };
          changed = true;
        }

        const content = `${updated[i].blockNumber}:${updated[i].previousHash}:${updated[i].data}:${updated[i].nonce}`;
        const h = await sha256(content);
        if (cancelled) return;

        if (updated[i].hash !== h) {
          updated[i] = { ...updated[i], hash: h };
          changed = true;
        }
      }

      if (changed && !cancelled) {
        setBlocks(updated);
      }
    }

    recomputeChain();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    blocks[0]?.data, blocks[0]?.nonce,
    blocks[1]?.data, blocks[1]?.nonce,
    blocks[2]?.data, blocks[2]?.nonce,
  ]);

  const updateBlock = (index: number, field: 'data' | 'nonce', value: string | number) => {
    setBlocks(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const mineBlock = useCallback(async (index: number) => {
    setMiningIndex(index);
    miningRef.current = true;
    let currentNonce = 0;

    const prevHash = index === 0 ? '0'.repeat(64) : blocks[index - 1].hash;

    while (miningRef.current) {
      const content = `${blocks[index].blockNumber}:${prevHash}:${blocks[index].data}:${currentNonce}`;
      const h = await sha256(content);

      if (!miningRef.current) break;

      if (h.startsWith(target)) {
        setBlocks(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], nonce: currentNonce, previousHash: prevHash, hash: h };
          return updated;
        });
        setMiningIndex(null);
        miningRef.current = false;
        break;
      }

      if (currentNonce % 200 === 0) {
        setBlocks(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], nonce: currentNonce, previousHash: prevHash };
          return updated;
        });
        await new Promise(r => setTimeout(r, 0));
      }

      currentNonce++;
    }
  }, [blocks, target]);

  const stopMining = useCallback(() => {
    miningRef.current = false;
    setMiningIndex(null);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary leading-relaxed">
        {t('phase6Panel.section4Intro')}
      </p>

      <div className="flex flex-col lg:flex-row gap-2 items-stretch">
        {blocks.map((block, i) => {
          const isValid = block.hash.startsWith(target);
          const isMining = miningIndex === i;

          return (
            <div key={i} className="flex items-center gap-2 flex-1 min-w-0">
              {i > 0 && (
                <div className="hidden lg:flex flex-shrink-0">
                  <ArrowRight className="w-5 h-5 text-amber-400" />
                </div>
              )}
              {i > 0 && (
                <div className="flex lg:hidden justify-center py-1">
                  <span className="text-xl text-amber-400">↓</span>
                </div>
              )}

              <div className={`flex-1 rounded-lg border-2 transition-colors ${
                isValid ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
              }`}>
                <div className={`px-3 py-2 rounded-t-md flex items-center justify-between ${
                  isValid ? 'bg-emerald-500/10' : 'bg-red-500/10'
                }`}>
                  <span className="text-sm font-bold text-amber-400">{t('phase6Panel.block')} #{block.blockNumber}</span>
                  {isValid ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>

                <div className="p-3 space-y-2">
                  <div>
                    <label className="text-[10px] text-muted block">{t('phase6Panel.nonce')}:</label>
                    <input
                      type="number"
                      value={block.nonce}
                      onChange={e => { stopMining(); updateBlock(i, 'nonce', parseInt(e.target.value) || 0); }}
                      className="w-full input-field text-xs font-mono py-1"
                      disabled={isMining}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block">{t('phase6Panel.data')}:</label>
                    <textarea
                      value={block.data}
                      onChange={e => { stopMining(); updateBlock(i, 'data', e.target.value); }}
                      rows={2}
                      className="w-full input-field text-xs font-mono py-1 resize-none"
                      disabled={isMining}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block">{t('phase6Panel.hashPrev')}:</label>
                    <p className="font-mono text-[10px] text-secondary break-all leading-tight">
                      {block.previousHash ? block.previousHash.slice(0, 16) + '...' : '...'}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block">{t('phase6Panel.hash')}:</label>
                    <p className={`font-mono text-[10px] font-bold break-all leading-tight ${
                      isValid ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {block.hash ? block.hash.slice(0, 16) + '...' : '...'}
                    </p>
                  </div>

                  <button
                    onClick={() => isMining ? stopMining() : mineBlock(i)}
                    disabled={miningIndex !== null && !isMining}
                    className={`w-full px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      isMining
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : isValid
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 opacity-50 cursor-default'
                        : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                    }`}
                  >
                    {isMining ? (
                      <><Square className="w-3 h-3" /> {t('phase6Panel.stop')}</>
                    ) : isValid ? (
                      <><CheckCircle className="w-3 h-3" /> {t('phase6Panel.mined')}</>
                    ) : (
                      <><Pickaxe className="w-3 h-3" /> {t('phase6Panel.mine')}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300 leading-relaxed">
            {t('phase6Panel.section4Warning')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel Component ───
export default function Phase6BlockchainPanel({
  defaultCollapsed = false,
  participantNames = [],
}: {
  defaultCollapsed?: boolean;
  participantNames?: string[];
}) {
  const { t } = useTranslation();
  const [panelCollapsed, setPanelCollapsed] = useState(defaultCollapsed);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set([1]));

  const names = useMemo(() => {
    const filtered = participantNames.filter(n => n !== 'Professor' && n.trim());
    return filtered.length >= 4 ? filtered : ['Alumne1', 'Alumne2', 'Alumne3', 'Alumne4'];
  }, [participantNames]);

  const mempools = useMemo(() => generateMempools(names), [names]);

  const sampleTx = useMemo(() => `${names[0]} → ${names[1]}: 3 BTC`, [names]);
  const blockTexts = useMemo((): [string, string, string] => [
    `${names[0]}→${names[1]}: 3 BTC`,
    `${names[2]}→${names[3 % names.length]}: 5 BTC`,
    `${names[1]}→${names[2]}: 2 BTC`,
  ], [names]);

  const toggleBlock = (n: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

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
          <Link className="w-5 h-5" />
          {t('phase6Panel.title')}
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
              {/* ═══ Section 1: The problem — unordered mempools ═══ */}
              <AccordionBlock
                icon={<Boxes className="w-4 h-4 text-amber-400" />}
                label={t('phase6Panel.section1Title')}
                expanded={expandedBlocks.has(1)}
                onToggle={() => toggleBlock(1)}
              >
                <div className="p-4 space-y-4">
                  <p className="text-sm text-secondary leading-relaxed">
                    {t('phase6Panel.section1Intro')}
                  </p>

                  <p className="text-sm text-secondary leading-relaxed">
                    {t('phase6Panel.section1Need')}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <MiniMempool
                      label={mempools.nodeNames[0]}
                      txs={mempools.a}
                      color="bg-blue-500/10 text-blue-300"
                    />
                    <MiniMempool
                      label={mempools.nodeNames[1]}
                      txs={mempools.b}
                      color="bg-purple-500/10 text-purple-300"
                    />
                    <MiniMempool
                      label={mempools.nodeNames[2]}
                      txs={mempools.c}
                      color="bg-teal-500/10 text-teal-300"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-red-300 leading-relaxed">
                        <p className="font-semibold mb-1">{t('phase6Panel.section1Differences')}</p>
                        <ul className="space-y-0.5 list-disc list-inside">
                          <li>{t('phase6Panel.section1Diff1')}</li>
                          <li>{t('phase6Panel.section1Diff2', { nodeA: mempools.nodeNames[0], nodeB: mempools.nodeNames[1] })}</li>
                          <li>{t('phase6Panel.section1Diff3', { nodeC: mempools.nodeNames[2] })}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-emerald-300 leading-relaxed">
                      {t('phase6Panel.section1Solution')}
                    </p>
                  </div>
                </div>
              </AccordionBlock>

              <div className="flex justify-center">
                <span className="text-2xl text-amber-400">↓</span>
              </div>

              {/* ═══ Section 2: What is a hash? ═══ */}
              <AccordionBlock
                icon={<Hash className="w-4 h-4 text-emerald-400" />}
                label={t('phase6Panel.section2Title')}
                expanded={expandedBlocks.has(2)}
                onToggle={() => toggleBlock(2)}
              >
                <div className="p-4">
                  <HashExplorer />
                </div>
              </AccordionBlock>

              <div className="flex justify-center">
                <span className="text-2xl text-amber-400">↓</span>
              </div>

              {/* ═══ Section 3: Mining — finding a nonce ═══ */}
              <AccordionBlock
                icon={<Pickaxe className="w-4 h-4 text-purple-400" />}
                label={t('phase6Panel.section3Title')}
                expanded={expandedBlocks.has(3)}
                onToggle={() => toggleBlock(3)}
              >
                <div className="p-4">
                  <MiningExplorer sampleTx={sampleTx} />
                </div>
              </AccordionBlock>

              <div className="flex justify-center">
                <span className="text-2xl text-amber-400">↓</span>
              </div>

              {/* ═══ Section 4: The blockchain ═══ */}
              <AccordionBlock
                icon={<Link className="w-4 h-4 text-amber-400" />}
                label={t('phase6Panel.section4Title')}
                expanded={expandedBlocks.has(4)}
                onToggle={() => toggleBlock(4)}
              >
                <div className="p-4">
                  <BlockchainExplorer blockTexts={blockTexts} genesisLabel={t('phase6Panel.genesisBlock')} />
                </div>
              </AccordionBlock>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
