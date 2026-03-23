import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Plus, Calendar as CalendarIcon, GraduationCap, BarChart3, Award, Edit, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";

interface Exam {
  id: string;
  name: string;
  name_bangla?: string;
  class_level: string;
  exam_date: string;
  total_marks: number;
  pass_marks: number;
  is_active: boolean;
  created_at: string;
}

interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  obtained_marks: number;
  total_marks: number;
  grade?: string;
  students?: {
    student_id: string;
    full_name: string;
  };
  subjects?: {
    name: string;
    code: string;
  };
}

interface Subject {
  id: string;
  name: string;
  code: string;
  class_level: string;
}

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  class_id: string;
}

const examSchema = z.object({
  name: z.string().min(1, "Exam name is required"),
  name_bangla: z.string().optional(),
  class_level: z.string().min(1, "Class level is required"),
  exam_date: z.date({
    required_error: "Exam date is required",
  }),
  total_marks: z.number().min(1, "Total marks must be greater than 0"),
  pass_marks: z.number().min(1, "Pass marks must be greater than 0"),
});

type ExamFormData = z.infer<typeof examSchema>;

const gradeSchema = z.object({
  obtained_marks: z.number().min(0, "Marks cannot be negative"),
});

export function ExamManagement() {
  const { profile } = useAuth();
  const auditLog = useAuditLog('EXAM');
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("exams");
  const [validationError, setValidationError] = useState<string | null>(null);

  const examForm = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: "",
      name_bangla: "",
      total_marks: 100,
      pass_marks: 40,
    },
  });

  useEffect(() => {
    loadExams();
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      loadStudents();
      loadExamResults();
    }
  }, [selectedExam, selectedSubject]);

  const loadExams = async () => {
    try {
      let query = supabase
        .from('exams')
        .select('*');

      // Filter by school_id
      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('exam_date', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
      toast.error('Failed to load exams');
    }
  };

  const loadSubjects = async () => {
    try {
      let query = supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true);

      // Filter by school_id
      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast.error('Failed to load subjects');
    }
  };

  const loadStudents = async () => {
    if (!selectedExam) return;

    try {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;

      let query = supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            class_level
          )
        `)
        .eq('status', 'active');

      // Filter by school_id
      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('student_id');

      if (error) throw error;
      
      // Filter students by exam's class level
      const filteredStudents = data?.filter(student => 
        student.classes?.class_level === exam.class_level
      ) || [];
      
      setStudents(filteredStudents);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    }
  };

  const loadExamResults = async () => {
    if (!selectedExam || !selectedSubject) return;

    try {
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          *,
          students:student_id (
            student_id,
            full_name
          ),
          subjects:subject_id (
            name,
            code
          )
        `)
        .eq('exam_id', selectedExam)
        .eq('subject_id', selectedSubject)
        .order('student_id');

      if (error) throw error;
      setExamResults(data || []);
    } catch (error) {
      console.error('Error loading exam results:', error);
      toast.error('Failed to load exam results');
    }
  };

  const createExam = async (data: ExamFormData) => {
    setLoading(true);
    setValidationError(null);
    try {
      // Validate that pass_marks <= total_marks
      if (data.pass_marks > data.total_marks) {
        const errorMsg = "Pass marks cannot be greater than total marks";
        setValidationError(errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      // Validate exam date is in future
      if (data.exam_date < new Date()) {
        const errorMsg = "Exam date cannot be in the past";
        setValidationError(errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('exams')
        .insert({
          school_id: profile?.school_id,
          name: data.name,
          name_bangla: data.name_bangla || null,
          class_level: data.class_level as any,
          exam_date: format(data.exam_date, 'yyyy-MM-dd'),
          total_marks: data.total_marks,
          pass_marks: data.pass_marks,
          is_active: true,
        });

      if (error) throw error;

      await auditLog.logAction('CREATE', 'new', {
        entityName: data.name,
        class_level: data.class_level,
        exam_date: format(data.exam_date, 'yyyy-MM-dd'),
        total_marks: data.total_marks,
        pass_marks: data.pass_marks,
      });

      toast.success('Exam created successfully');
      setDialogOpen(false);
      examForm.reset();
      loadExams();
    } catch (error: any) {
      console.error('Error creating exam:', error);
      await auditLog.logFailedAction('new', {
        entityName: data.name,
        action: 'CREATE',
        error: error.message || 'Unknown error',
      });
      toast.error(error.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  const updateExamResult = async (studentId: string, obtainedMarks: number) => {
    if (!selectedExam || !selectedSubject) return;

    try {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;

      // Validate obtainedMarks <= total_marks
      if (obtainedMarks > exam.total_marks) {
        const errorMsg = `Obtained marks cannot exceed total marks (${exam.total_marks})`;
        toast.error(errorMsg);
        return;
      }

      if (obtainedMarks < 0) {
        const errorMsg = "Obtained marks cannot be negative";
        toast.error(errorMsg);
        return;
      }

      // Calculate grade
      const percentage = (obtainedMarks / exam.total_marks) * 100;
      let grade = 'F';
      if (percentage >= 80) grade = 'A+';
      else if (percentage >= 70) grade = 'A';
      else if (percentage >= 60) grade = 'A-';
      else if (percentage >= 50) grade = 'B';
      else if (percentage >= 40) grade = 'C';
      else if (percentage >= 33) grade = 'D';

      // Check if result already exists
      const existingResult = examResults.find(r => r.student_id === studentId);
      const student = students.find(s => s.id === studentId);

      if (existingResult) {
        // Update existing result
        const { error } = await supabase
          .from('exam_results')
          .update({
            obtained_marks: obtainedMarks,
            grade: grade,
          })
          .eq('id', existingResult.id);

        if (error) throw error;

        await auditLog.logAction('UPDATE_RESULT', existingResult.id, {
          studentId: student?.student_id,
          studentName: student?.full_name,
          examName: exam.name,
          marksObtained: obtainedMarks,
          totalMarks: exam.total_marks,
          grade: grade,
          actionType: 'Result Updated',
        });
      } else {
        // Create new result
        const { data, error } = await supabase
          .from('exam_results')
          .insert({
            school_id: profile?.school_id,
            exam_id: selectedExam,
            student_id: studentId,
            subject_id: selectedSubject,
            obtained_marks: obtainedMarks,
            total_marks: exam.total_marks,
            grade: grade,
          } as any)
          .select();

        if (error) throw error;

        const newResultId = data?.[0]?.id || 'new';
        await auditLog.logAction('UPDATE_RESULT', newResultId, {
          studentId: student?.student_id,
          studentName: student?.full_name,
          examName: exam.name,
          marksObtained: obtainedMarks,
          totalMarks: exam.total_marks,
          grade: grade,
          actionType: 'Result Created',
        });
      }

      toast.success('Result updated successfully');
      loadExamResults();
    } catch (error: any) {
      console.error('Error updating exam result:', error);
      const student = students.find(s => s.id === studentId);
      const exam = exams.find(e => e.id === selectedExam);
      
      if (student && exam) {
        await auditLog.logFailedAction(selectedExam, {
          studentId: student.student_id,
          studentName: student.full_name,
          examName: exam.name,
          marksObtained: obtainedMarks,
          action: 'UPDATE_RESULT',
          error: error.message || 'Unknown error',
        });
      }
      
      toast.error(error.message || 'Failed to update result');
    }
  };

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A+': return 'bg-green-100 text-green-800 border-green-200';
      case 'A': return 'bg-green-100 text-green-700 border-green-200';
      case 'A-': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'B': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'F': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const classLevels = [
    'nursery', 'kg', 'class_1', 'class_2', 'class_3', 'class_4', 'class_5',
    'class_6', 'class_7', 'class_8', 'class_9', 'class_10', 'class_11', 'class_12',
    'alim', 'fazil', 'kamil'
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Exam Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Create exams, enter grades, and generate reports
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="exams" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm">
            <FileText className="h-3 w-3 md:h-4 md:w-4" />
            <span>Exams</span>
          </TabsTrigger>
          <TabsTrigger value="grading" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm">
            <GraduationCap className="h-3 w-3 md:h-4 md:w-4" />
            <span>Grading</span>
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm">
            <Award className="h-3 w-3 md:h-4 md:w-4" />
            <span>Results</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm">
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="p-3 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <FileText className="h-5 w-5" />
                    Exam Management
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Create and manage exams for different classes
                  </CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) {
                    setValidationError(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto touch-target">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Exam
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Exam</DialogTitle>
                      <DialogDescription>
                        Set up a new exam for your students
                      </DialogDescription>
                    </DialogHeader>
                    {validationError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{validationError}</AlertDescription>
                      </Alert>
                    )}
                    <Form {...examForm}>
                      <form onSubmit={examForm.handleSubmit(createExam)} className="space-y-3 md:space-y-4">
                        <FormField
                          control={examForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Exam Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Mid-term Exam" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={examForm.control}
                          name="name_bangla"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Exam Name (Bangla)</FormLabel>
                              <FormControl>
                                <Input placeholder="Optional" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={examForm.control}
                          name="class_level"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Class Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select class level" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {classLevels.map((level) => (
                                    <SelectItem key={level} value={level}>
                                      {level.replace('_', ' ').replace('class', 'Class')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={examForm.control}
                          name="exam_date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Exam Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick exam date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                          <FormField
                            control={examForm.control}
                            name="total_marks"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Total Marks</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={examForm.control}
                            name="pass_marks"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pass Marks</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Exam'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Pass Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.name}</TableCell>
                      <TableCell>
                        {exam.class_level.replace('_', ' ').replace('class', 'Class')}
                      </TableCell>
                      <TableCell>{format(new Date(exam.exam_date), 'PPP')}</TableCell>
                      <TableCell>{exam.total_marks}</TableCell>
                      <TableCell>{exam.pass_marks}</TableCell>
                      <TableCell>
                        <Badge variant={exam.is_active ? "default" : "secondary"}>
                          {exam.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Grade Entry
              </CardTitle>
              <CardDescription>
                Enter exam results for students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Exam</label>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.name} - {exam.class_level.replace('_', ' ').replace('class', 'Class')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Subject</label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedExam && selectedSubject && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Obtained Marks</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => {
                        const result = examResults.find(r => r.student_id === student.id);
                        const exam = exams.find(e => e.id === selectedExam);
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.student_id}</TableCell>
                            <TableCell>{student.full_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={exam?.total_marks || 100}
                                defaultValue={result?.obtained_marks || ''}
                                onBlur={(e) => {
                                  const marks = Number(e.target.value);
                                  if (marks >= 0 && marks <= (exam?.total_marks || 100)) {
                                    updateExamResult(student.id, marks);
                                  }
                                }}
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground ml-2">
                                / {exam?.total_marks || 100}
                              </span>
                            </TableCell>
                            <TableCell>
                              {result?.grade && (
                                <Badge className={getGradeColor(result.grade)}>
                                  {result.grade}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  const input = document.querySelector(`input[defaultValue="${result?.obtained_marks || ''}"]`) as HTMLInputElement;
                                  if (input) {
                                    const marks = Number(input.value);
                                    updateExamResult(student.id, marks);
                                  }
                                }}
                              >
                                Save
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Exam Results
              </CardTitle>
              <CardDescription>
                View and manage exam results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Result management feature coming soon...</p>
                <p className="text-sm">Generate report cards and result summaries</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Exam Analytics
              </CardTitle>
              <CardDescription>
                Analyze exam performance and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Exam analytics feature coming soon...</p>
                <p className="text-sm">Performance trends, grade distribution, and insights</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
