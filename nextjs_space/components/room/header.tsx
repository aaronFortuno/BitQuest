'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Coins, Users, Copy, Check, LogOut, Menu, GraduationCap } from 'lucide-react';
import { Room } from '@/lib/types';
import LanguageSelector from '@/components/ui/language-selector';

interface HeaderProps {
  room: Room;
  participantName: string;
  isTeacher: boolean;
  onLeave: () => void;
  onToggleNavigation: () => void;
}

export default function Header({ room, participantName, isTeacher, onLeave, onToggleNavigation }: HeaderProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(room?.code ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activePeers = (room?.participants ?? []).filter((p) => p.role === 'student' && p.isActive).length;
  const currentPhaseKey = `phase${room?.currentPhase ?? 0}`;

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo & Room Code */}
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleNavigation}
              className="p-2 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-800 hidden sm:block">{t('appName')}</span>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <span className="font-mono font-bold text-amber-700">{room?.code}</span>
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-amber-500" />
              )}
            </button>
          </div>

          {/* Center: Phase Info */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('currentPhase')}:</span>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              {t(currentPhaseKey)}
            </span>
          </div>

          {/* Right: Participants & User */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4" />
              <span className="text-sm">{activePeers} {t('peers')}</span>
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              {isTeacher && (
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <GraduationCap className="w-3 h-3 text-white" />
                </div>
              )}
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{participantName}</span>
            </div>

            <LanguageSelector />

            <button
              onClick={onLeave}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
              title={t('leaveRoom')}
            >
              <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
