import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function Card({ children, className = '', title, subtitle, icon }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">{icon}{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
