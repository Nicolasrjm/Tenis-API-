import React from 'react';

export default function SportBadge({
  children,
  variant = 'lime',
  className = '',
  icon: Icon,
  ...props
}) {
  const variantClasses = {
    lime: "bg-[#B8F044]/20 text-[#142B3D] border border-[#B8F044]/50 font-extrabold",
    navy: "bg-[#142B3D] text-[#F8FAFC] border border-[#142B3D]",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    orange: "bg-orange-50 text-orange-700 border border-orange-200",
    slate: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${variantClasses[variant] || variantClasses.lime} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </span>
  );
}
