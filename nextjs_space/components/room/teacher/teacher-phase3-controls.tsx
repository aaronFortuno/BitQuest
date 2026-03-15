'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoom } from '@/contexts/room-context';
import Phase3CryptoPanel from '@/components/room/phase3-crypto-panel';
import Phase3UserInterface from '@/components/room/phase3-user-interface';

export default function TeacherPhase3Controls() {
  const { t } = useTranslation();
  const {
    room,
    participant,
    messages,
    generateKeys,
    broadcastPublicKey,
    sendSignedMessage,
  } = useRoom();

  // Wrap sendSignedMessage to match Phase3UserInterface's expected void return type
  const handleSendMessage = useCallback(async (content: string, messageHash: string, signature: string): Promise<void> => {
    await sendSignedMessage(content, messageHash, signature);
  }, [sendSignedMessage]);

  if (!room) return null;

  return (
    <div className="space-y-6">
      {/* Row 1: Interactive Public Key Cryptography Panel */}
      <Phase3CryptoPanel />

      {/* Row 2: Teacher uses same interface as students */}
      {participant ? (
        <Phase3UserInterface />
      ) : (
        <div className="zone-card">
          <p className="text-center text-muted py-4">{t('loading')}</p>
        </div>
      )}
    </div>
  );
}
