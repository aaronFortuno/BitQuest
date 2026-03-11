'use client';

import { useTranslation } from 'react-i18next';
import { Coins, Users, LogOut, Menu, Activity, BookOpen, RotateCcw, ArrowRight, Pickaxe } from 'lucide-react';
import { Room } from '@/lib/types';
import LanguageSelector from '@/components/ui/language-selector';
import ThemeToggle from '@/components/ui/theme-toggle';

interface HeaderProps {
  room: Room;
  isTeacher: boolean;
  studentBalance?: number | null;
  currentPhase?: number;
  miningReward?: number;
  onLeave: () => void;
  onToggleNavigation: () => void;
  onToggleInstructions?: () => void;
  onResetPhase?: () => void;
  onAdvancePhase?: () => void;
}

export default function Header({
  room,
  isTeacher,
  studentBalance,
  currentPhase = 0,
  miningReward,
  onLeave,
  onToggleNavigation,
  onToggleInstructions,
  onResetPhase,
  onAdvancePhase,
}: HeaderProps) {
  const { t } = useTranslation();

  const activePeers = (room?.participants ?? []).filter((p) => p.role === 'student' && p.isActive).length;
  const currentPhaseKey = `phase${room?.currentPhase ?? 0}`;
  const txCount = room?.transactions?.length ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Menu + Teacher controls + Logo + Code */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleNavigation}
              className="p-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
            </button>

            {isTeacher && onResetPhase && (
              <button
                onClick={() => {
                  if (confirm(t('confirmResetPhase') || 'Reset phase?')) {
                    onResetPhase();
                  }
                }}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors group"
                title={t('resetPhase')}
              >
                <RotateCcw className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
              </button>
            )}

            {isTeacher && onAdvancePhase && (
              <button
                onClick={onAdvancePhase}
                disabled={(room?.currentPhase ?? 0) >= 9}
                className="p-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors group disabled:opacity-30"
                title={t('advancePhase')}
              >
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600" />
              </button>
            )}

            {isTeacher && <div className="h-6 w-px bg-gray-200 dark:bg-zinc-700" />}

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-800 dark:text-zinc-100 hidden sm:block">{t('appName')}</span>
            </div>

            <div className="h-6 w-px bg-gray-200 dark:bg-zinc-700" />

            <span className="font-mono font-bold text-amber-700 dark:text-amber-400 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
              {room?.code}
            </span>
          </div>

          {/* Center: Phase Title + Student instructions toggle (round) */}
          <div className="hidden md:flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
              {t(currentPhaseKey)}
            </span>
            {!isTeacher && onToggleInstructions && (
              <button
                onClick={onToggleInstructions}
                className="w-7 h-7 flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
                title={t('instructions')}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </button>
            )}
          </div>

          {/* Right: Stats & Controls */}
          <div className="flex items-center gap-3">
            {!isTeacher && currentPhase >= 6 && miningReward != null ? (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Pickaxe className="w-3.5 h-3.5" />
                {miningReward} BTC
              </span>
            ) : !isTeacher && studentBalance != null && (
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                studentBalance >= 0
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
              }`}>
                {studentBalance} <i className="fa-solid fa-cent-sign" />
              </span>
            )}

            <div className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
              <Users className="w-4 h-4" />
              <span className="text-sm">{activePeers}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-400 dark:text-zinc-500">
              <Activity className="w-4 h-4" />
              <span className="text-sm">{txCount} Tx</span>
            </div>

            <ThemeToggle />
            <LanguageSelector />

            {isTeacher && onToggleInstructions && (
              <button
                onClick={onToggleInstructions}
                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors group"
                title={t('instructions')}
              >
                <BookOpen className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </button>
            )}

            <button
              onClick={onLeave}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors group"
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
