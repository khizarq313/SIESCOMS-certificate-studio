'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/store';

export function TopLoadingBar() {
  const step = useApp((s) => s.step);
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setActive(true);
    setProgress(25);

    const t1 = setTimeout(() => setProgress(70), 80);
    const t2 = setTimeout(() => setProgress(100), 220);
    const t3 = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="top-loading-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 99999,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.2 }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #2954A8 0%, #3B72D9 60%, #FB8D31 100%)',
              borderRadius: '0 2px 2px 0',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

