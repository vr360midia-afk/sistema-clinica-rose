
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconBg: string;
}

const StatsCard = ({ title, value, change, changeType, icon: Icon, iconBg }: StatsCardProps) => {
  const changeColor = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-muted-foreground'
  };

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">{value}</p>
            <p className={`text-xs ${changeColor[changeType]}`}>{change}</p>
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
