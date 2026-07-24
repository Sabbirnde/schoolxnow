import { useState, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useThrottledFetch } from "@/hooks/useThrottledFetch";
import { usePollingRefresh } from "@/hooks/usePollingRefresh";
import { useAuditLog } from "@/hooks/useAuditLog";
import { AdvancedFilter, FilterField, FilterValue } from "@/components/AdvancedFilter";
import { useAdvancedFilter } from "@/hooks/useAdvancedFilter";
import { DataGridSkeleton } from "@/components/ui/skeleton-loader";
import {
  checkStudentIDDuplicate,
  validateRequiredFields,
  validateEmail,
  validatePhone,
  ValidationError,
} from "@/lib/audit-log";
import { AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/database/types";
import { handleApiError } from "@/lib/api-error-handler";
import { 
  Plus, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  User,
  Mail,
  Phone,
  Loader2
} from "lucide-react";

interface Student {
  id: string;
  school_id?: string;
  full_name: string;
  student_id: string;
  gender: string;
  date_of_birth: string;
  guardian_phone: string;
  guardian_email: string | null;
  address: string;
  status: 'active' | 'inactive' | 'transferred' | 'graduated';
  admission_date: string;
  class_id: string | null;
  father_name?: string;
  mother_name?: string;
  blood_group?: string | null;
  classes?: {
    name: string;
    section: string;
  };
}

interface Class {
  id: string;
  name: string;
  section: string;
  class_level: string;
}

type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];
type StudentUpdate = Database["public"]["Tables"]["students"]["Update"];

const attachClassesToStudents = (studentRows: Student[], classRows: Class[]): Student[] => {
  const classById = new Map(classRows.map((classItem) => [classItem.id, classItem]));

  return studentRows.map((student) => {
    const classItem = student.class_id ? classById.get(student.class_id) : null;
    return {
      ...student,
      classes: classItem ? { name: classItem.name, section: classItem.section } : undefined,
    };
  });
};

export function StudentManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const auditLog = useAuditLog({ entityType: 'student' });
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<FilterValue[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  const filterFields: FilterField[] = [
    { key: 'full_name', label: 'Student Name', type: 'text', placeholder: 'Enter name...' },
    { key: 'student_id', label: 'Student ID', type: 'text', placeholder: 'Enter ID...' },
    { key: 'gender', label: 'Gender', type: 'select', options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' }
    ]},
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'transferred', label: 'Transferred' },
      { value: 'graduated', label: 'Graduated' }
    ]},
    { key: 'class_name', label: 'Class', type: 'text', placeholder: 'Enter class...' },
    { key: 'guardian_phone', label: 'Guardian Phone', type: 'text', placeholder: 'Enter phone...' },
    { key: 'admission_date', label: 'Admission Date', type: 'date' },
  ];

  const studentSchema = z.object({
    full_name: z.string().min(1, "Full name is required"),
    student_id: z.string().min(1, "Student ID is required"),
    gender: z.string().min(1, "Gender is required"),
    date_of_birth: z.string().min(1, "Date of birth is required"),
    guardian_phone: z.string().min(1, "Guardian phone is required"),
    guardian_email: z.string().email().optional().nullable(),
    address: z.string().min(1, "Address is required"),
    class_id: z.string().optional(),
    father_name: z.string().min(1, "Father's name is required"),
    mother_name: z.string().min(1, "Mother's name is required"),
    blood_group: z.string().optional()
  });

  type StudentFormData = z.infer<typeof studentSchema>;

  const form = useForm<StudentFormData>({
    defaultValues: {
      full_name: "",
      student_id: "",
      gender: "",
      date_of_birth: "",
      guardian_phone: "",
      guardian_email: "",
      address: "",
      class_id: "",
      father_name: "",
      mother_name: "",
      blood_group: ""
    }
  });

  // Restore fetchData function before useEffect
  const fetchData = useCallback(async () => {
    if (!profile?.school_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (isPhpBackend) {
        const [studentsData, classesData] = await Promise.all([
          phpApi.table<Student>('students').list({
            select: 'id,school_id,full_name,student_id,gender,date_of_birth,guardian_phone,guardian_email,address,status,admission_date,class_id,father_name,mother_name,blood_group',
            school_id: profile.school_id,
            sort: 'admission_date',
            order: 'desc',
            limit: 200,
          }),
          phpApi.table<Class>('classes').list({
            select: 'id,name,section,class_level',
            school_id: profile.school_id,
            is_active: 1,
            sort: 'name',
            order: 'asc',
            limit: 200,
          }),
        ]);

        setClasses(classesData || []);
        setStudents(attachClassesToStudents(studentsData || [], classesData || []));
        return;
      }

      // Fetch students
      const { data: studentsData, error: studentsError } = await apiClient
        .from('students')
        .select(`
          *,
          classes (
            name,
            section
          )
        `)
        .eq('school_id', profile.school_id)
        .order('admission_date', { ascending: false });

      if (studentsError) throw studentsError;

      // Fetch classes
      const { data: classesData, error: classesError } = await apiClient
        .from('classes')
        .select('*')
        .eq('school_id', profile.school_id)
        .eq('is_active', true)
        .order('name');

      if (classesError) throw classesError;

      setStudents((studentsData || []) as unknown as Student[]);
      setClasses((classesData || []) as Class[]);
    } catch (error: unknown) {
      const notice = handleApiError('Load students', error, {
        context: { schoolId: profile?.school_id },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, toast]);

  // Move useThrottledFetch to top level (outside useEffect)
  const [throttledFetch] = useThrottledFetch(
    () => fetchData(),
    1000
  );

  usePollingRefresh({
    enabled: isPhpBackend && Boolean(profile?.school_id),
    intervalMs: 10000,
    onRefresh: throttledFetch,
  });

  const checkDuplicateStudentId = useCallback(
    async (schoolId: string, studentId: string, excludeId?: string): Promise<ValidationError | null> => {
      if (!isPhpBackend) {
        return checkStudentIDDuplicate(schoolId, studentId, excludeId);
      }

      try {
        const matches = await phpApi.table<Student>('students').list({
          school_id: schoolId,
          student_id: studentId,
          limit: 5,
        });
        const duplicate = matches.find((student) => student.id !== excludeId);

        if (!duplicate) {
          return null;
        }

        return {
          field: 'student_id',
          message: 'A student with this ID already exists in this school.',
          code: 'DUPLICATE_STUDENT_ID',
        };
      } catch (error) {
        return {
          field: 'student_id',
          message: error instanceof Error ? error.message : 'Unable to validate student ID.',
          code: 'DUPLICATE_CHECK_FAILED',
        };
      }
    },
    []
  );

  useEffect(() => {
    if (profile?.school_id) {
      fetchData();
    }

    if (isPhpBackend) {
      return;
    }

    // Set up narrow real-time subscriptions for students (INSERT/UPDATE only)
    const studentsInsertChannel = apiClient
      .channel('students_inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'students'
        },
        (payload) => {
          console.log('[StudentManagement] Student inserted:', payload.new?.id);
          if (profile?.school_id) {
            throttledFetch();
          }
        }
      )
      .subscribe();

    const studentsUpdateChannel = apiClient
      .channel('students_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students'
        },
        (payload) => {
          console.log('[StudentManagement] Student updated:', payload.new?.id);
          if (profile?.school_id) {
            throttledFetch();
          }
        }
      )
      .subscribe();

    const classesInsertChannel = apiClient
      .channel('students_classes_inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'classes'
        },
        (payload) => {
          console.log('[StudentManagement] Class inserted:', payload.new?.id);
          if (profile?.school_id) {
            throttledFetch();
          }
        }
      )
      .subscribe();

    const classesUpdateChannel = apiClient
      .channel('students_classes_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'classes'
        },
        (payload) => {
          console.log('[StudentManagement] Class updated:', payload.new?.id);
          if (profile?.school_id) {
            throttledFetch();
          }
        }
      )
      .subscribe();

    return () => {
      apiClient.removeChannel(studentsInsertChannel);
      apiClient.removeChannel(studentsUpdateChannel);
      apiClient.removeChannel(classesInsertChannel);
      apiClient.removeChannel(classesUpdateChannel);
    };
  }, [profile?.school_id, fetchData, throttledFetch]);

  const handleAddStudent = async (values: StudentFormData) => {
    if (!profile?.school_id) {
      toast({
        title: "Error",
        description: "School ID not found. Please contact your administrator.",
        variant: "destructive",
      });
      return;
    }

    setValidationError(null);
    setIsFormSubmitting(true);

    try {
      // Validate form data against schema
      const validationResult = studentSchema.safeParse(values);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors;
        const firstError = errors[0];
        const fieldName = firstError.path[0] || 'Unknown field';
        
        setValidationError({
          field: String(fieldName),
          message: firstError.message || "Please check all required fields",
          code: 'SCHEMA_VALIDATION_ERROR'
        });
        
        toast({
          title: "Validation Error",
          description: `${fieldName}: ${firstError.message || "Invalid value"}`,
          variant: "destructive",
        });
        return;
      }

      // Additional field validations
      if (values.guardian_email) {
        const emailError = validateEmail(values.guardian_email);
        if (emailError) {
          setValidationError(emailError);
          toast({
            title: "Invalid Email",
            description: emailError.message,
            variant: "destructive",
          });
          return;
        }
      }

      if (values.guardian_phone) {
        const phoneError = validatePhone(values.guardian_phone);
        if (phoneError) {
          setValidationError(phoneError);
          toast({
            title: "Invalid Phone Number",
            description: phoneError.message,
            variant: "destructive",
          });
          return;
        }
      }

      // Check for duplicate student ID
      const duplicateError = await checkDuplicateStudentId(
        profile.school_id,
        values.student_id
      );
      if (duplicateError) {
        setValidationError(duplicateError);
        toast({
          title: "Duplicate Student ID",
          description: duplicateError.message,
          variant: "destructive",
        });
        return;
      }

      // Generate admission date as current date
      const admissionDate = new Date().toISOString().split('T')[0];

      // Filter out empty optional fields and add required fields
      const studentData: StudentInsert = {
        full_name: values.full_name,
        student_id: values.student_id,
        date_of_birth: values.date_of_birth,
        gender: (values.gender || '').toLowerCase(),
        father_name: values.father_name,
        mother_name: values.mother_name,
        guardian_phone: values.guardian_phone,
        address: values.address,
        school_id: profile.school_id,
        class_id: values.class_id || null,
        guardian_email: values.guardian_email || null,
        blood_group: values.blood_group || null,
        status: 'active' as const,
        admission_date: admissionDate
      };

      console.log('Attempting to add student with data:', studentData);

      if (isPhpBackend) {
        const data = await phpApi.table<Student>('students').create(studentData as Partial<Student>);

        console.log('Successfully added student:', data);

        toast({
          title: "Success",
          description: `Student "${values.full_name}" added successfully with ID ${values.student_id}`,
        });

        setIsAddDialogOpen(false);
        form.reset();
        setValidationError(null);
        fetchData();
        return;
      }

      const { data, error } = await apiClient
        .from('students')
        .insert(studentData)
        .select()
        .single();

      if (error) {
        const notice = handleApiError('Create student', error, {
          context: {
            schoolId: profile.school_id,
            studentId: values.student_id,
            fullName: values.full_name,
          },
        });
        
        // Log failed audit event
        await auditLog.logFailedAction('CREATE', values.student_id, notice.description);
        
        throw error;
      }

      console.log('Successfully added student:', data);

      // Log successful audit event
      await auditLog.logAction('CREATE', data.id, {
        entityName: values.full_name,
        metadata: { student_id: values.student_id },
      });

      toast({
        title: "Success",
        description: `Student "${values.full_name}" added successfully with ID ${values.student_id}`,
      });

      setIsAddDialogOpen(false);
      form.reset();
      setValidationError(null);
      fetchData();
    } catch (error: unknown) {
      const notice = handleApiError('Create student', error, {
        context: {
          schoolId: profile?.school_id,
          studentId: values.student_id,
          fullName: values.full_name,
        },
        log: false,
      });
      
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
      
      setValidationError({
        field: 'form',
        message: notice.description,
        code: 'FORM_SUBMISSION_ERROR'
      });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleEditStudent = async (values: StudentFormData) => {
    if (!editingStudent) {
      toast({
        title: "Error",
        description: "No student selected for editing",
        variant: "destructive",
      });
      return;
    }

    setValidationError(null);
    setIsFormSubmitting(true);

    try {
      // Additional field validations
      if (values.guardian_email) {
        const emailError = validateEmail(values.guardian_email);
        if (emailError) {
          setValidationError(emailError);
          toast({
            title: "Invalid Email",
            description: emailError.message,
            variant: "destructive",
          });
          return;
        }
      }

      if (values.guardian_phone) {
        const phoneError = validatePhone(values.guardian_phone);
        if (phoneError) {
          setValidationError(phoneError);
          toast({
            title: "Invalid Phone Number",
            description: phoneError.message,
            variant: "destructive",
          });
          return;
        }
      }

      // Check for duplicate student ID (excluding current student)
      if (values.student_id !== editingStudent.student_id) {
        if (!profile?.school_id) {
          toast({
            title: "School Missing",
            description: "Cannot validate student ID without a school assignment.",
            variant: "destructive",
          });
          return;
        }

        const duplicateError = await checkDuplicateStudentId(
          profile.school_id,
          values.student_id,
          editingStudent.id
        );
        if (duplicateError) {
          setValidationError(duplicateError);
          toast({
            title: "Duplicate Student ID",
            description: duplicateError.message,
            variant: "destructive",
          });
          return;
        }
      }

      const studentUpdate: StudentUpdate = {
        ...values,
        class_id: values.class_id || null,
        guardian_email: values.guardian_email || null,
        blood_group: values.blood_group || null,
      };

      if (isPhpBackend) {
        await phpApi.table<Student>('students').update(
          editingStudent.id,
          studentUpdate as Partial<Student>,
          editingStudent,
        );

        toast({
          title: "Success",
          description: `Student "${values.full_name}" updated successfully`,
        });

        setEditingStudent(null);
        form.reset();
        setValidationError(null);
        fetchData();
        return;
      }

      const { error } = await apiClient
        .from('students')
        .update(studentUpdate)
        .eq('id', editingStudent.id);

      if (error) {
        const notice = handleApiError('Update student', error, {
          context: {
            studentId: editingStudent.id,
            schoolId: profile?.school_id,
          },
        });
        await auditLog.logFailedAction('UPDATE', editingStudent.id, notice.description);
        
        throw error;
      }

      // Log successful audit event
      await auditLog.logAction('UPDATE', editingStudent.id, {
        entityName: values.full_name,
      });

      toast({
        title: "Success",
        description: `Student "${values.full_name}" updated successfully`,
      });

      setEditingStudent(null);
      form.reset();
      setValidationError(null);
      fetchData();
    } catch (error: unknown) {
      const notice = handleApiError('Update student', error, {
        context: {
          studentId: editingStudent.id,
          schoolId: profile?.school_id,
        },
        log: false,
      });
      
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
      
      setValidationError({
        field: 'form',
        message: notice.description,
        code: 'FORM_SUBMISSION_ERROR'
      });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      
      if (!student) {
        toast({
          title: "Error",
          description: "Student not found",
          variant: "destructive",
        });
        return;
      }

      if (isPhpBackend) {
        await phpApi.table<Student>('students').delete(studentId, student);

        toast({
          title: "Success",
          description: `Student "${student.full_name}" deleted successfully`,
        });

        fetchData();
        return;
      }

      const { error } = await apiClient
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) {
        const notice = handleApiError('Delete student', error, {
          context: { studentId, schoolId: profile?.school_id },
        });
        await auditLog.logFailedAction('DELETE', studentId, notice.description);
        throw error;
      }

      // Log successful audit event
      await auditLog.logAction('DELETE', studentId, {
        entityName: student?.full_name,
        reason: 'Deleted by user',
      });

      toast({
        title: "Success",
        description: `Student "${student.full_name}" deleted successfully`,
      });

      fetchData();
    } catch (error: unknown) {
      const notice = handleApiError('Delete student', error, {
        context: { studentId, schoolId: profile?.school_id },
        log: false,
      });
      
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  };

  // Add class_name for filtering
  const studentsWithClassName = useMemo(
    () =>
      students.map((s) => ({
        ...s,
        class_name: s.classes ? `${s.classes.name} ${s.classes.section}` : '',
      })),
    [students]
  );

  const filteredStudents = useAdvancedFilter(
    studentsWithClassName,
    advancedFilters,
    searchTerm,
    ['full_name', 'student_id', 'guardian_phone', 'guardian_email', 'class_name']
  );

  const handleExportStudents = () => {
    if (filteredStudents.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no students matching the current filters. Please adjust your filters or search criteria.",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      'Student Name',
      'Student ID',
      'Gender',
      'Date of Birth',
      'Status',
      'Class',
      'Section',
      'Guardian Phone',
      'Guardian Email',
      'Address',
      'Admission Date'
    ];

    const escapeCsvValue = (value: string | null | undefined) => {
      const safeValue = value ?? '';
      const escaped = safeValue.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvRows = filteredStudents.map((student) => [
      escapeCsvValue(student.full_name),
      escapeCsvValue(student.student_id),
      escapeCsvValue(student.gender),
      escapeCsvValue(student.date_of_birth),
      escapeCsvValue(student.status),
      escapeCsvValue(student.classes?.name || ''),
      escapeCsvValue(student.classes?.section || ''),
      escapeCsvValue(student.guardian_phone),
      escapeCsvValue(student.guardian_email),
      escapeCsvValue(student.address),
      escapeCsvValue(student.admission_date),
    ]);

    const csvContent = [csvHeaders.map(escapeCsvValue).join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().split('T')[0];

    link.href = url;
    link.download = `students-export-${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `${filteredStudents.length} student${filteredStudents.length !== 1 ? 's' : ''} exported successfully.`,
    });
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    form.reset({
      full_name: student.full_name,
      student_id: student.student_id,
      gender: student.gender,
      date_of_birth: student.date_of_birth,
      guardian_phone: student.guardian_phone,
      guardian_email: student.guardian_email || "",
      address: student.address,
      class_id: student.class_id || "",
      father_name: student.father_name || "",
      mother_name: student.mother_name || "",
      blood_group: student.blood_group || ""
    });
  };

  if (loading) {
    return <DataGridSkeleton />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Student Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage student records and information</p>
        </div>
        <Button 
          className="w-full sm:w-auto bg-gradient-primary hover:opacity-90 touch-target"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Student
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold text-foreground">{students.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 md:h-5 md:w-5 text-success" />
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold text-foreground">{students.filter(s => s.status === 'active').length}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 md:h-5 md:w-5 text-warning" />
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold text-foreground">
                  {students.filter(s => {
                    const admissionDate = new Date(s.admission_date);
                    const now = new Date();
                    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return admissionDate >= thirtyDaysAgo;
                  }).length}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">New</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 md:h-5 md:w-5 text-accent" />
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold text-foreground">{students.filter(s => s.status === 'graduated').length}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Graduated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-start sm:items-center">
            <div className="flex-1 w-full">
              <AdvancedFilter
                fields={filterFields}
                onFilterChange={setAdvancedFilters}
                onSearch={setSearchTerm}
                searchPlaceholder="Search students by name, ID, phone, or email..."
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto touch-target"
              onClick={handleExportStudents}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card className="shadow-sm">
        <CardHeader className="p-3 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg md:text-xl">Students List ({filteredStudents.length})</CardTitle>
            <Button 
              size="sm"
              className="w-full bg-gradient-primary hover:opacity-90 sm:w-auto"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Students
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px] px-3 md:px-6">
            <div className="space-y-3 md:space-y-4 py-3 md:py-4">
              {filteredStudents.map((student) => (
              <div key={student.id} className="border border-border rounded-lg p-3 md:p-4 hover:shadow-sm transition-shadow duration-200">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-accent rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm md:text-lg font-semibold text-accent-foreground">
                        {student.full_name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm md:text-base truncate">{student.full_name}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        ID: {student.student_id} • {student.classes?.name ? `${student.classes.name} - ${student.classes.section}` : 'No Class'}
                      </p>
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{student.guardian_email || 'No email'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          {student.guardian_phone}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <Badge variant={
                        student.status === 'active' ? 'default' :
                        student.status === 'graduated' ? 'secondary' : 'outline'
                      } className="text-xs">
                        {student.status}
                      </Badge>
                      <div className="break-words text-xs text-muted-foreground">
                        <span className="font-medium">{student.gender.charAt(0).toUpperCase() + student.gender.slice(1)}</span> • 
                        <span className="ml-1">DOB: {new Date(student.date_of_birth).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex shrink-0 justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 touch-target">
                        <Eye className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 touch-target"
                        onClick={() => openEditDialog(student)}
                      >
                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive touch-target"
                        onClick={() => handleDeleteStudent(student.id)}
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      {/* Add/Edit Student Dialog */}
      <Dialog open={isAddDialogOpen || !!editingStudent} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingStudent(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
          </DialogHeader>
          
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError.message}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingStudent ? handleEditStudent : handleAddStudent)} className="space-y-4">
              <ScrollArea className="h-[58vh] max-h-[500px] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter student ID" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classes.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name} - {classItem.section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="father_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Father's Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter father's name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mother_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mother's Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter mother's name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="guardian_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guardian Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guardian_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guardian Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Enter email address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter full address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="blood_group"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood Group</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
                </div>
              </ScrollArea>

              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingStudent(null);
                    form.reset();
                    setValidationError(null);
                  }}
                  disabled={isFormSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 sm:w-auto"
                  disabled={isFormSubmitting}
                >
                  {isFormSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingStudent ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {editingStudent ? 'Update' : 'Add'} Student
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
