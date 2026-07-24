import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  UserCheck,
  Calendar as CalendarIcon,
  FileText,
  CheckSquare,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { handleApiError } from "@/lib/api-error-handler";
import {
  attachClassesToStudents,
  attachStudentsToAttendance,
  calculateAttendanceSummary,
} from "./queries";
import { replaceAttendance } from "./mutations";
import type {
  AttendanceClass,
  AttendanceRecord,
  AttendanceStudent,
  AttendanceTeacher,
  AttendanceTimetable,
} from "./types";
import { AttendanceSummaryCard } from "./components/AttendanceSummaryCard";
import { useAttendanceFilters } from "./filters";
import { attendanceCsv, downloadAttendanceCsv } from "./export";

export function AttendancePage() {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const { selectedDate, selectedClass, setSelectedDate, setSelectedClass } =
    useAttendanceFilters();
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("mark");

  const loadClasses = useCallback(async () => {
    try {
      if (isPhpBackend) {
        if (!profile?.school_id) {
          setClasses([]);
          return;
        }

        const allClasses = await phpApi.table<AttendanceClass>("classes").list({
          select: "id,school_id,name,section,class_level",
          school_id: profile.school_id,
          is_active: 1,
          sort: "name",
          order: "asc",
          limit: 200,
        });

        if (canFull("attendance.record")) {
          const teachers = await phpApi
            .table<AttendanceTeacher>("teachers")
            .list({
              select: "id,user_id,school_id",
              school_id: profile.school_id,
              user_id: profile.user_id,
              limit: 1,
            });
          const teacher = teachers[0];

          if (!teacher) {
            setClasses([]);
            return;
          }

          const timetableRows = await phpApi
            .table<AttendanceTimetable>("timetable")
            .list({
              select: "id,school_id,teacher_id,class_id",
              school_id: profile.school_id,
              teacher_id: teacher.id,
              limit: 200,
            });
          const classIds = new Set(timetableRows.map((row) => row.class_id));

          setClasses(
            (allClasses || []).filter((classItem) =>
              classIds.has(classItem.id),
            ),
          );
          return;
        }

        setClasses(allClasses || []);
        return;
      }

      let query = apiClient.from("classes").select("*").eq("is_active", true);

      // Filter by school_id
      if (profile?.school_id) {
        query = query.eq("school_id", profile.school_id);
      }

      // For teachers, only show classes they teach
      if (canFull("attendance.record")) {
        // Get teacher record
        const { data: teacherData } = await apiClient
          .from("teachers")
          .select("id")
          .eq("user_id", profile.user_id)
          .single();

        if (teacherData) {
          // Get classes from timetable
          const { data: timetableData } = await apiClient
            .from("timetable")
            .select("class_id")
            .eq("teacher_id", teacherData.id);

          const classIds = [
            ...new Set(timetableData?.map((t) => t.class_id) || []),
          ];

          if (classIds.length > 0) {
            query = query.in("id", classIds);
          } else {
            // Teacher has no assigned classes
            setClasses([]);
            return;
          }
        }
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      const notice = handleApiError("Load attendance classes", error, {
        context: { schoolId: profile?.school_id, userId: profile?.user_id },
      });
      toast.error(notice.title, { description: notice.description });
    }
  }, [canFull, profile?.school_id, profile?.user_id]);

  const loadStudents = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const [studentRows, classRows] = await Promise.all([
          phpApi.table<AttendanceStudent>("students").list({
            select: "id,school_id,student_id,full_name,class_id",
            class_id: selectedClass,
            status: "active",
            sort: "student_id",
            order: "asc",
            limit: 300,
          }),
          phpApi.table<AttendanceClass>("classes").list({
            select: "id,school_id,name,section,class_level",
            limit: 300,
          }),
        ]);

        setStudents(
          attachClassesToStudents(studentRows || [], classRows || []),
        );
        return;
      }

      const { data, error } = await apiClient
        .from("students")
        .select(
          `
          *,
          classes:class_id (
            id,
            name,
            section
          )
        `,
        )
        .eq("class_id", selectedClass)
        .eq("status", "active")
        .order("student_id");

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      const notice = handleApiError("Load attendance students", error, {
        context: { classId: selectedClass },
      });
      toast.error(notice.title, { description: notice.description });
    }
  }, [selectedClass]);

  const loadAttendance = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const date = format(selectedDate, "yyyy-MM-dd");
        const [attendanceRows, studentRows] = await Promise.all([
          phpApi.table<AttendanceRecord>("attendance").list({
            select: "id,school_id,student_id,class_id,date,is_present,remarks",
            class_id: selectedClass,
            date,
            sort: "created_at",
            order: "asc",
            limit: 300,
          }),
          phpApi.table<AttendanceStudent>("students").list({
            select: "id,school_id,student_id,full_name,class_id",
            class_id: selectedClass,
            status: "active",
            limit: 300,
          }),
        ]);

        setAttendance(
          attachStudentsToAttendance(attendanceRows || [], studentRows || []),
        );
        return;
      }

      const { data, error } = await apiClient
        .from("attendance")
        .select(
          `
          *,
          students:student_id (
            id,
            student_id,
            full_name
          )
        `,
        )
        .eq("class_id", selectedClass)
        .eq("date", format(selectedDate, "yyyy-MM-dd"))
        .order("student_id");

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      const notice = handleApiError("Load attendance records", error, {
        context: {
          classId: selectedClass,
          date: format(selectedDate, "yyyy-MM-dd"),
        },
      });
      toast.error(notice.title, { description: notice.description });
    }
  }, [selectedClass, selectedDate]);

  // Load classes on component mount
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Load students when class is selected
  useEffect(() => {
    if (selectedClass) {
      loadStudents();
      loadAttendance();
    }
  }, [selectedClass, selectedDate, loadStudents, loadAttendance]);

  const handleAttendanceChange = (
    studentId: string,
    isPresent: boolean,
    remarks?: string,
  ) => {
    setAttendance((prev) => {
      const existing = prev.find((a) => a.student_id === studentId);
      if (existing) {
        return prev.map((a) =>
          a.student_id === studentId
            ? { ...a, is_present: isPresent, remarks }
            : a,
        );
      } else {
        return [
          ...prev,
          {
            student_id: studentId,
            class_id: selectedClass,
            date: format(selectedDate, "yyyy-MM-dd"),
            is_present: isPresent,
            remarks,
          },
        ];
      }
    });
  };

  const saveAttendance = async () => {
    if (!selectedClass || attendance.length === 0) {
      toast.error("Please select a class and mark attendance");
      return;
    }
    if (!profile?.school_id) {
      toast.error("School assignment is required to save attendance");
      return;
    }

    setLoading(true);
    try {
      await replaceAttendance({
        schoolId: profile.school_id,
        classId: selectedClass,
        date: selectedDate,
        records: attendance,
      });
      toast.success("Attendance saved successfully");
      await loadAttendance();
    } catch (error) {
      const notice = handleApiError("Save attendance", error, {
        context: {
          schoolId: profile.school_id,
          classId: selectedClass,
          date: format(selectedDate, "yyyy-MM-dd"),
          recordCount: attendance.length,
        },
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setLoading(false);
    }
  };

  const markAllPresent = () => {
    students.forEach((student) => {
      handleAttendanceChange(student.id, true);
    });
  };

  const markAllAbsent = () => {
    students.forEach((student) => {
      handleAttendanceChange(student.id, false);
    });
  };

  const setQuickStatus = (studentId: string, status: "present" | "absent") => {
    const isPresent = status === "present";
    handleAttendanceChange(studentId, isPresent, "");
  };

  const stats = useMemo(
    () => calculateAttendanceSummary(students, attendance),
    [attendance, students],
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Attendance Management
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Mark and track student attendance across classes
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4 md:space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger
            value="mark"
            className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm"
          >
            <UserCheck className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Mark Attendance</span>
            <span className="sm:hidden">Mark</span>
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm"
          >
            <FileText className="h-3 w-3 md:h-4 md:w-4" />
            <span>Reports</span>
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm"
          >
            <CalendarIcon className="h-3 w-3 md:h-4 md:w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-4 md:space-y-6">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-4">
            <Card className="lg:col-span-3">
              <CardHeader className="p-3 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <UserCheck className="h-5 w-5" />
                  Daily Attendance
                </CardTitle>
                <CardDescription className="text-sm">
                  Select a class and date to mark attendance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6">
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">
                      Select Class
                    </label>
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                    >
                      <SelectTrigger className="h-11 touch-target">
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} - Section {cls.section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:w-64">
                    <label className="text-sm font-medium mb-2 block">
                      Date
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-11 touch-target",
                            !selectedDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? (
                            format(selectedDate, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {selectedClass && (
                  <>
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Attendance Progress
                        </span>
                        <span className="font-medium">
                          {stats.marked} / {stats.total} students
                        </span>
                      </div>
                      <Progress
                        value={stats.completionPercentage}
                        className="h-2"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={markAllPresent}
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 touch-target flex-1 sm:flex-none"
                        >
                          <CheckSquare className="h-4 w-4 mr-1.5" />
                          All Present
                        </Button>
                        <Button
                          onClick={markAllAbsent}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 touch-target flex-1 sm:flex-none"
                        >
                          <AlertCircle className="h-4 w-4 mr-1.5" />
                          All Absent
                        </Button>
                      </div>
                      <Button
                        onClick={saveAttendance}
                        disabled={loading || stats.marked === 0}
                        size="sm"
                        className="w-full sm:w-auto touch-target h-10"
                      >
                        {loading
                          ? "Saving..."
                          : `Save Attendance (${stats.marked})`}
                      </Button>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {students.map((student) => {
                        const attendanceRecord = attendance.find(
                          (a) => a.student_id === student.id,
                        );
                        const isPresent = attendanceRecord?.is_present ?? null;
                        const isMarked = attendanceRecord !== undefined;

                        return (
                          <Card
                            key={student.id}
                            className={cn(
                              "p-4 transition-all",
                              isMarked &&
                                isPresent &&
                                "bg-green-50 border-green-200",
                              isMarked &&
                                !isPresent &&
                                "bg-red-50 border-red-200",
                            )}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base truncate">
                                      {student.full_name}
                                    </h3>
                                    {isMarked && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-xs",
                                          isPresent
                                            ? "bg-green-100 text-green-700 border-green-300"
                                            : "bg-red-100 text-red-700 border-red-300",
                                        )}
                                      >
                                        {isPresent ? (
                                          <Check className="h-3 w-3 mr-1" />
                                        ) : (
                                          <X className="h-3 w-3 mr-1" />
                                        )}
                                        {isPresent ? "Present" : "Absent"}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    ID: {student.student_id}
                                  </p>
                                </div>
                              </div>

                              {/* Quick Action Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant={
                                    isPresent === true ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    setQuickStatus(student.id, "present")
                                  }
                                  className={cn(
                                    "touch-target h-11",
                                    isPresent === true &&
                                      "bg-green-600 hover:bg-green-700",
                                  )}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    isPresent === false ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    setQuickStatus(student.id, "absent")
                                  }
                                  className={cn(
                                    "touch-target h-11",
                                    isPresent === false &&
                                      "bg-red-600 hover:bg-red-700",
                                  )}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Absent
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead className="text-center">
                              Present
                            </TableHead>
                            <TableHead className="text-center">
                              Absent
                            </TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((student) => {
                            const attendanceRecord = attendance.find(
                              (a) => a.student_id === student.id,
                            );
                            const isPresent =
                              attendanceRecord?.is_present ?? true;

                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">
                                  {student.student_id}
                                </TableCell>
                                <TableCell>{student.full_name}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={isPresent}
                                    onCheckedChange={(checked) =>
                                      handleAttendanceChange(
                                        student.id,
                                        !!checked,
                                        attendanceRecord?.remarks,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={!isPresent}
                                    onCheckedChange={(checked) =>
                                      handleAttendanceChange(
                                        student.id,
                                        !checked,
                                        attendanceRecord?.remarks,
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Textarea
                                    placeholder="Optional remarks..."
                                    value={attendanceRecord?.remarks || ""}
                                    onChange={(e) =>
                                      handleAttendanceChange(
                                        student.id,
                                        isPresent,
                                        e.target.value,
                                      )
                                    }
                                    className="min-h-8"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <AttendanceSummaryCard summary={stats} />
              <Card className="hidden lg:block">
                <CardContent className="p-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Reports</CardTitle>
              <CardDescription>
                Generate detailed attendance reports for analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Export the currently selected class and date.</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={!selectedClass || students.length === 0}
                  onClick={() =>
                    downloadAttendanceCsv(
                      `attendance-${selectedClass}-${format(selectedDate, "yyyy-MM-dd")}.csv`,
                      attendanceCsv(students, attendance),
                    )
                  }
                >
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Analytics</CardTitle>
              <CardDescription>
                View attendance trends and patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Attendance analytics feature coming soon...</p>
                <p className="text-sm">
                  Track trends, identify patterns, and generate insights
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
