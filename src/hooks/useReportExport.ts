/**
 * Hook for managing report exports across the application
 * Provides easy-to-use export functions with loading states and error handling
 */

import { useCallback, useState } from 'react';
import {
  DashboardMetrics,
  ClassReport,
  StudentDetailedReport,
  AttendanceTrend,
  TeacherMetrics,
  TeacherClassReport,
  TeacherSubjectReport,
} from '@/lib/report-data';
import {
  exportDashboardMetricsCSV,
  exportDashboardMetricsExcel,
  exportDashboardMetricsPDF,
  exportClassReportCSV,
  exportClassReportExcel,
  exportClassReportPDF,
  exportStudentReportCSV,
  exportStudentReportPDF,
  exportAttendanceTrendCSV,
} from '@/lib/report-generator';
import { useToast } from './use-toast';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

interface ExportState {
  isExporting: boolean;
  format: ExportFormat | null;
}

/**
 * Hook for exporting dashboard metrics
 */
export function useDashboardMetricsExport() {
  const { toast } = useToast();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
  });

  const exportMetrics = useCallback(
    async (metrics: DashboardMetrics, schoolName: string, format: ExportFormat) => {
      setState({ isExporting: true, format });

      try {
        switch (format) {
          case 'csv':
            exportDashboardMetricsCSV(metrics, schoolName);
            break;
          case 'excel':
            exportDashboardMetricsExcel(metrics, schoolName);
            break;
          case 'pdf':
            exportDashboardMetricsPDF(metrics, schoolName);
            break;
        }

        toast({
          title: 'Export Successful',
          description: `Dashboard metrics exported as ${format.toUpperCase()}`,
        });
      } catch (error) {
        console.error(`Error exporting as ${format}:`, error);
        toast({
          title: 'Export Failed',
          description: `Failed to export as ${format.toUpperCase()}`,
          variant: 'destructive',
        });
      } finally {
        setState({ isExporting: false, format: null });
      }
    },
    [toast]
  );

  return {
    exportMetrics,
    isExporting: state.isExporting,
    currentFormat: state.format,
  };
}

/**
 * Hook for exporting class reports
 */
export function useClassReportExport() {
  const { toast } = useToast();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
  });

  const exportClassReport = useCallback(
    async (classReport: ClassReport, format: ExportFormat) => {
      setState({ isExporting: true, format });

      try {
        switch (format) {
          case 'csv':
            exportClassReportCSV(classReport);
            break;
          case 'excel':
            exportClassReportExcel(classReport);
            break;
          case 'pdf':
            exportClassReportPDF(classReport);
            break;
        }

        toast({
          title: 'Export Successful',
          description: `Class report exported as ${format.toUpperCase()}`,
        });
      } catch (error) {
        console.error(`Error exporting as ${format}:`, error);
        toast({
          title: 'Export Failed',
          description: `Failed to export as ${format.toUpperCase()}`,
          variant: 'destructive',
        });
      } finally {
        setState({ isExporting: false, format: null });
      }
    },
    [toast]
  );

  return {
    exportClassReport,
    isExporting: state.isExporting,
    currentFormat: state.format,
  };
}

/**
 * Hook for exporting student reports
 */
export function useStudentReportExport() {
  const { toast } = useToast();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
  });

  const exportStudentReport = useCallback(
    async (studentReport: StudentDetailedReport, format: ExportFormat) => {
      setState({ isExporting: true, format });

      try {
        switch (format) {
          case 'csv':
            exportStudentReportCSV(studentReport);
            break;
          case 'pdf':
            exportStudentReportPDF(studentReport);
            break;
          default:
            toast({
              title: 'Format Not Supported',
              description: 'Excel export not available for student reports',
              variant: 'destructive',
            });
            return;
        }

        toast({
          title: 'Export Successful',
          description: `Student report exported as ${format.toUpperCase()}`,
        });
      } catch (error) {
        console.error(`Error exporting as ${format}:`, error);
        toast({
          title: 'Export Failed',
          description: `Failed to export as ${format.toUpperCase()}`,
          variant: 'destructive',
        });
      } finally {
        setState({ isExporting: false, format: null });
      }
    },
    [toast]
  );

  return {
    exportStudentReport,
    isExporting: state.isExporting,
    currentFormat: state.format,
  };
}

/**
 * Hook for exporting attendance trends
 */
export function useAttendanceTrendExport() {
  const { toast } = useToast();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
  });

  const exportTrend = useCallback(
    async (trends: AttendanceTrend[], className: string, format: ExportFormat) => {
      setState({ isExporting: true, format });

      try {
        if (format === 'csv') {
          exportAttendanceTrendCSV(trends, className);
        } else {
          toast({
            title: 'Format Not Supported',
            description: 'Only CSV export is available for attendance trends',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Export Successful',
          description: `Attendance trends exported as ${format.toUpperCase()}`,
        });
      } catch (error) {
        console.error(`Error exporting as ${format}:`, error);
        toast({
          title: 'Export Failed',
          description: `Failed to export as ${format.toUpperCase()}`,
          variant: 'destructive',
        });
      } finally {
        setState({ isExporting: false, format: null });
      }
    },
    [toast]
  );

  return {
    exportTrend,
    isExporting: state.isExporting,
    currentFormat: state.format,
  };
}

/**
 * Generic hook for handling multiple exports
 */
export function useTeacherMetricsExport() {
  const { toast } = useToast();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
  });

  const exportMetrics = useCallback(
    async (metrics: TeacherMetrics[], format: ExportFormat) => {
      setState({ isExporting: true, format });

      try {
        if (format === 'csv') {
          const csv = [
            ['Teacher Name', 'Email', 'Classes', 'Subjects', 'Students', 'Avg Performance', 'Avg Attendance', 'Performance Impact'].join(','),
            ...metrics.map(m =>
              [
                m.teacherName,
                m.email,
                m.assignedClasses,
                m.assignedSubjects,
                m.studentsTaught,
                m.averageStudentPerformance,
                m.averageStudentAttendance,
                m.performanceImpact,
              ]
                .map(v => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v))
                .join(',')
            ),
          ].join('\n');

          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `teacher-metrics-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        } else if (format === 'excel') {
          const tsv = [
            ['Teacher Name', 'Email', 'Classes', 'Subjects', 'Students', 'Avg Performance', 'Avg Attendance', 'Performance Impact'].join('\t'),
            ...metrics.map(m =>
              [
                m.teacherName,
                m.email,
                m.assignedClasses,
                m.assignedSubjects,
                m.studentsTaught,
                m.averageStudentPerformance,
                m.averageStudentAttendance,
                m.performanceImpact,
              ].join('\t')
            ),
          ].join('\n');

          const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `teacher-metrics-${new Date().toISOString().split('T')[0]}.xlsx`;
          link.click();
          URL.revokeObjectURL(url);
        }

        toast({
          title: 'Export Successful',
          description: `Teacher metrics exported as ${format.toUpperCase()}`,
        });
      } catch (error) {
        console.error(`Error exporting as ${format}:`, error);
        toast({
          title: 'Export Failed',
          description: `Failed to export as ${format.toUpperCase()}`,
          variant: 'destructive',
        });
      } finally {
        setState({ isExporting: false, format: null });
      }
    },
    [toast]
  );

  return {
    exportMetrics,
    isExporting: state.isExporting,
    currentFormat: state.format,
  };
}

/**
 * Hook for exporting teacher class reports
 */
export function useTeacherClassReportExport() {
  const { toast } = useToast();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
  });

  const exportReport = useCallback(
    async (report: TeacherClassReport, format: ExportFormat) => {
      setState({ isExporting: true, format });

      try {
        if (format === 'csv') {
          const csv = [
            `Teacher: ${report.teacherName}`,
            `Class: ${report.className} - Section ${report.section}`,
            `Total Students: ${report.totalStudents}`,
            `Average Performance: ${report.averagePerformance}%`,
            `Average Attendance: ${report.averageAttendance}%`,
            '',
            'Subject Performance',
            ['Subject', 'Average Marks', 'Students', 'Pass %'].join(','),
            ...report.subjectWisePerformance.map(s =>
              [s.subjectName, s.averageMarks, s.studentCount, s.passPercentage].join(',')
            ),
          ].join('\n');

          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `teacher-class-report-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        }

        toast({
          title: 'Export Successful',
          description: `Class report exported as ${format.toUpperCase()}`,
        });
      } catch (error) {
        console.error(`Error exporting as ${format}:`, error);
        toast({
          title: 'Export Failed',
          description: `Failed to export as ${format.toUpperCase()}`,
          variant: 'destructive',
        });
      } finally {
        setState({ isExporting: false, format: null });
      }
    },
    [toast]
  );

  return {
    exportReport,
    isExporting: state.isExporting,
    currentFormat: state.format,
  };
}

/**
 * Generic hook for handling multiple exports
 */
export function useReportExport() {
  const metricsExport = useDashboardMetricsExport();
  const classExport = useClassReportExport();
  const studentExport = useStudentReportExport();
  const attendanceExport = useAttendanceTrendExport();
  const teacherMetricsExport = useTeacherMetricsExport();
  const teacherClassExport = useTeacherClassReportExport();

  return {
    metrics: metricsExport,
    classReport: classExport,
    studentReport: studentExport,
    attendance: attendanceExport,
    teacherMetrics: teacherMetricsExport,
    teacherClass: teacherClassExport,
  };
}
