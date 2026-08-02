'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Holding {
  symbol: string;
  currentValue: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

export default function PortfolioChart({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
        No holdings data to visualize. Log a trade to view allocation.
      </div>
    );
  }

  const data = holdings.map((h) => ({
    name: h.symbol,
    value: h.currentValue,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
          formatter={(value: number | string | undefined) => [
          `NPR ${Number(value ?? 0).toLocaleString()}`,
          'Value'
  ]}
          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem' }}
/>
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#9CA3AF', fontSize: '12px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
