/**
 * Report Export Service
 * Handles CSV, Excel, and PDF export generation
 */

import {
  DashboardMetrics,
  ClassReport,
  SubjectReport,
  StudentDetailedReport,
  AttendanceTrend,
} from './report-data';

// ============================================================================
// CSV Export Functions
// ============================================================================

/**
 * Convert array of objects to CSV string
 */
function convertToCSV<T extends Record<string, any>>(data: T[], headers?: string[]): string {
  if (data.length === 0) return '';

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Add header row
  const headerRow = csvHeaders.join(',');

  // Add data rows
  const dataRows = data.map(item =>
    csvHeaders
      .map(header => {
        const value = getNestedValue(item, header);
        // Escape quotes and wrap in quotes if contains comma
        return typeof value === 'string' && value.includes(',')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Get nested property value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

/**
 * Trigger browser download of CSV file
 */
function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// Excel Export Functions (Simple approach without library)
// ============================================================================

/**
 * Simple Excel format generator (using XLSX format)
 * Note: For production, consider using xlsx or similar library
 */
function convertToExcel<T extends Record<string, any>>(
  data: T[],
  sheetName: string = 'Sheet1',
  headers?: string[]
): ArrayBuffer {
  if (data.length === 0) {
    return new ArrayBuffer(0);
  }

  const csvHeaders = headers || Object.keys(data[0]);
  const headerRow = csvHeaders.join('\t');

  const dataRows = data.map(item =>
    csvHeaders
      .map(header => getNestedValue(item, header))
      .join('\t')
  );

  const content = [headerRow, ...dataRows].join('\n');

  return new TextEncoder().encode(content).buffer;
}

/**
 * Download as Excel-compatible TSV file
 */
function downloadAsExcel(data: any[], filename: string, headers?: string[]): void {
  const csv = convertToCSV(data, headers);
  // Convert to TSV for better Excel compatibility
  const tsv = csv.replace(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g, '\t');

  const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// PDF Generation (HTML-based approach)
// ============================================================================

/**
 * Generate PDF-ready HTML content
 * Note: For actual PDF generation, use a library like jsPDF or html2pdf
 */
function generatePDFContent(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          h1 { color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
          h2 { color: #1e40af; margin-top: 20px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) { background-color: #f9fafb; }
          .metric-card {
            display: inline-block;
            margin: 10px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            min-width: 200px;
          }
          .metric-label { font-size: 12px; color: #666; }
          .metric-value { font-size: 24px; font-weight: bold; color: #0f172a; }
          .page-break { page-break-after: always; }
          footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #999;
          }
        </style>
      </head>
      <body>
        ${content}
        <footer>
          Generated on ${new Date().toLocaleString()} by SchoolXNow
        </footer>
      </body>
    </html>
  `;
}

/**
 * Download as printable PDF (via print preview)
 */
function downloadAsPDF(htmlContent: string, filename: string): void {
  const pdfWindow = window.open('', '', 'height=500,width=500');
  if (!pdfWindow) return;

  pdfWindow.document.write(htmlContent);
  pdfWindow.focus();

  // Use browser's print dialog to save as PDF
  setTimeout(() => {
    pdfWindow.print();
  }, 250);
}

// ============================================================================
// Dashboard Report Export
// ============================================================================

export function exportDashboardMetricsCSV(metrics: DashboardMetrics, schoolName: string): void {
  const data = [
    { metric: 'Total Students', value: metrics.totalStudents },
    { metric: 'Active Students', value: metrics.activeStudents },
    { metric: 'Enrollment Trend (%)', value: metrics.enrollmentTrend },
    { metric: 'Average Class Size', value: metrics.averageClassSize.toFixed(2) },
    { metric: 'Average Attendance (%)', value: metrics.averageAttendance },
    { metric: 'Average Performance (%)', value: metrics.averagePerformance },
    { metric: 'At-Risk Students', value: metrics.atRiskStudents },
    { metric: 'Excellent Students', value: metrics.excellentStudents },
    { metric: 'Total Teachers', value: metrics.totalTeachers },
    { metric: 'Teacher Utilization (%)', value: metrics.teacherUtilization },
    { metric: 'Total Classes', value: metrics.totalClasses },
    { metric: 'Total Subjects', value: metrics.totalSubjects },
    { metric: 'Active Exams', value: metrics.activeExams },
  ];

  const csv = convertToCSV(data, ['metric', 'value']);
  downloadCSV(csv, `Dashboard_Metrics_${schoolName}_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportDashboardMetricsExcel(metrics: DashboardMetrics, schoolName: string): void {
  const data = [
    { metric: 'Total Students', value: metrics.totalStudents },
    { metric: 'Active Students', value: metrics.activeStudents },
    { metric: 'Enrollment Trend (%)', value: metrics.enrollmentTrend },
    { metric: 'Average Class Size', value: metrics.averageClassSize.toFixed(2) },
    { metric: 'Average Attendance (%)', value: metrics.averageAttendance },
    { metric: 'Average Performance (%)', value: metrics.averagePerformance },
    { metric: 'At-Risk Students', value: metrics.atRiskStudents },
    { metric: 'Excellent Students', value: metrics.excellentStudents },
    { metric: 'Total Teachers', value: metrics.totalTeachers },
    { metric: 'Teacher Utilization (%)', value: metrics.teacherUtilization },
    { metric: 'Total Classes', value: metrics.totalClasses },
    { metric: 'Total Subjects', value: metrics.totalSubjects },
    { metric: 'Active Exams', value: metrics.activeExams },
  ];

  downloadAsExcel(data, `Dashboard_Metrics_${schoolName}_${new Date().toISOString().split('T')[0]}.xlsx`, ['metric', 'value']);
}

export function exportDashboardMetricsPDF(metrics: DashboardMetrics, schoolName: string): void {
  const content = `
    <h1>📊 Dashboard Metrics Report</h1>
    <h2>School: ${schoolName}</h2>
    <p>Report Generated: ${new Date().toLocaleDateString()}</p>

    <h3>Enrollment Metrics</h3>
    <div class="metric-card">
      <div class="metric-label">Total Students</div>
      <div class="metric-value">${metrics.totalStudents}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Active Students</div>
      <div class="metric-value">${metrics.activeStudents}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Avg Class Size</div>
      <div class="metric-value">${metrics.averageClassSize.toFixed(1)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Enrollment Trend</div>
      <div class="metric-value">${metrics.enrollmentTrend > 0 ? '↑' : '↓'} ${Math.abs(metrics.enrollmentTrend)}%</div>
    </div>

    <h3>Academic Metrics</h3>
    <div class="metric-card">
      <div class="metric-label">Average Attendance</div>
      <div class="metric-value">${metrics.averageAttendance}%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Average Performance</div>
      <div class="metric-value">${metrics.averagePerformance}%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">At-Risk Students</div>
      <div class="metric-value">${metrics.atRiskStudents}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Excellent Students</div>
      <div class="metric-value">${metrics.excellentStudents}</div>
    </div>

    <h3>Operational Metrics</h3>
    <div class="metric-card">
      <div class="metric-label">Total Teachers</div>
      <div class="metric-value">${metrics.totalTeachers}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Teacher Utilization</div>
      <div class="metric-value">${metrics.teacherUtilization}%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Classes</div>
      <div class="metric-value">${metrics.totalClasses}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Subjects</div>
      <div class="metric-value">${metrics.totalSubjects}</div>
    </div>
  `;

  const html = generatePDFContent(content, `Dashboard Metrics - ${schoolName}`);
  downloadAsPDF(html, `Dashboard_Metrics_${schoolName}`);
}

// ============================================================================
// Class Report Export
// ============================================================================

export function exportClassReportCSV(classReport: ClassReport): void {
  const data = [
    {
      metric: 'Class',
      value: `${classReport.className} - Section ${classReport.section}`,
    },
    { metric: 'Total Students', value: classReport.totalStudents },
    { metric: 'Average Attendance', value: `${classReport.averageAttendance}%` },
    { metric: 'Average Marks', value: `${classReport.averageMarks}%` },
    {
      metric: 'Top Student',
      value: classReport.topStudent ? `${classReport.topStudent.name} (${classReport.topStudent.marks}%)` : 'N/A',
    },
    {
      metric: 'Low Performers Count',
      value: classReport.lowPerformers.length,
    },
  ];

  const csv = convertToCSV(data, ['metric', 'value']);
  downloadCSV(
    csv,
    `Class_Report_${classReport.className}_Section_${classReport.section}_${new Date().toISOString().split('T')[0]}.csv`
  );
}

export function exportClassReportExcel(classReport: ClassReport): void {
  const data = [
    { metric: 'Class', value: `${classReport.className} - Section ${classReport.section}` },
    { metric: 'Total Students', value: classReport.totalStudents },
    { metric: 'Average Attendance', value: classReport.averageAttendance },
    { metric: 'Average Marks', value: classReport.averageMarks },
  ];

  downloadAsExcel(
    data,
    `Class_Report_${classReport.className}_Section_${classReport.section}_${new Date().toISOString().split('T')[0]}.xlsx`,
    ['metric', 'value']
  );
}

export function exportClassReportPDF(classReport: ClassReport): void {
  const subjectRows = classReport.subjectWisePerformance
    .map(
      s =>
        `<tr>
        <td>${s.subjectName}</td>
        <td>${s.averageMarks}%</td>
        <td>${s.passPercentage}%</td>
       </tr>`
    )
    .join('');

  const lowPerformerRows = classReport.lowPerformers
    .map(
      lp =>
        `<tr>
        <td>${lp.name}</td>
        <td>${lp.marks}%</td>
      </tr>`
    )
    .join('');

  const content = `
    <h1>📋 Class Performance Report</h1>
    <h2>${classReport.className} - Section ${classReport.section}</h2>

    <h3>Class Overview</h3>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Students</td><td>${classReport.totalStudents}</td></tr>
      <tr><td>Average Attendance</td><td>${classReport.averageAttendance}%</td></tr>
      <tr><td>Average Marks</td><td>${classReport.averageMarks}%</td></tr>
    </table>

    <h3>Top Performer</h3>
    ${
      classReport.topStudent
        ? `<p><strong>${classReport.topStudent.name}</strong> - ${classReport.topStudent.marks}%</p>`
        : '<p>No data available</p>'
    }

    <h3>Low Performers (Below 40%)</h3>
    <table>
      <tr><th>Student Name</th><th>Marks</th></tr>
      ${lowPerformerRows || '<tr><td colspan="2">No low performers</td></tr>'}
    </table>

    <h3>Subject-wise Performance</h3>
    <table>
      <tr><th>Subject</th><th>Average Marks</th><th>Pass Percentage</th></tr>
      ${subjectRows}
    </table>
  `;

  const html = generatePDFContent(content, `Class Report - ${classReport.className}`);
  downloadAsPDF(html, `Class_Report_${classReport.className}`);
}

// ============================================================================
// Student Report Export
// ============================================================================

export function exportStudentReportCSV(studentReport: StudentDetailedReport): void {
  const data = [
    { key: 'Student Name', value: studentReport.studentName },
    { key: 'Roll Number', value: studentReport.rollNumber },
    { key: 'Class', value: studentReport.className },
    { key: 'Section', value: studentReport.section },
    { key: 'Total Attendance Days', value: studentReport.totalAttendance },
    { key: 'Attendance Percentage', value: `${studentReport.attendancePercentage}%` },
    { key: 'Overall Grade', value: studentReport.overallGrade },
    { key: 'Performance Status', value: studentReport.performanceStatus },
  ];

  const csv = convertToCSV(data, ['key', 'value']);
  downloadCSV(csv, `Student_Report_${studentReport.studentName}_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportStudentReportPDF(studentReport: StudentDetailedReport): void {
  const examRows = studentReport.examMarks
    .map(exam => {
      const subjectRows = exam.subjects
        .map(
          s =>
            `<tr>
          <td>${s.subjectName}</td>
          <td>${s.marks}/${s.total}</td>
          <td>${s.percentage.toFixed(1)}%</td>
          <td>${s.grade}</td>
        </tr>`
        )
        .join('');

      return `
        <h4>${exam.examName}</h4>
        <table>
          <tr><th>Subject</th><th>Marks</th><th>Percentage</th><th>Grade</th></tr>
          ${subjectRows}
        </table>
      `;
    })
    .join('');

  const content = `
    <h1>📝 Student Performance Report</h1>
    <h2>${studentReport.studentName}</h2>

    <h3>Student Information</h3>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Roll Number</td><td>${studentReport.rollNumber}</td></tr>
      <tr><td>Class</td><td>${studentReport.className} - ${studentReport.section}</td></tr>
      <tr><td>Total Attendance Days</td><td>${studentReport.totalAttendance}</td></tr>
      <tr><td>Attendance Percentage</td><td>${studentReport.attendancePercentage}%</td></tr>
    </table>

    <h3>Academic Summary</h3>
    <div class="metric-card">
      <div class="metric-label">Overall Grade</div>
      <div class="metric-value">${studentReport.overallGrade}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Performance</div>
      <div class="metric-value">${studentReport.performanceStatus.toUpperCase()}</div>
    </div>

    <h3>Exam-wise Marks</h3>
    ${examRows}
  `;

  const html = generatePDFContent(content, `Student Report - ${studentReport.studentName}`);
  downloadAsPDF(html, `Student_Report_${studentReport.studentName}`);
}

// ============================================================================
// Attendance Trend Export
// ============================================================================

export function exportAttendanceTrendCSV(trends: AttendanceTrend[], className: string): void {
  const data = trends.map(t => ({
    date: t.date,
    present: t.presentCount,
    absent: t.absentCount,
    leave: t.leaveCount,
    attendance_percentage: t.attendancePercentage.toFixed(1),
  }));

  const csv = convertToCSV(data, ['date', 'present', 'absent', 'leave', 'attendance_percentage']);
  downloadCSV(csv, `Attendance_Trend_${className}_${new Date().toISOString().split('T')[0]}.csv`);
}
