'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Portal from './Portal';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={onCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${
                variant === 'danger'
                  ? 'bg-red-50 text-red-500 border-red-100'
                  : 'bg-amber-50 text-amber-500 border-amber-100'
              }`}>
                {variant === 'danger' ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-[#1C1B1F] text-base leading-tight">{title}</h3>
                <p className="text-[11px] font-semibold text-stone-400 leading-normal">{message}</p>
              </div>
              <div className="flex gap-3 w-full pt-1">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-800 font-bold text-xs focus:outline-none transition-all"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs focus:outline-none shadow-md transition-all active:scale-95 ${
                    variant === 'danger'
                      ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-red-500/10'
                      : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/10'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
