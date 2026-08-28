import { Card, CardContent } from '@/components/ui/card';
import { FileText, MessageSquare, AlertTriangle, Flame, type LucideIcon } from 'lucide-react';

interface StatsCardsProps {
  total: number;
  normal: number;
  abuse: number;
  hate: number;
}

interface StatItem {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  cardClassName?: string;
  iconRing?: string;
  iconBg?: boolean;
  accentText?: boolean;
}

export function StatsCards({ total, normal, abuse, hate }: StatsCardsProps) {
  const items: StatItem[] = [
    { label: 'Posts Processed', value: total, icon: FileText, color: 'text-primary' },
    { label: 'Normal Posts', value: normal, icon: MessageSquare, color: 'text-primary' },
    { label: 'Abusive Posts', value: abuse, icon: AlertTriangle, color: 'text-primary' },
    {
      label: 'Hateful Posts',
      value: hate,
      icon: Flame,
      color: 'text-red-600',
      iconBg: false,
      iconRing: 'ring-red-600',
      accentText: true,
      cardClassName: 'bg-[oklab(0.577_0.217662_0.112464/0.1)] ring-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label} className={item.cardClassName}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${item.iconBg !== false ? 'bg-muted' : ''} ${item.color}${item.iconRing ? ` ring-1 ${item.iconRing}` : ''}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-sm ${item.accentText ? item.color : 'text-muted-foreground'}`}>{item.label}</p>
                <p className={`text-2xl font-bold ${item.accentText ? item.color : ''}`}>{item.value.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
