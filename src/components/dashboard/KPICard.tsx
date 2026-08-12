import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color?: string;
}

export function KPICard({ title, value, change, changeLabel, icon, color = 'blue' }: KPICardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600', cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span>{change >= 0 ? '+' : ''}{change}%</span>
              {changeLabel && <span className="text-gray-400 ml-1">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>{icon}</div>
      </div>
    </div>
  );
}
