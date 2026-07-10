import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export default function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <div className={`bg-[#111318] border border-[#1E212A] rounded-sm ${padded ? 'p-3' : ''} ${className}`}>
      {children}
    </div>
  );
}