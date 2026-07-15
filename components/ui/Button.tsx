'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

const VARIANT_STYLES: Record<ButtonVariant, { base: string; active: string }> = {
  primary: {
    base: 'border-[#1E212A] text-[#7C8090] hover:border-[#3B82F6] hover:text-[#D7D9E0]',
    active: 'border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]',
  },
  secondary: {
    base: 'border-[#1E212A] text-[#7C8090] hover:border-[#2A2E3A] hover:text-[#D7D9E0]',
    active: 'border-[#2A2E3A] bg-[#15171D] text-[#D7D9E0]',
  },
  danger: {
    base: 'border-[#1E212A] text-[#7C8090] hover:border-[#22D3EE] hover:text-[#22D3EE]',
    active: 'border-[#22D3EE] bg-[#22D3EE]/10 text-[#22D3EE]',
  },
  ghost: {
    base: 'border-transparent text-[#7C8090] hover:text-[#D7D9E0]',
    active: 'border-transparent bg-[#15171D] text-[#D7D9E0]',
  },
};

export default function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  active = false,
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const reduceMotion = useReducedMotion();
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2.5 py-1' : 'text-[11px] px-3 py-1.5';
  const styles = VARIANT_STYLES[variant];

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.96 }}
      className={`font-mono uppercase tracking-wide border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${
        active ? styles.active : styles.base
      }`}
    >
      {children}
    </motion.button>
  );
}