import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  actions,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus management: focus modal on open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // ESC close handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          tabIndex={-1}
        >
          <motion.div
            ref={modalRef}
            className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full outline-none"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.25 }}
            tabIndex={0}
            aria-modal="true"
            role="dialog"
          >
            {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
            <div className="mb-4">{children}</div>
            <div className="flex justify-end gap-2">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
