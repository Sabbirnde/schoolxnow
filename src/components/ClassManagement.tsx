import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useToast } from "@/hooks/use-toast";
import { useThrottledFetch } from "@/hooks/useThrottledFetch";
import { usePollingRefresh } from "@/hooks/usePollingRefresh";
import { AdvancedFilter, FilterField, FilterValue } from "@/components/AdvancedFilter";
import { useAdvancedFilter } from "@/hooks/useAdvancedFilter";
import { 
  Plus, 
  Edit, 
  Trash2,
  BookOpen,
  Users,
  Loader2,
  AlertCircle
} from "lucide-react";
import type { RealtimeChannel } from "@/integrations/php-api/api-types";
import { handleApiError } from "@/lib/api-error-handler";

interface Class {
  id: string;
  school_id?: string;
  name: string;
  name_bangla: string | null;
  section: string;
  class_level: string;
  capacity: number;
  is_active: boolean;
  student_count?: number;
}

interface ClassFormData {
  name: string;
  name_bangla: string;
  section: string;
  class_level: string;
  capacity: number;
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

const normalizeClass = (classItem: Class): Class => ({
  ...classItem,
  is_active: Boolean(classItem.is_active),
  capacity: Number(classItem.capacity || 0),
  student_count: Number(classItem.student_count || 0),
});

export function ClassManagement() {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const { toast } = useToast();
  const auditLog = useAuditLog('CLASS');
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<FilterValue[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const filterFields: FilterField[] = [
    { key: 'name', label: 'Class Name', type: 'text', placeholder: 'Enter class name...' },
    { key: 'section', label: 'Section', type: 'text', placeholder: 'Enter section...' },
    { key: 'class_level', label: 'Class Level', type: 'select', options: CLASS_LEVELS },
    { key: 'capacity', label: 'Capacity', type: 'number', placeholder: 'Enter capacity...' },
    { key: 'is_active', label: 'Status', type: 'select', options: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' }
    ]},
  ];

  const isAdmin = canFull('classes.manage');

  const form = useForm<ClassFormData>({
    defaultValues: {
      name: "",
      name_bangla: "",
      section: "A",
      class_level: "",
      capacity: 40
    }
  });

  const fetchClasses = useCallback(async () => {
    if (!profile?.school_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (isPhpBackend) {
        const [classRows, studentRows] = await Promise.all([
          phpApi.table<Class>('classes').list({
            school_id: profile.school_id,
            sort: 'name',
            order: 'asc',
            limit: 200,
          }),
          phpApi.table<{ class_id: string | null }>('students').list({
            school_id: profile.school_id,
            select: 'class_id',
            limit: 200,
          }),
        ]);

        const studentCounts = (studentRows || []).reduce<Record<string, number>>((acc, student) => {
          if (student.class_id) {
            acc[student.class_id] = (acc[student.class_id] || 0) + 1;
          }
          return acc;
        }, {});

        const classesWithCount = (classRows || []).map((classItem) =>
          normalizeClass({
            ...classItem,
            student_count: studentCounts[classItem.id] || 0,
          })
        );

        setClasses(classesWithCount);
        return;
      }

      // Fetch classes with student count
      const { data: classesData, error } = await apiClient
        .from('classes')
        .select(`
          *,
          students:students(count)
        `)
        .eq('school_id', profile.school_id)
        .order('name');

      if (error) throw error;

      const classesWithCount = classesData?.map(classItem => ({
        ...classItem,
        student_count: classItem.students?.[0]?.count || 0
      })) || [];

      setClasses(classesWithCount);
    } catch (error: unknown) {
      const notice = handleApiError('Load classes', error, {
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
    () => fetchClasses(),
    1000
  );

  usePollingRefresh({
    enabled: isPhpBackend && Boolean(profile?.school_id),
    intervalMs: 10000,
    onRefresh: throttledFetch,
  });

  useEffect(() => {
    if (profile?.school_id) {
      fetchClasses();
    }

    if (isPhpBackend) {
      return;
    }

    // Set up narrow real-time subscriptions for classes (INSERT/UPDATE only, no DELETE)
    let insertChannel: RealtimeChannel | null = null;
    let updateChannel: RealtimeChannel | null = null;

    try {
      insertChannel = apiClient
        .channel('classes_inserts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'classes'
          },
          (payload) => {
            console.log('[ClassManagement] Class inserted:', payload.new?.id);
            if (profile?.school_id) {
              throttledFetch();
            }
          }
        )
        .subscribe();

      updateChannel = apiClient
        .channel('classes_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'classes'
          },
          (payload) => {
            console.log('[ClassManagement] Class updated:', payload.new?.id);
            if (profile?.school_id) {
              throttledFetch();
            }
          }
        )
        .subscribe();
    } catch (error) {
      console.error('[ClassManagement] Error setting up subscriptions:', error);
    }

    return () => {
      if (insertChannel) apiClient.removeChannel(insertChannel);
      if (updateChannel) apiClient.removeChannel(updateChannel);
    };
  }, [profile?.school_id, fetchClasses, throttledFetch]);

  const handleAddClass = async (values: ClassFormData) => {
    if (!profile?.school_id) return;
    if (!isAdmin) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to add classes.",
        variant: "destructive",
      });
      return;
    }

    try {
      setValidationError(null);

      // Check for duplicate class name + section combination
      const existingClass = classes.find(
        c => c.name.toLowerCase() === values.name.toLowerCase() && 
             c.section === values.section &&
             c.class_level === values.class_level &&
             c.is_active
      );

      if (existingClass) {
        const errorMsg = `A class named "${values.name}" Section ${values.section} already exists in this class level.`;
        setValidationError(errorMsg);
        toast({
          title: "Duplicate Class",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      if (isPhpBackend) {
        const createdClass = await phpApi.table<Class>('classes').create({
          ...values,
          school_id: profile.school_id,
          is_active: true,
        });

        toast({
          title: "Success",
          description: "Class added successfully",
        });

        setClasses((current) => [normalizeClass(createdClass), ...current]);
        setIsAddDialogOpen(false);
        form.reset();
        fetchClasses();
        return;
      }

      const { error } = await apiClient
        .from('classes')
        .insert({
          ...values,
          school_id: profile.school_id
        });

      if (error) throw error;

      await auditLog.logAction('CREATE', 'new', {
        entityName: `${values.name} - Section ${values.section}`,
        class_level: values.class_level,
        capacity: values.capacity,
      });

      toast({
        title: "Success",
        description: "Class added successfully",
      });

      setIsAddDialogOpen(false);
      form.reset();
      fetchClasses();
    } catch (error: unknown) {
      const notice = handleApiError('Create class', error, {
        context: {
          schoolId: profile.school_id,
          className: values.name,
          section: values.section,
          classLevel: values.class_level,
        },
      });
      
      await auditLog.logFailedAction('new', {
        entityName: `${values.name} - Section ${values.section}`,
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

  const handleEditClass = async (values: ClassFormData) => {
    if (!editingClass) return;

    try {
      setValidationError(null);

      // Check for duplicate class name + section combination (excluding self)
      const existingClass = classes.find(
        c => c.id !== editingClass.id &&
             c.name.toLowerCase() === values.name.toLowerCase() && 
             c.section === values.section &&
             c.class_level === values.class_level &&
             c.is_active
      );

      if (existingClass) {
        const errorMsg = `A class named "${values.name}" Section ${values.section} already exists in this class level.`;
        setValidationError(errorMsg);
        toast({
          title: "Duplicate Class",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      if (isPhpBackend) {
        await phpApi.table<Class>('classes').update(editingClass.id, values);

        toast({
          title: "Success",
          description: "Class updated successfully",
        });

        setEditingClass(null);
        form.reset();
        fetchClasses();
        return;
      }

      const { error } = await apiClient
        .from('classes')
        .update(values)
        .eq('id', editingClass.id);

      if (error) throw error;

      await auditLog.logAction('UPDATE', editingClass.id, {
        entityName: `${values.name} - Section ${values.section}`,
        changes: {
          name: values.name,
          section: values.section,
          class_level: values.class_level,
          capacity: values.capacity,
        },
      });

      toast({
        title: "Success",
        description: "Class updated successfully",
      });

      setEditingClass(null);
      form.reset();
      fetchClasses();
    } catch (error: unknown) {
      const notice = handleApiError('Update class', error, {
        context: {
          classId: editingClass.id,
          className: values.name,
          section: values.section,
          classLevel: values.class_level,
        },
      });
      
      await auditLog.logFailedAction(editingClass.id, {
        entityName: `${values.name} - Section ${values.section}`,
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

  const handleDeleteClass = async (classId: string) => {
    try {
      setValidationError(null);

      const classToDelete = classes.find(c => c.id === classId);
      if (!classToDelete) return;

      // Check if class has enrolled students
      if ((classToDelete.student_count || 0) > 0) {
        const errorMsg = `Cannot deactivate class "${classToDelete.name}" - Section ${classToDelete.section}. It has ${classToDelete.student_count} enrolled student(s). Please transfer or remove all students first.`;
        setValidationError(errorMsg);
        toast({
          title: "Cannot Deactivate Class",
          description: errorMsg,
          variant: "destructive",
        });
        
        await auditLog.logFailedAction(classId, {
          entityName: `${classToDelete.name} - Section ${classToDelete.section}`,
          action: 'DELETE',
          error: `Class has ${classToDelete.student_count} enrolled students`,
        });
        
        return;
      }

      if (isPhpBackend) {
        await phpApi.table<Class>('classes').update(classId, { is_active: false });

        toast({
          title: "Success",
          description: "Class deactivated successfully",
        });

        fetchClasses();
        return;
      }

      const { error } = await apiClient
        .from('classes')
        .update({ is_active: false })
        .eq('id', classId);

      if (error) throw error;

      await auditLog.logAction('DELETE', classId, {
        entityName: `${classToDelete.name} - Section ${classToDelete.section}`,
        action: 'DEACTIVATE',
        reason: 'No enrolled students',
      });

      toast({
        title: "Success",
        description: "Class deactivated successfully",
      });

      fetchClasses();
    } catch (error: unknown) {
      const notice = handleApiError('Deactivate class', error, {
        context: { classId },
      });
      
      const classToDelete = classes.find(c => c.id === classId);
      if (classToDelete) {
        await auditLog.logFailedAction(classId, {
          entityName: `${classToDelete.name} - Section ${classToDelete.section}`,
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

  const classesWithStringBooleans = useMemo(() =>
    classes.map((c) => ({
      ...c,
      is_active_string: String(c.is_active),
    })),
    [classes]
  );

  const filteredClassesWithMeta = useAdvancedFilter(
    classesWithStringBooleans,
    advancedFilters.map((f) =>
      f.field === 'is_active' ? { ...f, field: 'is_active_string' } : f
    ),
    searchTerm,
    ['name', 'section', 'class_level']
  );

  const filteredClasses = filteredClassesWithMeta as Class[];

  const openEditDialog = (classItem: Class) => {
    if (!isAdmin) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to edit classes.",
        variant: "destructive",
      });
      return;
    }
    setEditingClass(classItem);
    form.reset({
      name: classItem.name,
      name_bangla: classItem.name_bangla || "",
      section: classItem.section,
      class_level: classItem.class_level,
      capacity: classItem.capacity
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
          <h1 className="text-3xl font-bold text-foreground">Class Management</h1>
          <p className="text-muted-foreground">Manage school classes and sections</p>
        </div>
        {isAdmin && (
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Class
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{classes.filter(c => c.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {classes.reduce((sum, c) => sum + (c.student_count || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {classes.reduce((sum, c) => sum + c.capacity, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <AdvancedFilter
            fields={filterFields}
            onFilterChange={setAdvancedFilters}
            onSearch={setSearchTerm}
            searchPlaceholder="Search classes by name, section, or level..."
          />
        </CardContent>
      </Card>

      {/* Classes List */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Classes ({filteredClasses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredClasses.map((classItem) => (
              <div key={classItem.id} className="border border-border rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{classItem.name} - Section {classItem.section}</h3>
                      <p className="text-sm text-muted-foreground">
                        Level: {CLASS_LEVELS.find(l => l.value === classItem.class_level)?.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Students: {classItem.student_count}/{classItem.capacity}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Badge variant={classItem.is_active ? 'default' : 'secondary'}>
                      {classItem.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(classItem)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClass(classItem.id)}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingClass} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingClass(null);
          form.reset();
          setValidationError(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
            <DialogDescription>Fill in class details and submit to save.</DialogDescription>
          </DialogHeader>
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingClass ? handleEditClass : handleAddClass)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Class 10" />
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
                    <FormLabel>Class Name (Bangla)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., দশম শ্রেণী" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="A" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingClass(null);
                    form.reset();
                    setValidationError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingClass ? 'Update' : 'Add'} Class
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
