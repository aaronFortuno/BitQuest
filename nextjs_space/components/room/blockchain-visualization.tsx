'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Trophy, Loader2 } from 'lucide-react';
import { Block } from '@/lib/types';

interface BlockchainVisualizationProps {
  blocks: Block[];
  pendingBlock?: Block;
  currentParticipantId: string;
  difficulty: number;
}

function HashDisplay({ hash, maxChars = 6 }: { hash: string; maxChars?: number }) {
  const prefix = hash.substring(0, maxChars);
  const leadingZeros = prefix.match(/^0+/)?.[0] || '';
  const rest = prefix.substring(leadingZeros.length);

  return (
    <span className="font-mono text-[10px]">
      {leadingZeros && <span className="text-green-500 font-bold">{leadingZeros}</span>}
      <span className="text-muted-foreground">{rest}</span>
    </span>
  );
}

function BlockCard({
  block,
  isGenesis,
  isMine,
}: {
  block: Block;
  isGenesis: boolean;
  isMine: boolean;
}) {
  const { t } = useTranslation();

  const borderClass = isGenesis
    ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-900/20'
    : isMine
    ? 'border-green-400 dark:border-green-500 bg-green-50/50 dark:bg-green-900/20'
    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50';

  return (
    <div
      className={`flex-shrink-0 w-[90px] rounded-lg border-2 p-2 ${borderClass}`}
    >
      <div className="text-center">
        <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
          #{block.blockNumber}
        </div>
        {isGenesis && (
          <div className="text-[9px] font-medium text-amber-500">
            {t('phase6.genesis')}
          </div>
        )}
      </div>

      <div className="mt-1 space-y-0.5">
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground">H:</span>
          {block.hash ? (
            <HashDisplay hash={block.hash} />
          ) : (
            <span className="text-[10px] text-muted-foreground">---</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground">P:</span>
          <HashDisplay hash={block.previousHash} />
        </div>
      </div>

      <div className="mt-1 text-center">
        {isGenesis ? (
          <span className="text-[9px] text-amber-600">---</span>
        ) : block.miner ? (
          <div className="flex items-center justify-center gap-0.5">
            {isMine && <Trophy className="w-2.5 h-2.5 text-yellow-500" />}
            <span className={`text-[9px] truncate max-w-[60px] ${isMine ? 'font-bold text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
              {block.miner.name}
            </span>
          </div>
        ) : (
          <span className="text-[9px] text-muted-foreground">?</span>
        )}
      </div>
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex-shrink-0 flex items-center px-0.5">
      <div className="w-4 h-0.5 bg-zinc-300 dark:bg-zinc-600 relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-zinc-300 dark:border-l-zinc-600 border-y-[3px] border-y-transparent" />
      </div>
    </div>
  );
}

export function BlockchainVisualization({
  blocks,
  pendingBlock,
  currentParticipantId,
  difficulty,
}: BlockchainVisualizationProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const minedBlocks = blocks
    .filter(b => b.status === 'mined')
    .sort((a, b) => a.blockNumber - b.blockNumber);

  // Auto-scroll to the right
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [minedBlocks.length, pendingBlock]);

  if (minedBlocks.length === 0 && !pendingBlock) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        {t('phase6.noBlocksYet')}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-0 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600"
    >
      {minedBlocks.map((block, i) => {
        const isGenesis = block.blockNumber === 1 && block.previousHash === '0000000000000000';
        const isMine = block.minerId === currentParticipantId;

        return (
          <div key={block.id} className="flex items-center">
            {i > 0 && <ChainArrow />}
            <BlockCard block={block} isGenesis={isGenesis} isMine={isMine} />
          </div>
        );
      })}

      {pendingBlock && (
        <div className="flex items-center">
          {minedBlocks.length > 0 && <ChainArrow />}
          <motion.div
            animate={{ borderColor: ['rgb(251 146 60)', 'rgb(251 146 60 / 0.3)', 'rgb(251 146 60)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex-shrink-0 w-[90px] rounded-lg border-2 border-orange-400 p-2 bg-orange-50/50 dark:bg-orange-900/20"
          >
            <div className="text-center">
              <div className="text-xs font-bold text-orange-600 dark:text-orange-400">
                #{pendingBlock.blockNumber}
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                <span className="text-[9px] text-orange-500">
                  {t('phase6.mining')}...
                </span>
              </div>
            </div>
            <div className="mt-1">
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground">P:</span>
                <HashDisplay hash={pendingBlock.previousHash} />
              </div>
            </div>
            <div className="mt-1 text-center">
              <span className="text-[9px] text-orange-500">
                {pendingBlock.transactions.length} tx
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
