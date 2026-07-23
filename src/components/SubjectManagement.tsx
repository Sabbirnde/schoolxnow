import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import { useForm } from "react-hook-form";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useToast } from "@/hooks/use-toast";
import { AdvancedFilter, FilterField, FilterValue } from "@/components/AdvancedFilter";
import { useAdvancedFilter } from "@/hooks/useAdvancedFilter";
import { 
  Plus, 
  Edit, 
  Trash2,
  Book,
  Loader2,
  AlertCircle
} from "lucide-react";
import { handleApiError } from "@/lib/api-error-handler";

interface Subject {
  id: string;
  school_id?: string;
  name: string;
  name_bangla: string | null;
  code: string;
  class_level: string;
  is_optional: boolean;
  is_active: boolean;
}

interface TeacherRecord {
  id: string;
  user_id: string | null;
  school_id: string;
}

interface TimetableRecord {
  id: string;
  school_id: string;
  teacher_id: string | null;
  subject_id: string;
}

interface SubjectFormData {
  name: string;
  name_bangla: string;
  code: string;
  class_level: string;
  is_optional: boolean;
}

const CLASS_LEVELS = [
  { value: 'nursery', label: 'Nursery' },
  { value: 'kg', label: 'KG' },
  { value: 'class_1', label: 'Class 1' },
  { value: 'class_2', label: 'Class 2' },
  { value: 'class_3', label: 'Class 3' },
  { value: 'class_4', label: 'Class 4' },
  { value: 'class_5', label: 'Class 5' },
  { value: 'class_6', label: 'Class 6' },
  { value: 'class_7', label: 'Class 7' },
  { value: 'class_8', label: 'Class 8' },
  { value: 'class_9', label: 'Class 9' },
  { value: 'class_10', label: 'Class 10' },
  { value: 'class_11', label: 'Class 11' },
  { value: 'class_12', label: 'Class 12' }
];

const normalizeSubject = (subject: Subject): Subject => ({
  ...subject,
  is_active: Boolean(subject.is_active),
  is_optional: Boolean(subject.is_optional),
});

export function SubjectManagement() {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const { toast } = useToast();
  const auditLog = useAuditLog('SUBJECT');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<FilterValue[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const filterFields: FilterField[] = [
    { key: 'name', label: 'Subject Name', type: 'text', placeholder: 'Enter name...' },
    { key: 'code', label: 'Subject Code', type: 'text', placeholder: 'Enter code...' },
    { key: 'class_level', label: 'Class Level', type: 'select', options: CLASS_LEVELS },
    { key: 'is_optional', label: 'Type', type: 'select', options: [
      { value: 'true', label: 'Optional' },
      { value: 'false', label: 'Compulsory' }
    ]},
    { key: 'is_active', label: 'Status', type: 'select', options: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' }
    ]},
  ];

  const form = useForm<SubjectFormData>({
    defaultValues: {
      name: "",
      name_bangla: "",
      code: "",
      class_level: "",
      is_optional: false
    }
  });

  const fetchSubjects = useCallback(async () => {
    const schoolId = canFull('subjects.manage') ? selectedSchoolId : profile?.school_id;
    
    if (!schoolId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (isPhpBackend) {
        if (!canFull('subjects.manage')) {
          const teacherRows = await phpApi.table<TeacherRecord>('teachers').list({
            school_id: schoolId,
            user_id: profile?.user_id,
            limit: 1,
          });
          const teacher = teacherRows[0];

          if (!teacher) {
            setSubjects([]);
            return;
          }

          const timetableRows = await phpApi.table<TimetableRecord>('timetable').list({
            school_id: schoolId,
            teacher_id: teacher.id,
            limit: 200,
          });
          const subjectIds = new Set(timetableRows.map((item) => item.subject_id).filter(Boolean));

          if (subjectIds.size === 0) {
            setSubjects([]);
            return;
          }

          const schoolSubjects = await phpApi.table<Subject>('subjects').list({
            school_id: schoolId,
            sort: 'name',
            order: 'asc',
            limit: 200,
          });
          setSubjects((schoolSubjects || []).filter((subject) => subjectIds.has(subject.id)).map(normalizeSubject));
          return;
        }

        const data = await phpApi.table<Subject>('subjects').list({
          school_id: schoolId,
          sort: 'name',
          order: 'asc',
          limit: 200,
        });
        setSubjects((data || []).map(normalizeSubject));
        return;
      }

      // For teachers, only fetch subjects they teach (based on timetable)
      if (!canFull('subjects.manage')) {
        // First get the teacher record
        const { data: teacherData, error: teacherError } = await apiClient
          .from('teachers')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();

        if (teacherError) {
          const notice = handleApiError('Load subject teacher assignment', teacherError, {
            context: { schoolId, userId: profile?.user_id },
          });
          toast({
            title: notice.title,
            description: notice.description,
            variant: "destructive",
          });
          setSubjects([]);
          return;
        }

        if (!teacherData) {
          setSubjects([]);
          return;
        }

        // Get unique subject IDs from timetable for this teacher
        const { data: timetableData, error: timetableError } = await apiClient
          .from('timetable')
          .select('subject_id')
          .eq('teacher_id', teacherData.id)
          .eq('school_id', schoolId);

        if (timetableError) {
          const notice = handleApiError('Load teacher subject timetable', timetableError, {
            context: { schoolId, teacherId: teacherData.id },
          });
          toast({
            title: notice.title,
            description: notice.description,
            variant: "destructive",
          });
          setSubjects([]);
          return;
        }

        // Get unique subject IDs
        const subjectIds = [...new Set(timetableData?.map(t => t.subject_id) || [])];

        if (subjectIds.length === 0) {
          setSubjects([]);
          return;
        }

        // Fetch subjects
        const { data, error } = await apiClient
          .from('subjects')
          .select('*')
          .in('id', subjectIds)
          .order('name');

        if (error) throw error;
        setSubjects(data || []);
      } else {
        // For admins, fetch all subjects in the school
        const { data, error } = await apiClient
          .from('subjects')
          .select('*')
          .eq('school_id', schoolId)
          .order('name');

        if (error) throw error;
        setSubjects(data || []);
      }
    } catch (error: unknown) {
      const notice = handleApiError('Load subjects', error, {
        context: { schoolId, userId: profile?.user_id },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [canFull, profile?.school_id, profile?.user_id, selectedSchoolId, toast]);

  useEffect(() => {
    if (canFull('subjects.manage')) {
      // Super admin needs to select a school first
      if (selectedSchoolId) {
        fetchSubjects();
      }
    } else if (profile?.school_id) {
      setSelectedSchoolId(profile.school_id);
      fetchSubjects();
    }
  }, [profile?.school_id, selectedSchoolId, canFull, fetchSubjects]);

  const handleAddSubject = async (values: SubjectFormData) => {
    const schoolId = canFull('subjects.manage') ? selectedSchoolId : profile?.school_id;
    
    if (!schoolId) {
      toast({
        title: "Error",
        description: "Please select a school first",
        variant: "destructive",
      });
      return;
    }

    try {
      setValidationError(null);

      if (isPhpBackend) {
        const duplicate = subjects.find(
          (subject) =>
            subject.id !== editingSubject?.id &&
            subject.code.toLowerCase() === values.code.toLowerCase() &&
            subject.class_level === values.class_level &&
            subject.is_active
        );

        if (duplicate) {
          const errorMsg = "A subject with this code already exists for this class level. Please use a different code or edit the existing subject instead.";
          setValidationError(errorMsg);
          toast({
            title: "Duplicate Subject Code",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }

        await phpApi.table<Subject>('subjects').create({
          ...values,
          school_id: schoolId,
          is_active: true,
        });

        toast({
          title: "Success",
          description: "Subject added successfully",
        });

        setIsAddDialogOpen(false);
        form.reset();
        fetchSubjects();
        return;
      }

      const { error } = await apiClient
        .from('subjects')
        .insert({
          ...values,
          school_id: schoolId
        });

      if (error) {
        if (error.code === '23505') {
          const errorMsg = "A subject with this code already exists for this class level. Please use a different code or edit the existing subject instead.";
          setValidationError(errorMsg);
          
          await auditLog.logFailedAction('new', {
            entityName: values.name,
            action: 'CREATE',
            error: 'Duplicate subject code',
          });

          toast({
            title: "Duplicate Subject Code",
            description: errorMsg,
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      await auditLog.logAction('CREATE', 'new', {
        entityName: values.name,
        code: values.code,
        class_level: values.class_level,
        is_optional: values.is_optional,
      });

      toast({
        title: "Success",
        description: "Subject added successfully",
      });

      setIsAddDialogOpen(false);
      form.reset();
      fetchSubjects();
    } catch (error: unknown) {
      const notice = handleApiError('Create subject', error, {
        context: {
          schoolId,
          subjectName: values.name,
          code: values.code,
          classLevel: values.class_level,
        },
      });
      
      await auditLog.logFailedAction('new', {
        entityName: values.name,
        action: 'CREATE',
        error: notice.description,
      });

      setValidationError(notice.description);
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  };

  const handleEditSubject = async (values: SubjectFormData) => {
    if (!editingSubject) return;

    try {
      setValidationError(null);

      if (isPhpBackend) {
        const duplicate = subjects.find(
          (subject) =>
            subject.id !== editingSubject.id &&
            subject.code.toLowerCase() === values.code.toLowerCase() &&
            subject.class_level === values.class_level &&
            subject.is_active
        );

        if (duplicate) {
          const errorMsg = "A subject with this code already exists for this class level. Please use a different code.";
          setValidationError(errorMsg);
          toast({
            title: "Duplicate Subject Code",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }

        await phpApi.table<Subject>('subjects').update(editingSubject.id, values);

        toast({
          title: "Success",
          description: "Subject updated successfully",
        });

        setEditingSubject(null);
        form.reset();
        fetchSubjects();
        return;
      }

      const { error } = await apiClient
        .from('subjects')
        .update(values)
        .eq('id', editingSubject.id);

      if (error) throw error;

      await auditLog.logAction('UPDATE', editingSubject.id, {
        entityName: values.name,
        changes: {
          name: values.name,
          code: values.code,
          class_level: values.class_level,
          is_optional: values.is_optional,
        },
      });

      toast({
        title: "Success",
        description: "Subject updated successfully",
      });

      setEditingSubject(null);
      form.reset();
      fetchSubjects();
    } catch (error: unknown) {
      const notice = handleApiError('Update subject', error, {
        context: {
          subjectId: editingSubject.id,
          subjectName: values.name,
          code: values.code,
          classLevel: values.class_level,
        },
      });
      
      await auditLog.logFailedAction(editingSubject.id, {
        entityName: editingSubject.name,
        action: 'UPDATE',
        error: notice.description,
      });

      setValidationError(notice.description);
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      setValidationError(null);

      const subjectToDelete = subjects.find(s => s.id === subjectId);
      if (!subjectToDelete) return;

      if (isPhpBackend) {
        await phpApi.table<Subject>('subjects').update(subjectId, { is_active: false });

        toast({
          title: "Success",
          description: "Subject deactivated successfully",
        });

        fetchSubjects();
        return;
      }

      const { error } = await apiClient
        .from('subjects')
        .update({ is_active: false })
        .eq('id', subjectId);

      if (error) throw error;

      await auditLog.logAction('DELETE', subjectId, {
        entityName: subjectToDelete.name,
        code: subjectToDelete.code,
        class_level: subjectToDelete.class_level,
        action: 'DEACTIVATE',
      });

      toast({
        title: "Success",
        description: "Subject deactivated successfully",
      });

      fetchSubjects();
    } catch (error: unknown) {
      const notice = handleApiError('Deactivate subject', error, {
        context: { subjectId },
      });
      
      const subjectToDelete = subjects.find(s => s.id === subjectId);
      if (subjectToDelete) {
        await auditLog.logFailedAction(subjectId, {
          entityName: subjectToDelete.name,
          action: 'DELETE',
          error: notice.description,
        });
      }

      setValidationError(notice.description);
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    }
  };

  const subjectsWithStringBooleans = subjects.map(s => ({
    ...s,
    is_active_string: String(s.is_active),
    is_optional_string: String(s.is_optional)
  }));

  const filteredSubjectsWithMeta = useAdvancedFilter(
    subjectsWithStringBooleans,
    advancedFilters.map(f => 
      f.field === 'is_active' ? { ...f, field: 'is_active_string' } :
      f.field === 'is_optional' ? { ...f, field: 'is_optional_string' } : f
    ),
    searchTerm,
    ['name', 'code', 'class_level']
  );

  const filteredSubjects = filteredSubjectsWithMeta.map(s => subjects.find(orig => orig.id === s.id)!).filter(Boolean);

  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    form.reset({
      name: subject.name,
      name_bangla: subject.name_bangla || "",
      code: subject.code,
      class_level: subject.class_level,
      is_optional: subject.is_optional
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {!canFull('subjects.manage') ? 'My Subjects' : 'Subject Management'}
          </h1>
          <p className="text-muted-foreground">
            {!canFull('subjects.manage') 
              ? 'View subjects you teach based on your timetable' 
              : 'Manage curriculum subjects by class'}
          </p>
        </div>
        {canFull('subjects.manage') && (
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={canFull('subjects.manage') && !selectedSchoolId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Subject
          </Button>
        )}
      </div>

      {/* School Selector for Super Admin */}
      {canFull('subjects.manage') && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select School</label>
              <SchoolCombobox 
                value={selectedSchoolId} 
                onValueChange={setSelectedSchoolId}
              />
              <p className="text-xs text-muted-foreground">Select a school to manage its subjects. You can add, edit, or view subjects for any school.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Book className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{subjects.filter(s => s.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <Book className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{subjects.filter(s => !s.is_optional).length}</p>
                <p className="text-sm text-muted-foreground">Core Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <Book className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{subjects.filter(s => s.is_optional).length}</p>
                <p className="text-sm text-muted-foreground">Optional Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Book className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {[...new Set(subjects.map(s => s.class_level))].length}
                </p>
                <p className="text-sm text-muted-foreground">Class Levels</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <AdvancedFilter
            fields={filterFields}
            onFilterChange={setAdvancedFilters}
            onSearch={setSearchTerm}
            searchPlaceholder="Search subjects by name, code, or class level..."
          />
        </CardContent>
      </Card>

      {/* Subjects List */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
          {!canFull('subjects.manage') ? 'My Subjects' : 'Subjects'} ({filteredSubjects.length})
        </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubjects.length === 0 && !canFull('subjects.manage') ? (
            <div className="text-center py-8">
              <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Subjects Assigned</h3>
              <p className="text-muted-foreground">
                You don't have any subjects assigned in the timetable yet. Please contact your school administrator.
              </p>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="text-center py-8">
              <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Subjects Found</h3>
              <p className="text-muted-foreground">
                {canFull('subjects.manage') && !selectedSchoolId
                  ? 'Please select a school to view subjects.'
                  : 'Get started by adding your first subject.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubjects.map((subject) => (
              <div key={subject.id} className="border border-border rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center">
                      <Book className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{subject.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Code: {subject.code} • 
                        Level: {CLASS_LEVELS.find(l => l.value === subject.class_level)?.label}
                      </p>
                      {subject.name_bangla && (
                        <p className="text-sm text-muted-foreground">
                          Bangla: {subject.name_bangla}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <Badge variant={subject.is_active ? 'default' : 'secondary'}>
                        {subject.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {subject.is_optional && (
                        <Badge variant="outline">Optional</Badge>
                      )}
                    </div>
                    
                    {profile?.role !== 'teacher' && (
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(subject)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSubject(subject.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingSubject} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingSubject(null);
          form.reset();
          setValidationError(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
          </DialogHeader>
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingSubject ? handleEditSubject : handleAddSubject)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Mathematics" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="name_bangla"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name (Bangla)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., গণিত" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., MATH001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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
                          {CLASS_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_optional"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Optional Subject
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingSubject(null);
                    form.reset();
                    setValidationError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingSubject ? 'Update' : 'Add'} Subject
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
