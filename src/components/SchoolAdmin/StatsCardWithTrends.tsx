import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ReactNode } from "react";

interface StatsCardWithTrendsProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    label: string;
  };
  onClick?: () => void;
  description?: string;
  secondaryValue?: {
    label: string;
    value: number | string;
  };
}

export function StatsCardWithTrends({
  title,
  value,
  icon,
  color,
  trend,
  onClick,
  description,
  secondaryValue,
}: StatsCardWithTrendsProps) {
  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      case 'stable':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      case 'stable':
        return <Minus className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card
      onClick={onClick}
      className={`relative overflow-hidden border-primary/20 hover:shadow-elegant transition-all duration-300 group ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform ${color}`}>
          {icon}
        </div>
      </CardHeader>

      <CardContent>
        {/* Main Value */}
        <div className="text-3xl font-bold text-primary mb-2">{value.toLocaleString()}</div>

        {/* Secondary Value */}
        {secondaryValue && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <span>{secondaryValue.label}:</span>
            <span className="font-semibold text-foreground">{secondaryValue.value}</span>
          </div>
        )}

        {/* Trend Indicator */}
        {trend && (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${getTrendColor(trend.direction)}`}>
            {getTrendIcon(trend.direction)}
            <span>
              {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}
              {trend.percentage}%
            </span>
            <span className="text-muted-foreground ml-1">{trend.label}</span>
          </div>
        )}

        {/* Description */}
        {description && !trend && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}

        {/* Click Hint */}
        {onClick && (
          <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
            Click to view details →
          </div>
        )}
      </CardContent>
    </Card>
  );
}
