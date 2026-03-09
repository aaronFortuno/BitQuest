'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ─── Reusable StepCard with portal tooltip ───
export function StepCard({
  title,
  tooltip,
  children,
}: {
  title: React.ReactNode;
  tooltip: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleEnter = useCallback(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.left + rect.width / 2 });
    }
    setHovered(true);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
      className="bg-surface rounded-lg p-3 border border-default cursor-help"
    >
      <p className="text-xs text-muted mb-1">{title}</p>
      {children}

      {mounted && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top - 8,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
            pointerEvents: 'none',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          <div
            style={{
              background: '#111827',
              color: '#f3f4f6',
              border: '1px solid #4b5563',
            }}
            className="px-3 py-2.5 text-xs rounded-lg shadow-xl max-w-xs leading-relaxed relative"
          >
            {tooltip}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -4,
                transform: 'translateX(-50%) rotate(45deg)',
                width: 8,
                height: 8,
                background: '#111827',
                borderRight: '1px solid #4b5563',
                borderBottom: '1px solid #4b5563',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Accordion block wrapper with disabled state ───
export function AccordionBlock({
  icon,
  label,
  expanded,
  onToggle,
  disabled = false,
  colorClass = 'indigo',
  children,
}: {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  colorClass?: string;
  children: React.ReactNode;
}) {
  const borderColor = disabled ? `border-${colorClass}-500/10` : `border-${colorClass}-500/20`;
  const bgColor = disabled ? `bg-${colorClass}-500/5` : `bg-${colorClass}-500/10`;
  const hoverBg = `hover:bg-${colorClass}-500/15`;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-opacity duration-300 ${
        disabled
          ? 'border-indigo-500/10 opacity-40 pointer-events-none'
          : 'border-indigo-500/20'
      }`}
    >
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-3 transition-colors ${
          disabled
            ? 'bg-indigo-500/5 cursor-not-allowed'
            : 'bg-indigo-500/10 hover:bg-indigo-500/15 cursor-pointer'
        }`}
      >
        <span className="font-medium text-body flex items-center gap-2">
          {icon}
          {label}
        </span>
        {!disabled && (
          expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </button>
      <AnimatePresence>
        {expanded && !disabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
