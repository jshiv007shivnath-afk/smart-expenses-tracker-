"use client";

import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

const easeSpring = {
  type: "spring" as const,
  stiffness: 280,
  damping: 22,
  mass: 0.8,
};

const easeFluid = [0.16, 1, 0.3, 1] as const;

export interface MenuItem {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
}

export interface FloatingMenuProps {
  items?: MenuItem[];
}

function MenuButton({
  label,
  onClick,
  isOpen,
  index,
}: {
  key?: string | number;
  label: string;
  onClick?: () => void;
  isOpen: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const animatingRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const chars = label.split("");
  const lockDuration = 30 * chars.length + 300;

  const handleEnter = useCallback(() => {
    pendingLeaveRef.current = false;
    if (hovered) return;
    setHovered(true);
    animatingRef.current = true;
    setTimeout(() => {
      animatingRef.current = false;
      if (pendingLeaveRef.current) {
        pendingLeaveRef.current = false;
        setHovered(false);
      }
    }, lockDuration);
  }, [hovered, lockDuration]);

  const handleLeave = useCallback(() => {
    if (animatingRef.current) {
      pendingLeaveRef.current = true;
    } else {
      setHovered(false);
    }
  }, []);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="text-[#F2F2F7] hover:text-[#C5F531] text-[18px] md:text-[20px] font-extrabold leading-none overflow-hidden cursor-pointer py-2 px-4 rounded-xl transition-colors w-full text-center relative group"
      style={{
        fontFamily: "'Trobika', 'Bebas Neue', 'Plus Jakarta Sans', 'Inter', sans-serif",
        letterSpacing: "0.02em",
        height: "1.2em",
      }}
      initial={{ opacity: 0, y: 15, scale: 0.9 }}
      animate={{ 
        opacity: isOpen ? 1 : 0, 
        y: isOpen ? 0 : 15,
        scale: isOpen ? 1 : 0.9 
      }}
      transition={{
        duration: 0.35,
        delay: isOpen ? 0.15 + 0.06 * index : 0,
        ease: easeFluid,
      }}
    >
      <div className="flex justify-center items-center">
        {chars.map((char, i) => (
          <span
            key={i}
            className="inline-block overflow-hidden"
            style={{ height: "1.2em" }}
          >
            <span
              className="flex flex-col"
              style={{
                transitionProperty: "transform",
                transitionDuration: hovered ? "600ms" : "200ms",
                transitionDelay: hovered ? `${25 * i}ms` : "0ms",
                transform: hovered ? "translateY(-50%)" : "translateY(0%)",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span
                className="block"
                style={{ height: "1.2em", lineHeight: "1.2em" }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
              <span
                className="block text-[#C5F531] font-black"
                style={{ height: "1.2em", lineHeight: "1.2em" }}
                aria-hidden
              >
                {char === " " ? "\u00A0" : char}
              </span>
            </span>
          </span>
        ))}
      </div>
    </motion.button>
  );
}

export default function FloatingMenu({ items }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = items ?? [
    { label: "Home" },
    { label: "Analytics" },
    { label: "History" },
    { label: "Workspace" },
    { label: "Settings" },
  ];

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <>
      {/* Liquid Gooey Filter Definition */}
      <svg className="hidden pointer-events-none absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liquid-menu-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <motion.div
        ref={containerRef}
        className="fixed bottom-6 md:bottom-8 left-1/2 z-[100]"
        style={{ x: "-50%", pointerEvents: "auto" }}
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: easeFluid }}
      >
        {/* Backdrop overlay when open */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10"
              onClick={() => setIsOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Liquid Morph Outer Wrapper */}
        <motion.div
          className="relative flex flex-col items-center justify-end shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/20 dark:border-zinc-800/80 overflow-hidden"
          style={{
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            letterSpacing: "-0.01em",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          animate={{
            width: isOpen ? 280 : 150,
            height: isOpen ? menuItems.length * 46 + 92 : 52,
            borderRadius: isOpen ? 32 : 50,
          }}
          transition={easeSpring}
        >
          {/* Liquid Gooey Morphing Background Blobs */}
          <div 
            className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]"
            style={{ filter: "url(#liquid-menu-goo)" }}
          >
            {/* Primary Liquid Base */}
            <motion.div
              className="absolute inset-0"
              animate={{
                backgroundColor: isOpen ? "#0D2111" : "#C5F531",
              }}
              transition={{ duration: 0.4 }}
            />

            {/* Morphing Blob 1 */}
            <motion.div
              className="absolute rounded-full bg-[#18181b]"
              animate={{
                width: isOpen ? "220%" : "60%",
                height: isOpen ? "220%" : "60%",
                x: isOpen ? "-25%" : "-10%",
                y: isOpen ? "-15%" : "100%",
                scale: isOpen ? 1 : 0.4,
              }}
              transition={easeSpring}
            />

            {/* Morphing Blob 2 (Accent Glow) */}
            <motion.div
              className="absolute rounded-full bg-[#C5F531]/30 blur-md"
              animate={{
                width: isOpen ? "120px" : "40px",
                height: isOpen ? "120px" : "40px",
                x: isOpen ? "100px" : "10px",
                y: isOpen ? "-20px" : "20px",
                opacity: isOpen ? 0.6 : 0,
              }}
              transition={easeSpring}
            />
          </div>

          {/* Liquid Inner Content Container */}
          <div className="relative z-10 w-full h-full flex flex-col justify-between">
            {/* Menu Items Stack */}
            <div
              className="flex-1 flex flex-col items-center justify-center pt-5 pb-2 px-3 space-y-1 overflow-hidden"
              style={{
                pointerEvents: isOpen ? "auto" : "none",
              }}
            >
              {menuItems.map((item, idx) => (
                <MenuButton
                  key={item.label}
                  label={item.label}
                  onClick={() => {
                    setIsOpen(false);
                    if (item.onClick) item.onClick();
                  }}
                  isOpen={isOpen}
                  index={idx}
                />
              ))}
            </div>

            {/* Bottom Bar Controls: Toggle Button */}
            <motion.button
              type="button"
              className="w-full h-[52px] flex items-center justify-between px-6 shrink-0 cursor-pointer select-none border-t border-white/10"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((prev) => !prev);
              }}
              whileTap={{ scale: 0.96 }}
            >
              <motion.span
                className="text-[14px] font-bold tracking-normal"
                animate={{
                  color: isOpen ? "#C5F531" : "#0D2111",
                }}
                transition={{ duration: 0.3 }}
              >
                {isOpen ? "Close" : "Menu"}
              </motion.span>

              {/* Animated Hamburger / Close Icon */}
              <div className="relative w-5 h-5 flex items-center justify-center">
                <motion.span
                  className="absolute w-4 h-[2px] rounded-full"
                  animate={{
                    rotate: isOpen ? 45 : 0,
                    y: isOpen ? 0 : -3,
                    backgroundColor: isOpen ? "#C5F531" : "#0D2111",
                  }}
                  transition={{ duration: 0.3 }}
                />
                <motion.span
                  className="absolute w-4 h-[2px] rounded-full"
                  animate={{
                    rotate: isOpen ? -45 : 0,
                    y: isOpen ? 0 : 3,
                    backgroundColor: isOpen ? "#C5F531" : "#0D2111",
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

