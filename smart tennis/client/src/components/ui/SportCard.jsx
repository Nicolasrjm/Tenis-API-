import React from 'react';

export default function SportCard({
  children,
  className = '',
  hoverEffect = false,
  variant = 'default',
  ...props
}) {
  const variantClasses = {
    default: "bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] text-[#142B3D] dark:text-[#F1F5F9] shadow-[0_4px_18px_-2px_rgba(16,24,32,0.1)]",
    white: "bg-[#F4F6F8] dark:bg-[#22313D] border border-[#B8C6D0] dark:border-[#344653] text-[#142B3D] dark:text-[#F1F5F9] shadow-[0_4px_18px_-2px_rgba(16,24,32,0.1)]",
    ice: "bg-[#DCE3E8] dark:bg-[#18242E] border border-[#B8C6D0] dark:border-[#344653] text-[#142B3D] dark:text-[#F1F5F9]",
    navy: "bg-[#142B3D] dark:bg-[#0D1B2A] border border-[#1C3A52] dark:border-[#344653] text-[#F8FAFC] shadow-lg",
  };

  const hoverClass = hoverEffect 
    ? "transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_-4px_rgba(16,24,32,0.2)] hover:border-[#B8F044]" 
    : "";

  return (
    <div
      className={`rounded-2xl p-6 ${variantClasses[variant] || variantClasses.default} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
