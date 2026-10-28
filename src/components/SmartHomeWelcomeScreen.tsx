import React from 'react';
import { motion } from 'motion/react';

interface SmartHomeWelcomeScreenProps {
  onGetStarted: () => void;
  appName?: string;
}

export const SmartHomeWelcomeScreen: React.FC<SmartHomeWelcomeScreenProps> = ({
  onGetStarted
}) => {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#F2F2F7] dark:bg-black font-sans selection:bg-black selection:text-white flex justify-center overflow-hidden z-50">
      {/* Mobile Device Frame with visible boundaries */}
      <div className="w-full h-full max-w-md relative flex flex-col p-3 sm:p-4 select-none">
        
        {/* Main Card with visible rounded boundaries spanning full height */}
        <div className="flex-1 w-full h-full rounded-[36px] bg-gradient-to-b from-[#092B5A] via-[#0E3D79] to-[#0A2E5E] relative overflow-hidden flex flex-col justify-between shadow-2xl border border-black/10 dark:border-white/10">
          
          {/* Ambient Lighting & Glows */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#1E6FD9]/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-16 left-0 w-64 h-64 bg-[#0A2346]/45 rounded-full blur-2xl pointer-events-none" />

          {/* Blue Wall Paneling / Interior Frames in background */}
          <div className="absolute top-1/3 left-6 w-32 h-44 border-4 border-[#08244D]/60 rounded-lg pointer-events-none" />
          <div className="absolute top-1/2 right-4 w-32 h-48 border-4 border-[#12427E]/40 rounded-lg pointer-events-none" />

          {/* Hanging Pendant Lamps */}
          {/* Left Orb Lamp */}
          <div className="absolute top-0 left-10 flex flex-col items-center pointer-events-none z-10">
            <div className="w-[1.5px] h-32 bg-white/40" />
            <motion.div 
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-14 h-14 -mt-1 rounded-full bg-gradient-to-br from-white via-[#EBF3FE] to-[#CBDDF8] shadow-[0_0_30px_rgba(255,255,255,0.7)] flex items-center justify-center"
            >
              <div className="w-10 h-10 rounded-full bg-white/70 blur-[1px]" />
            </motion.div>
          </div>

          {/* Lower Left Hanging Orb Lamp */}
          <div className="absolute top-0 left-20 flex flex-col items-center pointer-events-none z-10">
            <div className="w-[1px] h-48 bg-white/30" />
            <motion.div 
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="w-11 h-11 -mt-1 rounded-full bg-gradient-to-br from-white via-[#EEF5FE] to-[#D4E4FA] shadow-[0_0_24px_rgba(255,255,255,0.6)] flex items-center justify-center"
            >
              <div className="w-8 h-8 rounded-full bg-white/80 blur-[1px]" />
            </motion.div>
          </div>

          {/* Modern Ambient Floor Lamp in background */}
          <div className="absolute right-12 top-[38%] flex flex-col items-center pointer-events-none z-10 opacity-90">
            <div className="w-14 h-10 bg-gradient-to-b from-[#E2EDFA] to-[#BACFE6] rounded-t-md shadow-[0_0_25px_rgba(255,255,255,0.4)]" />
            <div className="w-[2px] h-48 bg-[#BACFE6]" />
          </div>

          {/* Top Typography in its original position */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="pt-8 px-6 relative z-20 space-y-0.5"
          >
            <h1 className="text-[34px] sm:text-[38px] font-bold text-white tracking-tight leading-[1.12]">
              Welcome to
            </h1>
            <h2 className="text-[34px] sm:text-[38px] font-medium text-[#B8CDE8] tracking-tight leading-[1.12]">
              Smart expenses
            </h2>
            <h2 className="text-[34px] sm:text-[38px] font-medium text-[#B8CDE8] tracking-tight leading-[1.12]">
              System
            </h2>
          </motion.div>

          {/* Middle Spacer */}
          <div className="flex-1" />

          {/* Bottom Pill Container with "Let's start" button - White cutouts completely removed */}
          <div className="w-full relative z-20 px-3.5 pb-4 sm:pb-5">
            <div className="w-full h-[76px] rounded-full bg-gradient-to-r from-[#0A264F] via-[#0E3D79] to-[#0A264F] p-2 flex items-center justify-center shadow-2xl relative border border-white/15">
              <motion.button 
                onClick={onGetStarted}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="w-full h-full bg-white text-black rounded-full flex items-center justify-center shadow-md cursor-pointer transition-all hover:bg-zinc-100 active:bg-zinc-200"
              >
                <span className="font-extrabold text-[18px] tracking-tight">
                  Let's start
                </span>
              </motion.button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SmartHomeWelcomeScreen;

