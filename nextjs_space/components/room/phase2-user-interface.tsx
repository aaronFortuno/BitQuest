'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, User, Coins, Vote, CheckCircle, XCircle, Clock, 
  Send, AlertCircle, Info, ThumbsUp, ThumbsDown, Users
} from 'lucide-react';
import { Room, Participant, Transaction, CoinFile } from '@/lib/types';

interface Phase2UserInterfaceProps {
  room: Room;
  participant: Participant;
  onProposeTransaction: (senderId: string, receiverId: string, amount: number, proposedById: string) => Promise<void>;
  onVote: (transactionId: string, vote: 'for' | 'against') => Promise<void>;
}

export default function Phase2UserInterface({
  room,
  participant,
  onProposeTransaction,
  onVote,
}: Phase2UserInterfaceProps) {
  const { t } = useTranslation();
  const [selectedSender, setSelectedSender] = useState<string>(participant.id);
  const [selectedReceiver, setSelectedReceiver] = useState<string>('');
  const [amount, setAmount] = useState<number>(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const students = room.participants.filter(p => p.role === 'student' && p.isActive);
  const otherUsers = students.filter(p => p.id !== selectedSender);
  
  // Get current voting proposal
  const votingProposal = room.transactions.find(tx => tx.status === 'voting');
  
  // Get completed transactions (approved or rejected)
  const completedTransactions = room.transactions.filter(
    tx => tx.status === 'approved' || tx.status === 'rejected'
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Parse coin file to get balance
  const getBalance = (p: Participant): number => {
    try {
      const coinFile: CoinFile = JSON.parse(p.coinFile);
      return coinFile.saldo;
    } catch {
      return 0;
    }
  };

  const myBalance = getBalance(participant);

  // Check if participant has already voted
  const hasVoted = votingProposal?.voterIds?.includes(participant.id) || false;
  
  // Check if this is the proposer
  const isProposer = votingProposal?.proposedById === participant.id;
  
  // Check if this is a "fake" proposal (proposer different from sender)
  const isFakeProposal = votingProposal && votingProposal.proposedById !== votingProposal.senderId;

  // Calculate if majority reached
  const totalVoters = students.length;
  const majorityNeeded = Math.floor(totalVoters / 2) + 1;
  const majorityFor = votingProposal && votingProposal.votesFor >= majorityNeeded;
  const majorityAgainst = votingProposal && votingProposal.votesAgainst >= majorityNeeded;

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handlePropose = async () => {
    if (!selectedReceiver || amount <= 0) {
      setFeedback({ type: 'error', message: t('selectRecipient') });
      return;
    }

    if (votingProposal) {
      setFeedback({ type: 'warning', message: t('currentProposal') });
      return;
    }

    setIsSubmitting(true);
    try {
      await onProposeTransaction(selectedSender, selectedReceiver, amount, participant.id);
      
      // Show warning if proposing on behalf of someone else
      if (selectedSender !== participant.id) {
        setFeedback({ type: 'warning', message: t('falseProposalWarning') });
      } else {
        setFeedback({ type: 'success', message: t('proposalSent') });
      }
      
      setAmount(1);
      setSelectedReceiver('');
      setSelectedSender(participant.id);
    } catch (error) {
      setFeedback({ type: 'error', message: t('connectionError') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (vote: 'for' | 'against') => {
    if (!votingProposal || hasVoted) return;
    
    try {
      await onVote(votingProposal.id, vote);
      setFeedback({ type: 'success', message: t('voteCast') });
    } catch (error) {
      setFeedback({ type: 'error', message: t('connectionError') });
    }
  };

  const getSenderBalance = (): number => {
    const sender = students.find(p => p.id === votingProposal?.senderId);
    return sender ? getBalance(sender) : 0;
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Feedback Message */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl border ${
              feedback.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-300'
                : feedback.type === 'error'
                ? 'bg-red-500/20 border-red-500/30 text-red-300'
                : feedback.type === 'warning'
                ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
                : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
            }`}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone 1: Shared Ledger (Top) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl p-4 border border-indigo-500/20"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white">{t('sharedLedger')}</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <Info className="w-3 h-3" />
          {t('sharedLedgerInfo')}
        </p>
        <div className="text-sm text-gray-300 mb-2">{t('currentBalances')}:</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {students.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 p-2 rounded-lg ${
                p.id === participant.id
                  ? 'bg-indigo-500/20 border border-indigo-500/30'
                  : 'bg-white/5'
              }`}
            >
              <User className="w-4 h-4 text-gray-400" />
              <span className="truncate text-sm">{p.name}</span>
              <span className="ml-auto font-mono text-amber-400">{getBalance(p)}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Zone 2: My Account (Left) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-2xl p-4 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">{participant.name}</h3>
          </div>
          
          <div className="flex items-center gap-2 mb-6 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Coins className="w-5 h-5 text-amber-400" />
            <span className="text-gray-300">{t('myAccount')}:</span>
            <span className="ml-auto text-2xl font-bold text-amber-400">{myBalance}</span>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm text-gray-400 flex items-center gap-2">
              <Send className="w-4 h-4" />
              {t('proposeTransaction')}
            </h4>
            
            {/* Sender selection (can propose on behalf of others) */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('whoToSend')} ({t('proposedBy')}: {participant.name})</label>
              <select
                value={selectedSender}
                onChange={(e) => {
                  setSelectedSender(e.target.value);
                  if (e.target.value === selectedReceiver) {
                    setSelectedReceiver('');
                  }
                }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting || !!votingProposal}
              >
                {students.map((p) => (
                  <option key={p.id} value={p.id} className="bg-gray-800">
                    {p.name} ({getBalance(p)} coins)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('whoToSend')}</label>
              <select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting || !!votingProposal}
              >
                <option value="" className="bg-gray-800">{t('select')}</option>
                {otherUsers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-gray-800">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('howManyCoins')}</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting || !!votingProposal}
              />
            </div>

            <button
              onClick={handlePropose}
              disabled={isSubmitting || !selectedReceiver || !!votingProposal}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {t('proposeToNetwork')}
            </button>
            
            {selectedSender !== participant.id && (
              <p className="text-xs text-orange-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {t('falseProposalWarning')}
              </p>
            )}
          </div>
        </motion.div>

        {/* Zone 3: Current Proposal (Center) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-b from-purple-500/10 to-pink-500/10 rounded-2xl p-4 border border-purple-500/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Vote className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">{t('currentProposal')}</h3>
          </div>

          {votingProposal ? (
            <div className="space-y-4">
              {/* Proposal details */}
              <div className="p-3 bg-white/10 rounded-xl">
                <p className="text-white font-medium">
                  {votingProposal.sender?.name} {t('wantsToSend')} {votingProposal.amount} {t('coinsTo')} {votingProposal.receiver?.name}
                </p>
                {isFakeProposal && (
                  <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('proposedBy')}: {students.find(p => p.id === votingProposal.proposedById)?.name || 'Unknown'}
                  </p>
                )}
              </div>

              {/* Automatic verification */}
              <div className="space-y-2">
                <h4 className="text-sm text-gray-400">{t('automaticVerification')}:</h4>
                <div className="flex items-center gap-2 text-sm">
                  {getSenderBalance() >= votingProposal.amount ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={getSenderBalance() >= votingProposal.amount ? 'text-green-400' : 'text-red-400'}>
                    {t('balanceOf')} {votingProposal.sender?.name}: {getSenderBalance()} 
                    ({getSenderBalance() >= votingProposal.amount ? t('sufficientBalance') : t('insufficientBalance')})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {votingProposal.amount > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={votingProposal.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                    {votingProposal.amount > 0 ? t('validAmount') : t('invalidAmount')}: {votingProposal.amount}
                  </span>
                </div>
              </div>

              {/* Vote counts */}
              <div className="space-y-2">
                <h4 className="text-sm text-gray-400">{t('currentVotes')}:</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <span className="text-xs text-gray-400">{t('inFavor')}</span>
                    <p className="text-lg font-bold text-green-400">{votingProposal.votesFor}</p>
                  </div>
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <XCircle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                    <span className="text-xs text-gray-400">{t('against')}</span>
                    <p className="text-lg font-bold text-red-400">{votingProposal.votesAgainst}</p>
                  </div>
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                    <span className="text-xs text-gray-400">{t('pendingVotes')}</span>
                    <p className="text-lg font-bold text-amber-400">
                      {totalVoters - votingProposal.votesFor - votingProposal.votesAgainst}
                    </p>
                  </div>
                </div>
                
                {/* Majority indicator */}
                <p className="text-xs text-center text-gray-500">
                  <Users className="w-3 h-3 inline mr-1" />
                  {majorityNeeded} {t('votesInFavor')} {t('pending').toLowerCase()} ({totalVoters} {t('participants').toLowerCase()})
                </p>
                
                {majorityFor && (
                  <p className="text-center text-green-400 font-medium">{t('majorityReached')}</p>
                )}
                {majorityAgainst && (
                  <p className="text-center text-red-400 font-medium">{t('majorityAgainst')}</p>
                )}
              </div>

              {/* Your vote section */}
              <div className="pt-4 border-t border-white/10">
                <h4 className="text-sm text-gray-400 mb-3">{t('yourVote')}:</h4>
                {isProposer ? (
                  <p className="text-sm text-purple-400 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    {t('youProposed')}
                  </p>
                ) : hasVoted ? (
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {t('alreadyVoted')}
                  </p>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleVote('for')}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      {t('accept')}
                    </button>
                    <button
                      onClick={() => handleVote('against')}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      {t('reject')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Vote className="w-12 h-12 mb-3 opacity-30" />
              <p>{t('noCurrentProposal')}</p>
              <p className="text-xs mt-2 text-center text-gray-600">{t('waitingForVotes')}</p>
            </div>
          )}
        </motion.div>

        {/* Zone 4: Transaction History (Right) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 rounded-2xl p-4 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">{t('acceptedTransactions')}</h3>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {completedTransactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{t('noTransactionsYet')}</p>
            ) : (
              completedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`p-3 rounded-lg ${
                    tx.status === 'approved'
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {tx.status === 'approved' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm">
                      {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ({tx.votesFor} {t('votesInFavor')}, {tx.votesAgainst} {t('against').toLowerCase()})
                  </p>
                  {tx.status === 'rejected' && tx.rejectReason && (
                    <p className="text-xs text-red-400 mt-1">
                      {t('reason')}: {tx.rejectReason}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Phase 2 Question */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20"
      >
        <p className="text-sm text-purple-300 flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          {t('consensusQuestion')}
        </p>
      </motion.div>
    </div>
  );
}
