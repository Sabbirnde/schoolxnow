import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/php-api/compat-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import type { Database } from "@/integrations/database/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Save, CheckCircle, GraduationCap, Award, TrendingUp, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/api-error-handler";

interface Exam {
  id: string;
  school_id?: string;
  name: string;
  name_bangla?: string;
  class_level: string;
  exam_date: string;
  total_marks: number;
  pass_marks: number;
}

interface Subject {
  id: string;
  school_id?: string;
  name: string;
  code: string;
  class_level: string;
}

interface Student {
  id: string;
  school_id?: string;
  student_id: string;
  full_name: string;
  class_id: string;
}

interface ExamResult {
  id?: string;
  school_id?: string;
  exam_id?: string;
  student_id: string;
  subject_id?: string;
  obtained_marks: number;
  total_marks?: number;
  grade?: string;
}

interface ClassRecord {
  id: string;
  school_id: string;
  class_level: string;
}

type ExamResultInsert = Database["public"]["Tables"]["exam_results"]["Insert"];
type StudentWithClass = Student & {
  classes: {
    class_level: string;
  } | null;
};

const toStudentWithClassLevel = (studentRows: Student[], classRows: ClassRecord[]): StudentWithClass[] => {
  const classById = new Map(classRows.map((classItem) => [classItem.id, classItem]));

  return studentRows.map((student) => {
    const classItem = classById.get(student.class_id);
    return {
      ...student,
      classes: classItem ? { class_level: classItem.class_level } : null,
    };
  });
};

interface ExamMarksEntryProps {
  onComplete?: () => void;
}

function ExamMarksEntry({ onComplete }: ExamMarksEntryProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [existingResults, setExistingResults] = useState<Record<string, ExamResult>>({});
  const [saving, setSaving] = useState(false);
  const [savedStudents, setSavedStudents] = useState<Set<string>>(new Set());

  const loadExams = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const params: Record<string, string | number> = {
          is_active: 1,
          sort: 'exam_date',
          order: 'desc',
          limit: 200,
        };

        if (profile?.school_id) {
          params.school_id = profile.school_id;
        }

        const data = await phpApi.table<Exam>('exams').list(params);
        setExams(data || []);
        return;
      }

      let query = supabase
        .from('exams')
        .select('*')
        .eq('is_active', true);

      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('exam_date', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      const notice = handleSupabaseError('Load exams for marks entry', error, {
        context: { schoolId: profile?.school_id },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  }, [profile?.school_id, toast]);

  const loadSubjects = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const params: Record<string, string | number> = {
          is_active: 1,
          sort: 'name',
          order: 'asc',
          limit: 300,
        };

        if (profile?.school_id) {
          params.school_id = profile.school_id;
        }

        const data = await phpApi.table<Subject>('subjects').list(params);
        setSubjects(data || []);
        return;
      }

      let query = supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true);

      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      const notice = handleSupabaseError('Load subjects for marks entry', error, {
        context: { schoolId: profile?.school_id },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  }, [profile?.school_id, toast]);

  const loadStudents = useCallback(async () => {
    if (!selectedExam) return;

    try {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;

      if (isPhpBackend) {
        const params: Record<string, string | number> = {
          status: 'active',
          sort: 'student_id',
          order: 'asc',
          limit: 500,
        };

        if (profile?.school_id) {
          params.school_id = profile.school_id;
        }

        const [studentRows, classRows] = await Promise.all([
          phpApi.table<Student>('students').list(params),
          phpApi.table<ClassRecord>('classes').list({
            ...(profile?.school_id ? { school_id: profile.school_id } : {}),
            limit: 500,
          }),
        ]);

        const filteredStudents = toStudentWithClassLevel(studentRows || [], classRows || []).filter((student) =>
          student.classes?.class_level === exam.class_level
        );

        setStudents(filteredStudents);
        return;
      }

      let query = supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            class_level
          )
        `)
        .eq('status', 'active');

      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('student_id');

      if (error) throw error;
      
      const filteredStudents = ((data || []) as unknown as StudentWithClass[]).filter((student) => 
        student.classes?.class_level === exam.class_level
      );
      
      setStudents(filteredStudents);
    } catch (error) {
      const notice = handleSupabaseError('Load students for marks entry', error, {
        context: { schoolId: profile?.school_id, examId: selectedExam },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  }, [exams, profile?.school_id, selectedExam, toast]);

  const loadExistingResults = useCallback(async () => {
    if (!selectedExam || !selectedSubject) {
      setExistingResults({});
      setMarks({});
      return;
    }

    try {
      if (isPhpBackend) {
        const data = await phpApi.table<ExamResult>('exam_results').list({
          exam_id: selectedExam,
          subject_id: selectedSubject,
          limit: 500,
        });

        const resultsMap: Record<string, ExamResult> = {};
        const marksMap: Record<string, number> = {};

        (data || []).forEach(result => {
          resultsMap[result.student_id] = result;
          marksMap[result.student_id] = result.obtained_marks;
        });

        setExistingResults(resultsMap);
        setMarks(marksMap);
        return;
      }

      const { data, error } = await supabase
        .from('exam_results')
        .select('*')
        .eq('exam_id', selectedExam)
        .eq('subject_id', selectedSubject);

      if (error) throw error;

      const resultsMap: Record<string, ExamResult> = {};
      const marksMap: Record<string, number> = {};
      
      (data || []).forEach(result => {
        resultsMap[result.student_id] = result;
        marksMap[result.student_id] = result.obtained_marks;
      });

      setExistingResults(resultsMap);
      setMarks(marksMap);
    } catch (error) {
      handleSupabaseError('Load existing exam results', error, {
        context: { examId: selectedExam, subjectId: selectedSubject },
      });
    }
  }, [selectedExam, selectedSubject]);

  useEffect(() => {
    loadExams();
    loadSubjects();
  }, [loadExams, loadSubjects]);

  useEffect(() => {
    if (selectedExam) {
      loadStudents();
      loadExistingResults();
    }
  }, [selectedExam, selectedSubject, loadStudents, loadExistingResults]);

  const calculateGrade = (obtainedMarks: number, totalMarks: number): string => {
    const percentage = (obtainedMarks / totalMarks) * 100;
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'A-';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };

  const handleMarkChange = (studentId: string, value: string) => {
    const numValue = parseFloat(value);
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;
    if (!profile?.school_id) {
      toast({
        title: "Error",
        description: "School ID not found. Please contact your administrator.",
        variant: "destructive",
      });
      return;
    }

    if (!isNaN(numValue) && numValue >= 0 && numValue <= exam.total_marks) {
      setMarks(prev => ({ ...prev, [studentId]: numValue }));
      setSavedStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    } else if (value === '') {
      setMarks(prev => {
        const newMarks = { ...prev };
        delete newMarks[studentId];
        return newMarks;
      });
    }
  };

  const setQuickGrade = (studentId: string, grade: string) => {
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;

    let marks = 0;
    switch (grade) {
      case 'A+': marks = Math.floor(exam.total_marks * 0.9); break; // 90%
      case 'A': marks = Math.floor(exam.total_marks * 0.75); break;  // 75%
      case 'B': marks = Math.floor(exam.total_marks * 0.55); break;  // 55%
      case 'C': marks = Math.floor(exam.total_marks * 0.45); break;  // 45%
      case 'D': marks = Math.floor(exam.total_marks * 0.36); break;  // 36%
      case 'F': marks = Math.floor(exam.total_marks * 0.25); break;  // 25%
    }
    
    setMarks(prev => ({ ...prev, [studentId]: marks }));
    setSavedStudents(prev => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });
  };

  const saveStudentMarks = async (studentId: string) => {
    if (!selectedExam || !selectedSubject) return;

    const obtainedMarks = marks[studentId];
    if (obtainedMarks === undefined || obtainedMarks === null) {
      toast({
        title: "Error",
        description: "Please enter marks for the student",
        variant: "destructive",
      });
      return;
    }

    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;

    if (obtainedMarks > exam.total_marks) {
      toast({
        title: "Error",
        description: `Marks cannot exceed ${exam.total_marks}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const grade = calculateGrade(obtainedMarks, exam.total_marks);
      const existingResult = existingResults[studentId];

      if (isPhpBackend) {
        if (!profile?.school_id) {
          throw new Error('School ID not found. Please contact your administrator.');
        }

        if (existingResult?.id) {
          await phpApi.table<ExamResult>('exam_results').update(existingResult.id, {
            obtained_marks: obtainedMarks,
            grade,
          });
        } else {
          await phpApi.table<ExamResult>('exam_results').create({
            school_id: profile.school_id,
            exam_id: selectedExam,
            student_id: studentId,
            subject_id: selectedSubject,
            obtained_marks: obtainedMarks,
            total_marks: exam.total_marks,
            grade,
          });
        }

        setSavedStudents(prev => new Set(prev).add(studentId));
        toast({
          title: "Success",
          description: "Marks saved successfully",
        });
        await loadExistingResults();
        return;
      }

      if (existingResult?.id) {
        const { error } = await supabase
          .from('exam_results')
          .update({
            obtained_marks: obtainedMarks,
            grade: grade,
          })
          .eq('id', existingResult.id);

        if (error) throw error;
      } else {
        const newResult: ExamResultInsert = {
          school_id: profile.school_id,
          exam_id: selectedExam,
          student_id: studentId,
          subject_id: selectedSubject,
          obtained_marks: obtainedMarks,
          total_marks: exam.total_marks,
          grade: grade,
        };

        const { error } = await supabase
          .from('exam_results')
          .insert(newResult);

        if (error) throw error;
      }

      setSavedStudents(prev => new Set(prev).add(studentId));
      toast({
        title: "Success",
        description: "Marks saved successfully",
      });
      
      await loadExistingResults();
    } catch (error) {
      const notice = handleSupabaseError('Save student marks', error, {
        context: {
          schoolId: profile?.school_id,
          examId: selectedExam,
          subjectId: selectedSubject,
          studentId,
        },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAllMarks = async () => {
    if (!selectedExam || !selectedSubject) return;

    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;
    if (!profile?.school_id) {
      toast({
        title: "Error",
        description: "School ID not found. Please contact your administrator.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
      const obtainedMarks = marks[student.id];
      if (obtainedMarks === undefined || obtainedMarks === null) continue;
      if (obtainedMarks > exam.total_marks) continue;

      try {
        const grade = calculateGrade(obtainedMarks, exam.total_marks);
        const existingResult = existingResults[student.id];

        if (isPhpBackend) {
          if (existingResult?.id) {
            await phpApi.table<ExamResult>('exam_results').update(existingResult.id, {
              obtained_marks: obtainedMarks,
              grade,
            });
          } else {
            await phpApi.table<ExamResult>('exam_results').create({
              school_id: profile.school_id,
              exam_id: selectedExam,
              student_id: student.id,
              subject_id: selectedSubject,
              obtained_marks: obtainedMarks,
              total_marks: exam.total_marks,
              grade,
            });
          }

          setSavedStudents(prev => new Set(prev).add(student.id));
          successCount++;
          continue;
        }

        if (existingResult?.id) {
          const { error } = await supabase
            .from('exam_results')
            .update({
              obtained_marks: obtainedMarks,
              grade: grade,
            })
            .eq('id', existingResult.id);

          if (error) throw error;
        } else {
          const newResult: ExamResultInsert = {
            school_id: profile.school_id,
            exam_id: selectedExam,
            student_id: student.id,
            subject_id: selectedSubject,
            obtained_marks: obtainedMarks,
            total_marks: exam.total_marks,
            grade: grade,
          };

          const { error } = await supabase
            .from('exam_results')
            .insert(newResult);

          if (error) throw error;
        }

        setSavedStudents(prev => new Set(prev).add(student.id));
        successCount++;
      } catch (error) {
        handleSupabaseError('Save student marks in bulk', error, {
          context: {
            schoolId: profile?.school_id,
            examId: selectedExam,
            subjectId: selectedSubject,
            studentId: student.id,
          },
        });
        errorCount++;
      }
    }

    setSaving(false);

    if (successCount > 0) {
      toast({
        title: "Success",
        description: `Saved marks for ${successCount} student(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });
      await loadExistingResults();
    } else if (errorCount > 0) {
      toast({
        title: "Error",
        description: "Failed to save marks",
        variant: "destructive",
      });
    }
  };

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A+': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'A': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'A-': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'B': return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400';
      case 'C': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'D': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'F': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const selectedExamData = exams.find(e => e.id === selectedExam);
  const gradedCount = Object.keys(marks).length;
  const totalCount = students.length;
  const progress = totalCount > 0 ? (gradedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Select Exam</label>
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Choose an exam" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {exams.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.name} - {exam.class_level.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Select Subject</label>
          <Select 
            value={selectedSubject} 
            onValueChange={setSelectedSubject}
            disabled={!selectedExam}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {subjects
                .filter(s => !selectedExamData || s.class_level === selectedExamData.class_level)
                .map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedExam && selectedSubject && selectedExamData && (
        <>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Exam Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total Marks</p>
                  <p className="font-semibold text-lg">{selectedExamData.total_marks}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pass Marks</p>
                  <p className="font-semibold text-lg">{selectedExamData.pass_marks}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Students</p>
                  <p className="font-semibold text-lg">{students.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p className="font-semibold text-sm">{new Date(selectedExamData.exam_date).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Card */}
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{gradedCount} / {totalCount} students</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {Math.round(progress)}% complete
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-lg font-semibold">Enter Student Marks</h3>
            <Button 
              onClick={saveAllMarks} 
              disabled={saving || Object.keys(marks).length === 0}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
              <Save className="h-4 w-4" />
              Save All Marks ({Object.keys(marks).length})
            </Button>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {students.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-center text-muted-foreground">
                    No students found for this exam
                  </p>
                </CardContent>
              </Card>
            ) : (
              students.map((student) => {
                const currentMarks = marks[student.id];
                const grade = currentMarks !== undefined && currentMarks !== null
                  ? calculateGrade(currentMarks, selectedExamData.total_marks)
                  : existingResults[student.id]?.grade;
                const isSaved = savedStudents.has(student.id);
                const percentage = currentMarks !== undefined && currentMarks !== null
                  ? ((currentMarks / selectedExamData.total_marks) * 100).toFixed(0)
                  : null;

                return (
                  <Card key={student.id} className={`${isSaved ? 'border-green-600/30 bg-green-600/5' : ''}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-base">{student.full_name}</h4>
                          <p className="text-xs text-muted-foreground font-mono">ID: {student.student_id}</p>
                        </div>
                        {isSaved && (
                          <Badge variant="outline" className="bg-green-600/10 text-green-600 border-green-600/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Saved
                          </Badge>
                        )}
                      </div>

                      {/* Quick Grade Presets */}
                      <div className="flex flex-wrap gap-2">
                        {['A+', 'A', 'B', 'C', 'D', 'F'].map((g) => (
                          <Button
                            key={g}
                            size="sm"
                            variant={grade === g ? 'default' : 'outline'}
                            className="flex-1 min-w-[60px] h-8 text-xs"
                            onClick={() => setQuickGrade(student.id, g)}
                          >
                            {g}
                          </Button>
                        ))}
                      </div>

                      {/* Marks Input */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            min="0"
                            max={selectedExamData.total_marks}
                            value={currentMarks ?? ''}
                            onChange={(e) => handleMarkChange(student.id, e.target.value)}
                            placeholder="Enter marks"
                            className="h-11 text-lg font-semibold text-center"
                          />
                          <p className="text-xs text-muted-foreground text-center mt-1">
                            Out of {selectedExamData.total_marks}
                          </p>
                        </div>
                        {currentMarks !== undefined && currentMarks !== null && (
                          <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg px-3 min-w-[80px]">
                            <Badge variant="outline" className={`${getGradeColor(grade)} text-lg px-3 py-1`}>
                              {grade}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{percentage}%</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="lg"
                          onClick={() => saveStudentMarks(student.id)}
                          disabled={saving || currentMarks === undefined || currentMarks === null}
                          variant={isSaved ? "outline" : "default"}
                          className="flex-1 gap-2"
                        >
                          {isSaved ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Saved
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Save
                            </>
                          )}
                        </Button>
                        {currentMarks !== undefined && (
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => handleMarkChange(student.id, '')}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Clear
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-[150px]">Marks Obtained</TableHead>
                    <TableHead className="w-[100px]">Grade</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No students found for this exam
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => {
                      const currentMarks = marks[student.id];
                      const grade = currentMarks !== undefined && currentMarks !== null
                        ? calculateGrade(currentMarks, selectedExamData.total_marks)
                        : existingResults[student.id]?.grade;
                      const isSaved = savedStudents.has(student.id);

                      return (
                        <TableRow key={student.id} className={isSaved ? 'bg-green-600/5' : ''}>
                          <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={selectedExamData.total_marks}
                              value={currentMarks ?? ''}
                              onChange={(e) => handleMarkChange(student.id, e.target.value)}
                              placeholder="Enter marks"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            {grade && (
                              <Badge variant="outline" className={getGradeColor(grade)}>
                                {grade}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => saveStudentMarks(student.id)}
                              disabled={saving || currentMarks === undefined || currentMarks === null}
                              variant={isSaved ? "outline" : "default"}
                              className="gap-1"
                            >
                              {isSaved && <CheckCircle className="h-3 w-3" />}
                              {isSaved ? 'Saved' : 'Save'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {!selectedExam && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-xl mb-2">Select Exam and Subject</CardTitle>
            <CardDescription className="text-center">
              Choose an exam and subject to start entering marks for students
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { ExamMarksEntry };

