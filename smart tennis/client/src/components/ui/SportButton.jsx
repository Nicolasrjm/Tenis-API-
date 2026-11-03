import React from 'react';

/**
 * SportButton - Sport Premium + Sport Play Button Component
 * Variants: 'lime' (primary athletic CTA) | 'navy' (brand solid) | 'blue' (interactive) | 'outline' (clean surface/border) | 'ghost'
 * Sizes: 'sm' | 'md' | 'lg'
 */
export default function SportButton({
  children,
  variant = 'lime',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  const baseClasses = "inline-flex items-center justify-center font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl";
  
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-xs sm:text-sm gap-2",
    lg: "px-6 py-3.5 text-sm sm:text-base gap-2.5 font-extrabold",
  };

  const variantClasses = {
    lime: "bg-[#B8F044] text-[#101820] hover:bg-[#A4DE2D] shadow-[0_4px_14px_0_rgba(184,240,68,0.4)]",
    navy: "bg-[#142B3D] dark:bg-[#0D1B2A] text-[#F8FAFC] hover:bg-[#1C3A52] shadow-sm",
    blue: "bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-[0_4px_14px_0_rgba(37,99,235,0.3)]",
    outline: "bg-[#F4F6F8] dark:bg-[#22313D] text-[#142B3D] dark:text-[#F1F5F9] border border-[#B8C6D0] dark:border-[#344653] hover:border-[#B8F044] hover:bg-[#E8EDF1] dark:hover:bg-[#18242E] shadow-sm",
    ghost: "bg-transparent text-[#475569] dark:text-[#A8BAC8] hover:text-[#142B3D] dark:hover:text-[#F1F5F9] hover:bg-[#C9D4DC]/40 dark:hover:bg-[#22313D]",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.lime} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
