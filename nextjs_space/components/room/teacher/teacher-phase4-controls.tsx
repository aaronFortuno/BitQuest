'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { UTXOTransaction, UTXOOutput } from '@/lib/types';
import { useRoom } from '@/contexts/room-context';
import Phase4UtxoPanel from '@/components/room/phase4-utxo-panel';

export default function TeacherPhase4Controls() {
  const { t } = useTranslation();
  const {
    room,
    participant,
    utxos,
    utxoTransactions,
    teacherSendUtxo,
  } = useRoom();

  // Local state
  const [sendBtcAmount, setSendBtcAmount] = useState<number>(10);
  const [sendBtcSubmitting, setSendBtcSubmitting] = useState(false);
  const [sendBtcFeedback, setSendBtcFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sendBtcSelectedStudents, setSendBtcSelectedStudents] = useState<Set<string>>(new Set());
  // Phase 4 teacher local TX validation (localStorage-persisted)
  const [teacherValidatedTxIds, setTeacherValidatedTxIds] = useState<string[]>([]);

  const safeUtxos = utxos ?? [];
  const safeUtxoTransactions = utxoTransactions ?? [];
  const students = (room?.participants ?? []).filter(p => p.role === 'student' && p.isActive);

  // Load validated TX IDs from localStorage
  useEffect(() => {
    if (participant?.id) {
      try {
        const stored = localStorage.getItem(`bitquest_validatedTxs_${participant.id}`);
        if (stored) setTeacherValidatedTxIds(JSON.parse(stored));
      } catch {}
    }
  }, [participant?.id]);

  const saveTeacherValidatedTxIds = useCallback((ids: string[]) => {
    setTeacherValidatedTxIds(ids);
    if (participant?.id) {
      localStorage.setItem(`bitquest_validatedTxs_${participant.id}`, JSON.stringify(ids));
    }
  }, [participant?.id]);

  const handleTeacherValidateTx = useCallback((txId: string) => {
    if (!teacherValidatedTxIds.includes(txId)) {
      saveTeacherValidatedTxIds([...teacherValidatedTxIds, txId]);
    }
  }, [teacherValidatedTxIds, saveTeacherValidatedTxIds]);

  const teacherPendingTxs = useMemo(() =>
    safeUtxoTransactions.filter(tx => !teacherValidatedTxIds.includes(tx.id)),
    [safeUtxoTransactions, teacherValidatedTxIds]
  );

  const teacherVerifiedTxs = useMemo(() =>
    teacherValidatedTxIds
      .map(id => safeUtxoTransactions.find(tx => tx.id === id))
      .filter((tx): tx is UTXOTransaction => tx !== undefined),
    [safeUtxoTransactions, teacherValidatedTxIds]
  );

  const getParticipantName = useCallback((id: string) => {
    const p = room?.participants?.find(p => p.id === id);
    return p ? p.name : 'Unknown';
  }, [room?.participants]);

  if (!room || !participant) return null;

  return (
    <>
      {/* Phase 4 UTXO Educational Panel */}
      <Phase4UtxoPanel />

      {/* Phase 4 UTXO Control Panel — two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Model UTXO (send BTC) + Pending TX */}
        <div className="space-y-4">
          {/* Model UTXO — Send BTC to students */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="zone-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-heading" />
              <h2 className="font-semibold text-heading">{t('phase4')}</h2>
            </div>

            {/* Student toggle buttons */}
            <div className="mb-4">
              <label className="text-xs text-muted block mb-2">{t('phase4.selectStudent')}</label>
              <div className="flex flex-wrap gap-2">
                {students.map(s => {
                  const isSelected = sendBtcSelectedStudents.has(s.id);
                  const studentUtxos = safeUtxos.filter(u => u.ownerId === s.id && !u.isSpent);
                  const totalBalance = studentUtxos.reduce((sum, u) => sum + u.amount, 0);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSendBtcSelectedStudents(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-surface border-gray-300 dark:border-gray-600 text-body hover:border-blue-400'
                      }`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-1 text-xs opacity-70">{totalBalance} BTC</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount + Send */}
            <div className="flex items-end gap-3">
              <div className="w-28">
                <label className="text-xs text-muted block mb-1">{t('phase4.sendAmount')}</label>
                <input
                  type="number"
                  min="1"
                  value={sendBtcAmount}
                  onChange={(e) => setSendBtcAmount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-body"
                />
              </div>
              <button
                onClick={async () => {
                  if (sendBtcSelectedStudents.size === 0 || !teacherSendUtxo) return;
                  setSendBtcSubmitting(true);
                  setSendBtcFeedback(null);
                  try {
                    const names: string[] = [];
                    for (const sid of sendBtcSelectedStudents) {
                      const result = await teacherSendUtxo(sid, sendBtcAmount);
                      if (result) {
                        names.push(students.find(s => s.id === sid)?.name ?? '?');
                      }
                    }
                    if (names.length > 0) {
                      setSendBtcFeedback({ type: 'success', message: t('phase4.sentToStudent', { amount: sendBtcAmount, name: names.join(', ') }) });
                      setSendBtcSelectedStudents(new Set());
                    } else {
                      setSendBtcFeedback({ type: 'error', message: t('error') });
                    }
                  } catch {
                    setSendBtcFeedback({ type: 'error', message: t('error') });
                  } finally {
                    setSendBtcSubmitting(false);
                    setTimeout(() => setSendBtcFeedback(null), 4000);
                  }
                }}
                disabled={sendBtcSelectedStudents.size === 0 || sendBtcSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {sendBtcSubmitting ? '...' : `${t('phase4.sendToStudent')} (${sendBtcSelectedStudents.size})`}
              </button>
            </div>
            {sendBtcFeedback && (
              <p className={`mt-3 text-sm ${sendBtcFeedback.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {sendBtcFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                {sendBtcFeedback.message}
              </p>
            )}
          </motion.div>

          {/* Pending Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="zone-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-muted" />
              <h3 className="font-semibold text-heading">{t('phase4.pendingTransactions')}</h3>
            </div>

            {teacherPendingTxs.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">{t('phase4.noPendingYet')}</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {teacherPendingTxs.map(tx => (
                  <div
                    key={tx.id}
                    className={`p-3 rounded-lg border ${
                      tx.isValid
                        ? 'bg-surface border-gray-200 dark:border-gray-700'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold text-heading">{tx.txId}</span>
                      <div className="flex items-center gap-2">
                        {tx.isValid ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" /> {t('phase4.valid')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <XCircle className="w-3 h-3" /> {t('phase4.invalid')}
                          </span>
                        )}
                        <button
                          onClick={() => handleTeacherValidateTx(tx.id)}
                          className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                        >
                          {t('phase4.validateTx')}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-muted mb-1">
                      {getParticipantName(tx.senderId)}
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="text-faint">
                        Inputs: {tx.inputUtxoIds.join(', ')} ({tx.totalInput} BTC)
                      </div>
                      <div className="text-faint">
                        Outputs:
                        {(tx.outputs as UTXOOutput[]).map((out, i) => (
                          <span key={i} className="ml-1">
                            {out.recipientName}: {out.amount} BTC ({out.newUtxoId})
                            {i < tx.outputs.length - 1 && ','}
                          </span>
                        ))}
                      </div>
                    </div>
                    {!tx.isValid && tx.invalidReason && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {tx.invalidReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right column: Verified Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="zone-card border-green-200 dark:border-green-500/30"
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-heading">{t('phase4.verifiedTransactions')}</h3>
            <span className="text-xs text-muted ml-auto">{teacherVerifiedTxs.length} TX</span>
          </div>

          {teacherVerifiedTxs.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">{t('phase4.noVerifiedYet')}</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {teacherVerifiedTxs.map((tx, idx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-900/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">#{idx + 1}</span>
                      <span className="font-mono text-sm font-bold text-heading">{tx.txId}</span>
                    </div>
                    {tx.isValid ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" /> {t('phase4.valid')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <XCircle className="w-3 h-3" /> {t('phase4.invalid')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {getParticipantName(tx.senderId)} — {tx.totalInput} BTC
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
