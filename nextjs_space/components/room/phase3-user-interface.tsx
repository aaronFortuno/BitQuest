'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, User, FileText, Send, CheckCircle, XCircle, AlertTriangle,
  Eye, EyeOff, Lock, Unlock, Hash, Shield, Users, MessageSquare
} from 'lucide-react';
import { Room, Participant, SignedMessage } from '@/lib/types';

interface Phase3UserInterfaceProps {
  room: Room;
  participant: Participant;
  messages: SignedMessage[];
  onGenerateKeys: () => Promise<{ publicKey: string; privateKey: string }>;
  onSendMessage: (content: string) => Promise<void>;
  onVerifyMessage: (messageId: string) => Promise<boolean>;
}

export default function Phase3UserInterface({
  room,
  participant,
  messages,
  onGenerateKeys,
  onSendMessage,
  onVerifyMessage,
}: Phase3UserInterfaceProps) {
  const { t } = useTranslation();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [messageHash, setMessageHash] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const hasKeys = !!participant.publicKey && !!participant.privateKey;
  const students = room.participants.filter(p => p.role === 'student' && p.isActive);

  // Simple hash function (client-side for visual demonstration)
  const calculateHash = (message: string): string => {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').substring(0, 6);
  };

  // Simple sign function (client-side for visual demonstration)
  const calculateSignature = (hash: string, privateKey: string): string => {
    const combined = hash + privateKey;
    let sig = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      sig = ((sig << 3) - sig) + char;
      sig = sig & sig;
    }
    return Math.abs(sig).toString(16).toUpperCase().padStart(6, '0').substring(0, 6);
  };

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Calculate hash as user types
  useEffect(() => {
    if (messageContent.trim()) {
      setMessageHash(calculateHash(messageContent));
    } else {
      setMessageHash(null);
    }
    setSignature(null); // Reset signature when message changes
  }, [messageContent]);

  const handleGenerateKeys = async () => {
    setIsGeneratingKeys(true);
    try {
      await onGenerateKeys();
      setFeedback({ type: 'success', message: t('phase3.keysGenerated') });
    } catch {
      setFeedback({ type: 'error', message: t('phase3.keysGenerationFailed') });
    }
    setIsGeneratingKeys(false);
  };

  const handleSign = () => {
    if (!messageContent.trim() || !messageHash || !participant.privateKey) return;
    setIsSigning(true);
    // Animate the signing process
    setTimeout(() => {
      const sig = calculateSignature(messageHash, participant.privateKey!);
      setSignature(sig);
      setIsSigning(false);
      setFeedback({ type: 'info', message: t('phase3.signatureCreated') });
    }, 500);
  };

  const handleSendMessage = async () => {
    if (!hasKeys) {
      setFeedback({ type: 'warning', message: t('phase3.generateKeysFirst') });
      return;
    }
    if (!signature) {
      setFeedback({ type: 'warning', message: t('phase3.signFirst') });
      return;
    }
    try {
      await onSendMessage(messageContent);
      setMessageContent('');
      setMessageHash(null);
      setSignature(null);
      setFeedback({ type: 'success', message: t('phase3.messageSent') });
    } catch {
      setFeedback({ type: 'error', message: t('phase3.sendFailed') });
    }
  };

  const handleVerify = async (messageId: string) => {
    setVerifyingId(messageId);
    try {
      await onVerifyMessage(messageId);
    } catch {
      setFeedback({ type: 'error', message: t('phase3.verifyFailed') });
    }
    setVerifyingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`col-span-full p-3 rounded-lg flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              feedback.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              feedback.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {feedback.type === 'error' && <XCircle className="w-4 h-4" />}
            {feedback.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {feedback.type === 'info' && <Shield className="w-4 h-4" />}
            <span className="text-sm">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone 1: My Cryptographic Profile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-xl p-5 border border-purple-500/30"
      >
        <h3 className="text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          {t('phase3.myProfile')}
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/30 rounded-full flex items-center justify-center">
              <span className="text-xl">👤</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('name')}</p>
              <p className="text-lg font-semibold text-white">{participant.name}</p>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4" />
              {t('phase3.myKeys')}
            </h4>

            {!hasKeys ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">{t('phase3.noKeysYet')}</p>
                <button
                  onClick={handleGenerateKeys}
                  disabled={isGeneratingKeys}
                  className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isGeneratingKeys ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Key className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  {t('phase3.generateKeys')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{t('phase3.publicKey')}</p>
                  <p className="font-mono text-green-400 text-lg">{participant.publicKey}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    {t('phase3.publicKeyVisible')}
                  </p>
                </div>

                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{t('phase3.privateKey')}</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-red-400 text-lg flex-1">
                      {showPrivateKey ? participant.privateKey : '••••••'}
                    </p>
                    <button
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-red-400/70 mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {t('phase3.privateKeySecret')}
                  </p>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
                  <p className="text-sm text-green-400">✅ {t('phase3.keysReady')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Zone 2: Public Key Registry */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-xl p-5 border border-blue-500/30"
      >
        <h3 className="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          {t('phase3.publicKeyRegistry')}
        </h3>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {students.map(s => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                s.id === participant.id 
                  ? 'bg-blue-500/20 border border-blue-400/30' 
                  : 'bg-black/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.id === participant.id ? '👤' : '👥'}</span>
                <span className="font-medium">{s.name}</span>
                {s.id === participant.id && (
                  <span className="text-xs text-blue-400">({t('you')})</span>
                )}
              </div>
              <div>
                {s.publicKey ? (
                  <span className="font-mono text-sm text-green-400 bg-black/30 px-2 py-1 rounded">
                    {s.publicKey}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 italic">{t('phase3.notGenerated')}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-xs text-blue-300 flex items-center gap-1">
            <Unlock className="w-3 h-3" />
            {t('phase3.everyoneCanSeeKeys')}
          </p>
        </div>
      </motion.div>

      {/* Zone 3: Send Signed Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-xl p-5 border border-amber-500/30"
      >
        <h3 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {t('phase3.sendSignedMessage')}
        </h3>

        <div className="space-y-4">
          {/* Message input */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">{t('phase3.writeMessage')}</label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder={t('phase3.messagePlaceholder')}
              className="w-full bg-black/30 border border-amber-500/30 rounded-lg p-3 text-white placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-amber-400"
              disabled={!hasKeys}
            />
          </div>

          {/* Signing process */}
          <div className="bg-black/20 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('phase3.signingProcess')}
            </p>

            {/* Step 1: Hash */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-amber-500/30 rounded-full flex items-center justify-center text-xs">1</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('phase3.messageHash')}</p>
                <p className="font-mono text-amber-400">
                  {messageHash ? (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      [{messageHash}]
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">{t('phase3.autoCalculated')}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Step 2: Sign */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-amber-500/30 rounded-full flex items-center justify-center text-xs">2</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('phase3.signWithPrivateKey')}</p>
                <button
                  onClick={handleSign}
                  disabled={!messageHash || !hasKeys || isSigning || !!signature}
                  className="mt-1 py-1 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors flex items-center gap-1"
                >
                  {isSigning ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Key className="w-3 h-3" />
                    </motion.div>
                  ) : (
                    <Key className="w-3 h-3" />
                  )}
                  {t('phase3.signMessage')}
                </button>
              </div>
            </div>

            {/* Step 3: Signature */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-amber-500/30 rounded-full flex items-center justify-center text-xs">3</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('phase3.generatedSignature')}</p>
                <p className="font-mono text-green-400">
                  {signature ? (
                    <span className="flex items-center gap-1">
                      [{signature}] <CheckCircle className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">-</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={!signature || !hasKeys}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {t('phase3.sendToChannel')}
          </button>
        </div>
      </motion.div>

      {/* Zone 4: Public Message Channel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-xl p-5 border border-emerald-500/30"
      >
        <h3 className="text-lg font-bold text-emerald-300 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {t('phase3.publicChannel')}
        </h3>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{t('phase3.noMessages')}</p>
            </div>
          ) : (
            messages.map(msg => {
              const senderInfo = room.participants.find(p => p.id === msg.senderId);
              const isFromMe = msg.senderId === participant.id;
              const isFake = msg.isFakeDemo;
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-3 rounded-lg border ${
                    isFake 
                      ? 'bg-red-900/20 border-red-500/30' 
                      : isFromMe 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-black/20 border-gray-600/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <span>{isFake ? '⚠️' : '👤'}</span>
                        <span>{t('phase3.from')}: {msg.claimedBy || senderInfo?.name || 'Unknown'}</span>
                        {isFake && (
                          <span className="text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded">
                            {t('phase3.claimed')}
                          </span>
                        )}
                      </p>
                      {senderInfo?.publicKey && (
                        <p className="text-xs text-gray-400">
                          {t('phase3.key')}: <span className="font-mono text-cyan-400">{senderInfo.publicKey}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-white mb-2 bg-black/20 p-2 rounded">
                    "{msg.content}"
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-400">
                      <span>{t('phase3.signature')}: </span>
                      <span className="font-mono text-amber-400">{msg.signature}</span>
                    </div>

                    {msg.isVerified === null || msg.isVerified === undefined ? (
                      <button
                        onClick={() => handleVerify(msg.id)}
                        disabled={verifyingId === msg.id}
                        className="py-1 px-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        {verifyingId === msg.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <Shield className="w-3 h-3" />
                          </motion.div>
                        ) : (
                          <Shield className="w-3 h-3" />
                        )}
                        {t('phase3.verifySignature')}
                      </button>
                    ) : msg.isVerified ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        {t('phase3.validSignature')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-4 h-4" />
                        {t('phase3.invalidSignature')}
                      </span>
                    )}
                  </div>

                  {msg.isVerified === false && (
                    <div className="mt-2 p-2 bg-red-500/20 rounded border border-red-500/30">
                      <p className="text-xs text-red-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('phase3.fraudWarning')}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
