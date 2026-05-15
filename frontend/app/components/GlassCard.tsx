'use client';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({ 
  children, 
  className = '', 
  hover = true 
}: GlassCardProps) {
  return (
    <div 
      className={`liquid-glass rounded-2xl ${hover ? 'apple-card' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
