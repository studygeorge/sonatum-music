'use client';

import React, { type ComponentPropsWithoutRef, type CSSProperties } from 'react';

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = '#ffffff',
      shimmerSize = '0.05em',
      shimmerDuration = '3s',
      borderRadius = '100px',
      background = 'rgba(0, 0, 0, 1)',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={{
          '--spread': '90deg',
          '--shimmer-color': shimmerColor,
          '--radius': borderRadius,
          '--speed': shimmerDuration,
          '--cut': shimmerSize,
          '--bg': background,
          borderRadius: borderRadius,
          background: background,
        } as CSSProperties}
        className={`group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden px-6 py-3 whitespace-nowrap text-white border border-white/10 transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px ${className}`}
        ref={ref}
        {...props}
      >
        {/* spark container */}
        <div className="-z-30 blur-[2px] absolute inset-0 overflow-visible" style={{ contain: 'size' }}>
          <div className="animate-shimmer-slide absolute inset-0 rounded-none" style={{ aspectRatio: '1', height: '100cqh', mask: 'none' }}>
            <div
              className="animate-spin-around absolute rotate-0"
              style={{
                inset: '-100%',
                width: 'auto',
                translate: '0 0',
                background: `conic-gradient(from calc(270deg - (var(--spread) * 0.5)), transparent 0, var(--shimmer-color) var(--spread), transparent var(--spread))`,
              }}
            />
          </div>
        </div>

        {children}

        {/* highlight */}
        <div className="absolute inset-0 size-full rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f] transform-gpu transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />

        {/* backdrop */}
        <div
          className="absolute -z-20"
          style={{
            inset: 'var(--cut)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg)',
          }}
        />
      </button>
    );
  }
);

ShimmerButton.displayName = 'ShimmerButton';
