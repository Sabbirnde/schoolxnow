import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/php-api/compat-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Users, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  class_id: string;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  is_present: boolean;
}

interface QuickAttendanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId?: string;
  className?: string;
  date?: Date;
}

export function QuickAttendanceSheet({ 
  open, 
  onOpenChange, 
  classId, 
  className = "Selected Class",
  date = new Date() 
}: QuickAttendanceSheetProps) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<Set<string>>(new Set());

  const loadStudentsAndAttendance = useCallback(async () => {
    if (!classId || !profile?.school_id) return;

    try {
      setLoading(true);
      const dateStr = format(date, 'yyyy-MM-dd');

      if (isPhpBackend) {
        const [studentsData, attendanceData] = await Promise.all([
          phpApi.table<Student>('students').list({
            class_id: classId,
            status: 'active',
            sort: 'student_id',
            order: 'asc',
            limit: 200,
          }),
          phpApi.table<AttendanceRecord>('attendance').list({
            class_id: classId,
            date: dateStr,
            limit: 200,
          }),
        ]);

        setStudents(studentsData);

        const attendanceMap: Record<string, boolean> = {};
        const existingIds = new Set<string>();
        attendanceData.forEach(record => {
          attendanceMap[record.student_id] = Boolean(record.is_present);
          existingIds.add(record.student_id);
        });

        setAttendance(attendanceMap);
        setExistingAttendance(existingIds);
        return;
      }

      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('student_id');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Load existing attendance for this date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, is_present')
        .eq('class_id', classId)
        .eq('date', dateStr);

      if (attendanceError) throw attendanceError;

      // Set existing attendance
      const attendanceMap: Record<string, boolean> = {};
      const existingIds = new Set<string>();
      attendanceData?.forEach(record => {
        attendanceMap[record.student_id] = record.is_present;
        existingIds.add(record.student_id);
      });
      
      setAttendance(attendanceMap);
      setExistingAttendance(existingIds);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [classId, date, profile?.school_id]);

  useEffect(() => {
    if (open && classId) {
      loadStudentsAndAttendance();
    }
  }, [open, classId, date, loadStudentsAndAttendance]);

  const toggleAttendance = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const markAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    students.forEach(student => {
      allPresent[student.id] = true;
    });
    setAttendance(allPresent);
  };

  const markAllAbsent = () => {
    const allAbsent: Record<string, boolean> = {};
    students.forEach(student => {
      allAbsent[student.id] = false;
    });
    setAttendance(allAbsent);
  };

  const saveAttendance = async () => {
    if (!classId || !profile?.school_id) return;

    try {
      setSaving(true);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Prepare attendance records
      const records = students.map(student => ({
        school_id: profile.school_id!,
        student_id: student.id,
        class_id: classId,
        date: dateStr,
        is_present: attendance[student.id] ?? false,
      }));

      if (isPhpBackend) {
        const existingRows = await phpApi.table<AttendanceRecord>('attendance').list({
          class_id: classId,
          date: dateStr,
          limit: 200,
        });

        await Promise.all(
          existingRows
            .filter((record) => record.id)
            .map((record) => phpApi.table<AttendanceRecord>('attendance').delete(record.id as string))
        );

        await Promise.all(
          records.map((record) => phpApi.table<AttendanceRecord>('attendance').create(record))
        );

        const presentCount = Object.values(attendance).filter(Boolean).length;
        const absentCount = students.length - presentCount;

        toast.success(`Attendance saved! ${presentCount} present, ${absentCount} absent`);
        onOpenChange(false);
        return;
      }

      // Delete existing records for this class and date
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', classId)
        .eq('date', dateStr);

      if (deleteError) throw deleteError;

      // Insert new records
      const { error: insertError } = await supabase
        .from('attendance')
        .insert(records);

      if (insertError) throw insertError;

      const presentCount = Object.values(attendance).filter(Boolean).length;
      const absentCount = students.length - presentCount;

      toast.success(`Attendance saved! ${presentCount} present, ${absentCount} absent`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = students.length - presentCount;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Quick Attendance
          </SheetTitle>
          <SheetDescription className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{className}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <CalendarIcon className="h-3 w-3" />
              <span>{format(date, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            {existingAttendance.size > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                Attendance already taken - editing mode
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{students.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
              <div className="text-xs text-muted-foreground">Present</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllPresent}
              className="flex-1 text-green-600 border-green-600/20 hover:bg-green-600/10"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              All Present
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAbsent}
              className="flex-1 text-red-600 border-red-600/20 hover:bg-red-600/10"
            >
              <XCircle className="h-4 w-4 mr-2" />
              All Absent
            </Button>
          </div>

          {/* Student List */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found in this class
              </div>
            ) : (
              students.map((student) => (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    attendance[student.id]
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      checked={attendance[student.id] || false}
                      onCheckedChange={() => toggleAttendance(student.id)}
                      className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                    <div>
                      <div className="font-medium text-sm">{student.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {student.student_id}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={attendance[student.id] ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {attendance[student.id] ? 'Present' : 'Absent'}
                  </Badge>
                </div>
              ))
            )}
          </div>

          {/* Save Button */}
          <div className="sticky bottom-0 pt-4 pb-2 bg-background">
            <Button
              onClick={saveAttendance}
              disabled={saving || loading || students.length === 0}
              className="w-full"
              size="lg"
            >
              {saving ? 'Saving...' : existingAttendance.size > 0 ? 'Update Attendance' : 'Save Attendance'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
