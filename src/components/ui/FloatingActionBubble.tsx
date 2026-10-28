import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Zap } from 'lucide-react';

interface FloatingActionBubbleProps {
  onClick: () => void;
}

export function FloatingActionBubble({ onClick }: FloatingActionBubbleProps) {
  return (
    <div className="fixed bottom-24 right-5 z-50 pointer-events-auto">
      {/* Outer Orbiting Aura Ring */}
      <motion.div
        className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#C5F531] via-emerald-400 to-cyan-400 opacity-70 blur-md"
        animate={{
          rotate: [0, 360],
          scale: [0.92, 1.12, 0.92],
        }}
        transition={{
          rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
          scale: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
        }}
      />

      {/* Orbiting Satellite Particle 1 */}
      <motion.div
        className="absolute w-3 h-3 rounded-full bg-[#C5F531] shadow-[0_0_10px_#C5F531]"
        animate={{
          x: [28 * Math.cos(0), 28 * Math.cos(Math.PI / 2), 28 * Math.cos(Math.PI), 28 * Math.cos((3 * Math.PI) / 2), 28 * Math.cos(2 * Math.PI)],
          y: [28 * Math.sin(0), 28 * Math.sin(Math.PI / 2), 28 * Math.sin(Math.PI), 28 * Math.sin((3 * Math.PI) / 2), 28 * Math.sin(2 * Math.PI)],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Orbiting Satellite Particle 2 (Counter direction) */}
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]"
        animate={{
          x: [24 * Math.cos(2 * Math.PI), 24 * Math.cos((3 * Math.PI) / 2), 24 * Math.cos(Math.PI), 24 * Math.cos(Math.PI / 2), 24 * Math.cos(0)],
          y: [24 * Math.sin(2 * Math.PI), 24 * Math.sin((3 * Math.PI) / 2), 24 * Math.sin(Math.PI), 24 * Math.sin(Math.PI / 2), 24 * Math.sin(0)],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Main Interactive Pulsing Button */}
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: [
            '0px 10px 25px -5px rgba(197,245,49,0.4)',
            '0px 15px 35px 2px rgba(16,185,129,0.6)',
            '0px 10px 25px -5px rgba(197,245,49,0.4)',
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative w-14 h-14 rounded-full bg-zinc-950 dark:bg-zinc-900 border-2 border-[#C5F531] text-white flex items-center justify-center cursor-pointer overflow-hidden group shadow-2xl"
      >
        {/* Shimmering sweep effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C5F531]/30 to-transparent -translate-x-full"
          animate={{
            translateX: ['-100%', '200%'],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            repeatDelay: 1,
            ease: 'easeInOut',
          }}
        />

        <div className="relative flex items-center justify-center">
          <Plus size={26} className="text-[#C5F531] stroke-[2.8] transition-transform group-hover:rotate-90 duration-300" />
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{
              scale: [0.8, 1.3, 0.8],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          >
            <Sparkles size={10} className="text-[#C5F531] fill-[#C5F531]" />
          </motion.div>
        </div>
      </motion.button>
      
      {/* Quick Tooltip Badge */}
      <motion.div 
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: [0.7, 1, 0.7], x: 0 }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute right-16 top-2 bg-zinc-900/90 backdrop-blur-md text-[#C5F531] border border-[#C5F531]/30 px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest whitespace-nowrap pointer-events-none shadow-lg flex items-center gap-1"
      >
        <Zap size={10} className="fill-[#C5F531]" />
        Quick Add
      </motion.div>
    </div>
  );
}
