'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, FileText, Send, CheckCircle, XCircle, AlertTriangle,
  Eye, EyeOff, Lock, Unlock, Hash, Shield, Users, MessageSquare,
  ChevronDown, ChevronUp, Search, Copy, HelpCircle
} from 'lucide-react';
import { Room, Participant, SignedMessage } from '@/lib/types';
import {
  miniHash, generateRSAKeyPair, rsaSign, rsaVerify, verifySignature,
  parsePublicKey, serializePublicKey,
  type HashStep, type KeyGenSteps, type RSAKeyPair, type SignSteps, type VerifySteps
} from '@/lib/crypto';

interface Phase3UserInterfaceProps {
  room: Room;
  participant: Participant;
  messages: SignedMessage[];
  onGenerateKeys: () => { publicKey: string; privateKey: RSAKeyPair['privateKey']; steps: KeyGenSteps } | null;
  onBroadcastKey: (publicKey: string) => Promise<boolean>;
  onSendMessage: (content: string, messageHash: string, signature: string) => Promise<void>;
}

// Signature Anatomy Panel — shows hash, sign, verify steps
function SignatureAnatomyPanel({
  message,
  senderPublicKey,
  privateKey,
  t,
}: {
  message: SignedMessage;
  senderPublicKey: string | null;
  privateKey: RSAKeyPair['privateKey'] | null;
  t: (key: string) => string;
}) {
  const { hash, steps: hashSteps } = miniHash(message.content);
  const pubKey = senderPublicKey ? parsePublicKey(senderPublicKey) : null;

  // Sign steps (only if we have the private key — i.e. our own messages)
  let signSteps: SignSteps | null = null;
  let signatureNum: number | null = null;
  if (privateKey && pubKey) {
    const signResult = rsaSign(hash, privateKey, pubKey.n);
    signSteps = signResult.steps;
    signatureNum = signResult.signature;
  }

  // Verify steps (always possible with public key)
  let verifySteps: VerifySteps | null = null;
  let recoveredHash: number | null = null;
  let expectedHash: number | null = null;
  if (pubKey && message.signature) {
    const sig = parseInt(message.signature, 10);
    if (!isNaN(sig)) {
      const verifyResult = rsaVerify(sig, pubKey);
      verifySteps = verifyResult.steps;
      recoveredHash = verifyResult.recoveredHash;
      expectedHash = parseInt(hash, 16) % pubKey.n;
    }
  }

  return (
    <div className="space-y-3 text-xs font-mono">
      {/* Step 1: Hash */}
      <div>
        <p className="text-heading font-sans font-semibold mb-1 flex items-center gap-1">
          {t('phase3.step')} 1: {t('phase3.hashAnatomy')}
          <span title={t('phase3.hashTooltip')}><HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" /></span>
        </p>
        <div className="bg-black/40 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
          <p className="text-gray-400">{t('phase3.initialState')}: {(0x6A09E6).toString(16).toUpperCase()}</p>
          {hashSteps.map((step) => (
            <div key={step.round} className="text-gray-300">
              <span className="text-cyan-400">{t('phase3.round')} {step.round}</span>
              {' '}({step.char}={step.charCode}):
              {' '}XOR → <span className="text-yellow-300">{step.mix.toString(16).toUpperCase().padStart(6, '0')}</span>
              {' → '}{t('phase3.rotate')} → <span className="text-yellow-300">{step.rotate.toString(16).toUpperCase().padStart(6, '0')}</span>
              {' → '}+K → <span className="text-green-300">{step.addK.toString(16).toUpperCase().padStart(6, '0')}</span>
            </div>
          ))}
          <p className="text-green-400 font-bold">Hash: {hash}</p>
        </div>
      </div>

      {/* Step 2: Sign (only if own message) */}
      {signSteps && (
        <div>
          <p className="text-heading font-sans font-semibold mb-1 flex items-center gap-1">
            {t('phase3.step')} 2: {t('phase3.signatureAnatomy')}
            <span title={t('phase3.signatureTooltip')}><HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" /></span>
          </p>
          <div className="bg-black/40 rounded p-2 space-y-1">
            <p className="text-gray-300">{t('phase3.hashDecimal')}: {signSteps.hashDecimal}</p>
            <p className="text-gray-300">{t('phase3.hashModN')}: {signSteps.hashDecimal} mod {pubKey!.n} = {signSteps.hashMod}</p>
            <p className="text-gray-300">{t('phase3.signatureComputation')}: {signSteps.computation}</p>
          </div>
        </div>
      )}

      {/* Step 3: Verify */}
      {verifySteps && (
        <div>
          <p className="text-heading font-sans font-semibold mb-1 flex items-center gap-1">
            {signSteps ? `${t('phase3.step')} 3` : `${t('phase3.step')} 2`}: {t('phase3.verificationAnatomy')}
            <span title={t('phase3.verifyTooltip')}><HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" /></span>
          </p>
          <div className="bg-black/40 rounded p-2 space-y-1">
            <p className="text-gray-300">{t('phase3.recoveredHash')}: {verifySteps.computation}</p>
            <p className="text-gray-300">{t('phase3.expectedHash')}: {hash} mod {pubKey!.n} = {expectedHash}</p>
            <p className={`font-bold ${recoveredHash === expectedHash ? 'text-green-400' : 'text-red-400'}`}>
              {recoveredHash} {recoveredHash === expectedHash ? '===' : '!=='} {expectedHash}
              {' → '}{recoveredHash === expectedHash ? '✅' : '❌'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Phase3UserInterface({
  room,
  participant,
  messages,
  onGenerateKeys,
  onBroadcastKey,
  onSendMessage,
}: Phase3UserInterfaceProps) {
  const { t } = useTranslation();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);

  // Client-side verification state (per-message, individual)
  const [verifiedMap, setVerifiedMap] = useState<Map<string, boolean>>(new Map());
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Key gen steps display
  const [keyGenSteps, setKeyGenSteps] = useState<KeyGenSteps | null>(null);

  // Anatomy panel
  const [showAnatomy, setShowAnatomy] = useState(false);
  const [anatomyMessageId, setAnatomyMessageId] = useState<string | null>(null);

  // Local private key from localStorage
  const [localPrivateKey, setLocalPrivateKey] = useState<RSAKeyPair['privateKey'] | null>(null);
  const [localPublicKey, setLocalPublicKey] = useState<RSAKeyPair['publicKey'] | null>(null);

  // Hash preview
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [signSteps, setSignSteps] = useState<SignSteps | null>(null);

  const activeParticipants = room.participants.filter(p => p.isActive);

  // Copy key feedback
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Manual verify key inputs (per message)
  const [verifyKeyInputs, setVerifyKeyInputs] = useState<Map<string, string>>(new Map());

  // Load private key from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && participant.id) {
      const storedPriv = localStorage.getItem(`bitquest_privateKey_${participant.id}`);
      const storedPub = localStorage.getItem(`bitquest_publicKey_${participant.id}`);
      if (storedPriv) setLocalPrivateKey(JSON.parse(storedPriv));
      if (storedPub) setLocalPublicKey(JSON.parse(storedPub));
    }
  }, [participant.id, participant.publicKey]);

  const hasKeys = !!participant.publicKey && !!localPrivateKey;

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Calculate hash as user types
  useEffect(() => {
    if (messageContent.trim()) {
      const { hash } = miniHash(messageContent);
      setPreviewHash(hash);
    } else {
      setPreviewHash(null);
    }
    setPreviewSignature(null);
    setSignSteps(null);
  }, [messageContent]);

  // Whether keys are generated locally but not yet broadcast
  const hasLocalKeys = !!localPrivateKey && !!localPublicKey;
  const isBroadcast = !!participant.publicKey;

  const handleGenerateKeys = () => {
    setIsGeneratingKeys(true);
    try {
      const result = onGenerateKeys();
      if (result) {
        setKeyGenSteps(result.steps);
        setLocalPrivateKey(result.privateKey);
        if (typeof result.publicKey === 'string') {
          const pk = parsePublicKey(result.publicKey);
          if (pk) setLocalPublicKey(pk);
        }
        setFeedback({ type: 'success', message: t('phase3.keysGenerated') });
      } else {
        throw new Error('null');
      }
    } catch (err) {
      console.error('Key generation failed:', err);
      setFeedback({ type: 'error', message: t('phase3.keysGenerationFailed') });
    }
    setIsGeneratingKeys(false);
  };

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const handleBroadcastKey = async () => {
    if (!localPublicKey) return;
    setIsBroadcasting(true);
    try {
      const publicKeyStr = serializePublicKey(localPublicKey);
      const success = await onBroadcastKey(publicKeyStr);
      if (success) {
        setFeedback({ type: 'success', message: t('phase3.keyBroadcast') });
      } else {
        setFeedback({ type: 'error', message: t('phase3.broadcastFailed') });
      }
    } catch {
      setFeedback({ type: 'error', message: t('phase3.broadcastFailed') });
    }
    setIsBroadcasting(false);
  };

  const handleSign = () => {
    if (!messageContent.trim() || !previewHash || !localPrivateKey || !localPublicKey) return;
    setIsSigning(true);
    setTimeout(() => {
      const result = rsaSign(previewHash, localPrivateKey, localPublicKey.n);
      setPreviewSignature(result.signature.toString());
      setSignSteps(result.steps);
      setIsSigning(false);
      setFeedback({ type: 'info', message: t('phase3.signatureCreated') });
    }, 400);
  };

  const handleSendMessage = async () => {
    if (!hasKeys) {
      setFeedback({ type: 'warning', message: t('phase3.generateKeysFirst') });
      return;
    }
    if (!previewSignature || !previewHash) {
      setFeedback({ type: 'warning', message: t('phase3.signFirst') });
      return;
    }
    try {
      await onSendMessage(messageContent, previewHash, previewSignature);
      setMessageContent('');
      setPreviewHash(null);
      setPreviewSignature(null);
      setSignSteps(null);
      setFeedback({ type: 'success', message: t('phase3.messageSent') });
    } catch {
      setFeedback({ type: 'error', message: t('phase3.sendFailed') });
    }
  };

  // Client-side manual verification using pasted public key
  const handleVerify = useCallback((msg: SignedMessage) => {
    const keyInput = verifyKeyInputs.get(msg.id);
    if (!keyInput || !msg.signature) return;

    setVerifyingId(msg.id);
    setTimeout(() => {
      const pubKey = parsePublicKey(keyInput);

      if (!pubKey) {
        setVerifiedMap(prev => new Map(prev).set(msg.id, false));
        setVerifyingId(null);
        return;
      }

      const sig = parseInt(msg.signature, 10);
      if (isNaN(sig)) {
        setVerifiedMap(prev => new Map(prev).set(msg.id, false));
        setVerifyingId(null);
        return;
      }

      const { isValid } = verifySignature(msg.content, sig, pubKey);
      setVerifiedMap(prev => new Map(prev).set(msg.id, isValid));
      setVerifyingId(null);
    }, 300);
  }, [verifyKeyInputs]);

  const anatomyMessage = anatomyMessageId ? messages.find(m => m.id === anatomyMessageId) : null;

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
        className="zone-card bg-surface"
      >
        <h3 className="text-lg font-bold text-heading mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          {participant.name} | {t('phase3.myProfile')}
        </h3>

        <div className="space-y-4">
          <div>

            {!hasLocalKeys ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">{t('phase3.noKeysYet')}</p>
                <button
                  onClick={handleGenerateKeys}
                  disabled={isGeneratingKeys}
                  className="w-full py-2 px-4 bg-zinc-600 hover:bg-zinc-700 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-alt rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">{t('phase3.publicKey')} (e:n)</p>
                    <p className="font-mono text-green-400 text-lg">{serializePublicKey(localPublicKey)}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      {isBroadcast ? t('phase3.publicKeyVisible') : t('phase3.keyNotBroadcastYet')}
                    </p>
                  </div>

                  <div className="bg-surface-alt rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">{t('phase3.privateKey')} (d)</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-red-400 text-lg flex-1">
                        {showPrivateKey ? localPrivateKey?.d : '••••••'}
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
                </div>

                {!isBroadcast ? (
                  <button
                    onClick={handleBroadcastKey}
                    disabled={isBroadcasting}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isBroadcasting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Send className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {t('phase3.broadcastKey')}
                  </button>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
                    <p className="text-sm text-green-400">{t('phase3.keysReady')}</p>
                  </div>
                )}
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
        className="zone-card bg-surface"
      >
        <h3 className="text-lg font-bold text-heading mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          {t('phase3.publicKeyRegistry')}
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {activeParticipants.map(s => (
            <div
              key={s.id}
              className={`p-2.5 rounded-lg ${
                s.id === participant.id
                  ? 'bg-surface-alt border border-amber-400/30'
                  : 'bg-surface-alt'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{s.id === participant.id ? '👤' : s.role === 'teacher' ? '🎓' : '👥'}</span>
                <span className="font-medium text-sm truncate">{s.name}</span>
                {s.id === participant.id && (
                  <span className="text-xs text-amber-400">({t('you')})</span>
                )}
              </div>
              {s.publicKey ? (
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs text-green-400 bg-black/30 px-1.5 py-0.5 rounded truncate flex-1">
                    {s.publicKey}
                  </span>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(s.publicKey!);
                      setCopiedKeyId(s.id);
                      setTimeout(() => setCopiedKeyId(null), 1500);
                    }}
                    className="p-0.5 hover:bg-white/10 rounded transition-colors shrink-0"
                    title={t('phase3.copyKey')}
                  >
                    {copiedKeyId === s.id ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-500 italic">{t('phase3.notGenerated')}</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-surface-alt rounded-lg border border-default">
          <p className="text-xs text-body flex items-center gap-1">
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
        className="zone-card bg-surface"
      >
        <h3 className="text-lg font-bold text-heading mb-4 flex items-center gap-2">
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
              className="w-full bg-black/30 border border-default rounded-lg p-3 text-white placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-amber-400"
              disabled={!hasKeys}
            />
          </div>

          {/* Signing process */}
          <div className="bg-surface-alt rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-heading flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('phase3.signingProcess')}
            </p>

            {/* Step 1: Hash */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-zinc-600/50 rounded-full flex items-center justify-center text-xs">1</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('phase3.messageHash')} (Mini-SHA 24bit)</p>
                <p className="font-mono text-amber-400">
                  {previewHash ? (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      [{previewHash}]
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">{t('phase3.autoCalculated')}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Step 2: Sign with RSA */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-zinc-600/50 rounded-full flex items-center justify-center text-xs">2</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('phase3.signWithPrivateKey')} (RSA: hash^d mod n)</p>
                <button
                  onClick={handleSign}
                  disabled={!previewHash || !hasKeys || isSigning || !!previewSignature}
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

            {/* Step 3: Signature result */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-zinc-600/50 rounded-full flex items-center justify-center text-xs">3</span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('phase3.generatedSignature')}</p>
                <p className="font-mono text-green-400">
                  {previewSignature ? (
                    <span className="flex items-center gap-1">
                      [{previewSignature}] <CheckCircle className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">-</span>
                  )}
                </p>
                {signSteps && (
                  <p className="text-xs text-gray-500 mt-1 font-mono">{signSteps.computation}</p>
                )}
              </div>
            </div>
          </div>

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={!previewSignature || !hasKeys}
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
        className="zone-card bg-surface"
      >
        <h3 className="text-lg font-bold text-heading mb-4 flex items-center gap-2">
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
              const verificationState = verifiedMap.get(msg.id);

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-2.5 rounded-lg border text-xs ${
                    isFake
                      ? 'bg-red-900/20 border-red-500/30'
                      : isFromMe
                        ? 'bg-surface-alt border-default'
                        : 'bg-surface-alt border-default'
                  }`}
                >
                  {/* Row 1: From + Key + Message + Timestamp */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-body font-medium whitespace-nowrap">
                      {t('phase3.from')}: {msg.claimedBy || senderInfo?.name || '?'}
                    </span>
                    {isFake && (
                      <span className="bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded text-[10px]">
                        {t('phase3.claimed')}
                      </span>
                    )}
                    {senderInfo?.publicKey && (
                      <span className="text-gray-400 whitespace-nowrap">
                        {t('phase3.key')}: <span className="font-mono text-cyan-400">{senderInfo.publicKey}</span>
                      </span>
                    )}
                    <span className="flex-1 text-body truncate">&quot;{msg.content}&quot;</span>
                    <span className="text-gray-500 whitespace-nowrap shrink-0">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Row 2: Hash + Sig + Inspect + Verify input + Verify button */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 whitespace-nowrap">
                      Hash: <span className="font-mono text-cyan-400">{msg.messageHash}</span>
                    </span>
                    <span className="text-gray-400 whitespace-nowrap">
                      Sig: <span className="font-mono text-amber-400">{msg.signature}</span>
                    </span>
                    <button
                      onClick={() => {
                        setAnatomyMessageId(msg.id);
                        setShowAnatomy(true);
                      }}
                      className="py-0.5 px-1.5 bg-zinc-600 hover:bg-zinc-700 rounded font-medium transition-colors flex items-center gap-0.5 shrink-0"
                      title={t('phase3.showAnatomy')}
                    >
                      <Search className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      placeholder={t('phase3.pasteKeyToVerify')}
                      value={verifyKeyInputs.get(msg.id) || ''}
                      onChange={(e) => {
                        setVerifyKeyInputs(prev => new Map(prev).set(msg.id, e.target.value));
                        if (verifiedMap.has(msg.id)) {
                          setVerifiedMap(prev => { const next = new Map(prev); next.delete(msg.id); return next; });
                        }
                      }}
                      className="flex-1 min-w-0 bg-black/30 border border-default rounded px-2 py-0.5 text-white font-mono text-xs placeholder-gray-500 focus:outline-none focus:border-blue-400"
                    />
                    {verificationState === undefined ? (
                      <button
                        onClick={() => handleVerify(msg)}
                        disabled={verifyingId === msg.id || !verifyKeyInputs.get(msg.id)}
                        className="py-0.5 px-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        {verifyingId === msg.id ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Shield className="w-3 h-3" />
                          </motion.div>
                        ) : (
                          <Shield className="w-3 h-3" />
                        )}
                        {t('phase3.verifySignature')}
                      </button>
                    ) : verificationState ? (
                      <span className="flex items-center gap-1 text-green-400 whitespace-nowrap shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('phase3.validSignature')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 whitespace-nowrap shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        {t('phase3.invalidSignature')}
                      </span>
                    )}
                  </div>

                  {verificationState === false && (
                    <div className="mt-1.5 p-1.5 bg-red-500/20 rounded border border-red-500/30">
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

      {/* Signature Anatomy Panel (collapsible, full width) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="col-span-full zone-card bg-surface"
      >
        <button
          onClick={() => setShowAnatomy(!showAnatomy)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <Search className="w-5 h-5" />
            {t('phase3.showAnatomy')}
          </h3>
          {showAnatomy ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        <AnimatePresence>
          {showAnatomy && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {/* Message selector */}
                {messages.length > 0 && (
                  <select
                    value={anatomyMessageId || ''}
                    onChange={(e) => setAnatomyMessageId(e.target.value || null)}
                    className="w-full bg-black/30 border border-default rounded-lg p-2 text-white text-sm"
                  >
                    <option value="">{t('phase3.selectMessage')}</option>
                    {messages.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.claimedBy || '?'}: &quot;{m.content.substring(0, 40)}{m.content.length > 40 ? '...' : ''}&quot;
                      </option>
                    ))}
                  </select>
                )}

                {anatomyMessage ? (
                  <div className="bg-black/20 rounded-lg p-4">
                    <p className="text-sm text-gray-300 mb-3">
                      📝 {t('phase3.messageLabel')}: &quot;{anatomyMessage.content}&quot;
                    </p>
                    <SignatureAnatomyPanel
                      message={anatomyMessage}
                      senderPublicKey={
                        room.participants.find(p => p.id === anatomyMessage.senderId)?.publicKey || null
                      }
                      privateKey={
                        anatomyMessage.senderId === participant.id ? localPrivateKey : null
                      }
                      t={t}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">{t('phase3.selectMessageToInspect')}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
