/**
 * School Admin Reports Dashboard
 * Comprehensive KPI dashboard with key metrics and trends
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useDashboardMetricsExport } from '@/hooks/useReportExport';
import { fetchDashboardMetrics, DashboardMetrics } from '@/lib/report-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Award,
  AlertCircle,
  Target,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MetricCard {
  title: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  status?: 'good' | 'warning' | 'critical';
}

export function SchoolAdminReportsDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { exportMetrics, isExporting, currentFormat } = useDashboardMetricsExport();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('pdf');

  // Load metrics on component mount
  useEffect(() => {
    if (profile?.school_id) {
      loadMetrics();
    }
  }, [profile?.school_id]);

  const loadMetrics = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      setLoading(true);
      const data = await fetchDashboardMetrics(profile.school_id);
      setMetrics(data);
    } catch (error) {
      console.error('Error loading metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard metrics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, toast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  }, [loadMetrics]);

  const handleExport = useCallback(async () => {
    if (!metrics || !profile?.school_id) return;

    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', profile.school_id)
      .single();

    await exportMetrics(metrics, school?.name || 'School', exportFormat);
  }, [metrics, profile?.school_id, exportFormat, exportMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading dashboard metrics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center p-12">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-muted-foreground">Failed to load metrics</p>
      </div>
    );
  }

  // Determine status based on metrics
  const enrollmentStatus: 'good' | 'warning' | 'critical' =
    metrics.enrollmentTrend > 5 ? 'good' : metrics.enrollmentTrend > 0 ? 'warning' : 'critical';

  const attendanceStatus: 'good' | 'warning' | 'critical' =
    metrics.averageAttendance >= 85 ? 'good' : metrics.averageAttendance >= 70 ? 'warning' : 'critical';

  const performanceStatus: 'good' | 'warning' | 'critical' =
    metrics.averagePerformance >= 70 ? 'good' : metrics.averagePerformance >= 50 ? 'warning' : 'critical';

  const metricCards: MetricCard[] = [
    {
      title: 'Total Students',
      value: metrics.totalStudents,
      unit: 'students',
      icon: <Users className="h-6 w-6" />,
      color: 'bg-blue-100 text-blue-700',
      trend: metrics.enrollmentTrend,
      status: enrollmentStatus,
    },
    {
      title: 'Active Students',
      value: metrics.activeStudents,
      unit: 'enrolled',
      icon: <Target className="h-6 w-6" />,
      color: 'bg-green-100 text-green-700',
    },
    {
      title: 'Average Attendance',
      value: metrics.averageAttendance,
      unit: '%',
      icon: <BarChart3 className="h-6 w-6" />,
      color: 'bg-orange-100 text-orange-700',
      status: attendanceStatus,
    },
    {
      title: 'Average Performance',
      value: metrics.averagePerformance,
      unit: '%',
      icon: <Award className="h-6 w-6" />,
      color: 'bg-purple-100 text-purple-700',
      status: performanceStatus,
    },
    {
      title: 'Total Teachers',
      value: metrics.totalTeachers,
      unit: 'teachers',
      icon: <BookOpen className="h-6 w-6" />,
      color: 'bg-indigo-100 text-indigo-700',
    },
    {
      title: 'Total Classes',
      value: metrics.totalClasses,
      unit: 'classes',
      icon: <Target className="h-6 w-6" />,
      color: 'bg-pink-100 text-pink-700',
    },
  ];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'good':
        return 'Good';
      case 'warning':
        return 'Needs Attention';
      case 'critical':
        return 'Critical';
      default:
        return 'Normal';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">📊 Reports Dashboard</h1>
          <p className="text-muted-foreground mt-1">Key performance indicators and metrics</p>
        </div>

        {/* Export Controls */}
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-gradient-primary hover:opacity-90 gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting && currentFormat === exportFormat ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting
              </>
            ) : (
              'Export'
            )}
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="icon"
            title="Refresh metrics"
          >
            <TrendingUp className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((card, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.color}`}>{card.icon}</div>
                {card.status && (
                  <Badge className={getStatusColor(card.status)}>
                    {getStatusLabel(card.status)}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {card.value > 99 ? card.value : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.unit}</p>
                </div>

                {card.trend !== undefined && (
                  <div className="flex items-center gap-1">
                    {card.trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={card.trend > 0 ? 'text-green-600' : 'text-red-600'}>
                      {Math.abs(card.trend)}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* At-Risk Students Alert */}
      {metrics.atRiskStudents > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              At-Risk Students
            </CardTitle>
            <CardDescription>
              {metrics.atRiskStudents} students with grades below 40%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">
                  {((metrics.atRiskStudents / metrics.totalStudents) * 100).toFixed(1)}% of total students
                </p>
                <Progress
                  value={(metrics.atRiskStudents / Math.max(metrics.totalStudents, 1)) * 100}
                  className="h-2"
                />
              </div>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excellent Students Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Award className="h-5 w-5" />
            Excellent Performers
          </CardTitle>
          <CardDescription>
            {metrics.excellentStudents} students with grades 90% and above
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                {((metrics.excellentStudents / metrics.totalStudents) * 100).toFixed(1)}% of total students
              </p>
              <Progress
                value={(metrics.excellentStudents / Math.max(metrics.totalStudents, 1)) * 100}
                className="h-2"
              />
            </div>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Operational Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Operational Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{metrics.totalSubjects}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Subjects</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {metrics.averageClassSize.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Avg Class Size</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{metrics.teacherUtilization}%</p>
              <p className="text-xs text-muted-foreground mt-1">Teacher Utilization</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{metrics.activeExams}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Exams</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SchoolAdminReportsDashboard;
