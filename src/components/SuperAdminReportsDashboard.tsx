import { useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Download,
  GraduationCap,
  School,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DashboardSkeleton } from '@/components/ui/skeleton-loader';
import { DashboardRefreshStatus } from '@/components/DashboardRefreshStatus';
import {
  type SuperAdminDashboardStats,
  type SuperAdminSchoolTypeStats,
  useSuperAdminDashboardData,
} from '@/hooks/useSuperAdminDashboardData';

const schoolTypeLabels: Record<keyof SuperAdminSchoolTypeStats, string> = {
  bangla_medium: 'Bangla Medium',
  english_medium: 'English Medium',
  madrasha: 'Madrasha',
};

const safeAverage = (total: number, divisor: number) =>
  divisor > 0 ? Math.round((total / divisor) * 10) / 10 : 0;

export const buildPlatformReportMetrics = (stats: SuperAdminDashboardStats) => ({
  activationRate: safeAverage(stats.activeSchools * 100, stats.totalSchools),
  studentsPerSchool: safeAverage(stats.totalStudents, stats.activeSchools),
  teachersPerSchool: safeAverage(stats.totalTeachers, stats.activeSchools),
  studentTeacherRatio: safeAverage(stats.totalStudents, stats.totalTeachers),
  adminCoverage: safeAverage(stats.totalSchoolAdmins * 100, stats.totalSchools),
  inactiveSchools: Math.max(stats.totalSchools - stats.activeSchools, 0),
  schoolsWithoutAdmin: Math.max(stats.totalSchools - stats.totalSchoolAdmins, 0),
});

export function SuperAdminReportsDashboard() {
  const {
    stats,
    schoolTypeStats,
    loading,
    error,
    fetching,
    refetch,
    lastUpdatedAt,
  } = useSuperAdminDashboardData();

  const report = useMemo(() => buildPlatformReportMetrics(stats), [stats]);
  const schoolTypes = useMemo(
    () =>
      (Object.entries(schoolTypeStats) as Array<[keyof SuperAdminSchoolTypeStats, number]>)
        .map(([type, count]) => ({
          type,
          label: schoolTypeLabels[type],
          count,
          percentage: safeAverage(count * 100, stats.totalSchools),
        }))
        .sort((a, b) => b.count - a.count),
    [schoolTypeStats, stats.totalSchools],
  );

  const exportReport = useCallback(() => {
    const rows = [
      ['Metric', 'Value'],
      ['Total schools', stats.totalSchools],
      ['Active schools', stats.activeSchools],
      ['Activation rate', `${report.activationRate}%`],
      ['Total students', stats.totalStudents],
      ['Total teachers', stats.totalTeachers],
      ['Total classes', stats.totalClasses],
      ['Total subjects', stats.totalSubjects],
      ['School administrators', stats.totalSchoolAdmins],
      ['Pending applications', stats.pendingApplications],
      ['Schools added this month', stats.schoolsThisMonth],
      ['Students added this month', stats.studentsThisMonth],
      ['Teachers added this month', stats.teachersThisMonth],
      ...schoolTypes.map((item) => [`${item.label} schools`, item.count]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `schoolxnow-platform-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [report.activationRate, schoolTypes, stats]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform scope
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Network-wide adoption, capacity, growth, and operational health.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardRefreshStatus
            updatedAt={lastUpdatedAt}
            fetching={fetching}
            onRefresh={refetch}
          />
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Some platform metrics could not be refreshed. The last successful data remains visible.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active schools"
          value={`${stats.activeSchools} / ${stats.totalSchools}`}
          detail={`${report.activationRate}% activation`}
          icon={<School className="h-5 w-5" />}
        />
        <MetricCard
          title="Students"
          value={stats.totalStudents.toLocaleString()}
          detail={`${report.studentsPerSchool} per active school`}
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <MetricCard
          title="Teachers"
          value={stats.totalTeachers.toLocaleString()}
          detail={`${report.studentTeacherRatio}:1 student–teacher ratio`}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          title="Monthly growth"
          value={`${stats.monthlyGrowth > 0 ? '+' : ''}${stats.monthlyGrowth}%`}
          detail={`${stats.schoolsThisMonth} new schools this month`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              School portfolio
            </CardTitle>
            <CardDescription>Distribution across registered institution types.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {schoolTypes.map((item) => (
              <div key={item.type} className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.count} schools · {item.percentage}%
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational attention</CardTitle>
            <CardDescription>Items requiring platform-level follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AttentionRow label="Inactive schools" value={report.inactiveSchools} />
            <AttentionRow label="Schools without admin coverage" value={report.schoolsWithoutAdmin} />
            <AttentionRow label="Pending teacher applications" value={stats.pendingApplications} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Network capacity
          </CardTitle>
          <CardDescription>Compact ratios for capacity planning and support allocation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Active classes" value={stats.totalClasses.toLocaleString()} />
          <SummaryItem label="Subjects offered" value={stats.totalSubjects.toLocaleString()} />
          <SummaryItem label="Teachers per school" value={String(report.teachersPerSchool)} />
          <SummaryItem label="Admin coverage" value={`${report.adminCoverage}%`} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function AttentionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={value > 0 ? 'destructive' : 'secondary'}>{value}</Badge>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default SuperAdminReportsDashboard;
