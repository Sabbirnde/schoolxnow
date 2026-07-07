import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/php-api/compat-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdvancedFilter, FilterField, FilterValue } from '@/components/AdvancedFilter';
import { useAdvancedFilter } from '@/hooks/useAdvancedFilter';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Edit, Users, Eye, CheckCircle, XCircle, UserX, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePollingRefresh } from '@/hooks/usePollingRefresh';
import { handleSupabaseError, SupabaseErrorNotice } from '@/lib/api-error-handler';

interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  role: 'school_admin' | 'super_admin' | 'teacher';
  approval_status: string;
  is_active: boolean;
  phone: string | null;
  school_id: string | null;
  created_at: string;
  schools?: { name: string; school_type: string };
}

interface SchoolOption {
  id: string;
  name: string;
  school_type: string;
}

interface TeacherRecord {
  id: string;
  user_id: string | null;
  school_id: string;
  teacher_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  qualification: string | null;
  subject_specialization: string | null;
  designation: string | null;
  is_active: boolean | number;
}

const normalizeTeacherProfile = (teacher: Teacher, school?: SchoolOption): Teacher => ({
  ...teacher,
  is_active: Boolean(teacher.is_active),
  schools: school ? { name: school.name, school_type: school.school_type } : teacher.schools,
});

const TeacherManagement = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const auditLog = useAuditLog('TEACHER');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValue[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    approval_status: 'pending',
    is_active: true,
    phone: '',
    school_id: '',
  });
  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    qualification: '',
    subject_specialization: '',
    designation: '',
  });

  const showErrorNotice = useCallback((notice: SupabaseErrorNotice) => {
    toast({
      title: notice.title,
      description: notice.description,
      variant: 'destructive',
    });
  }, [toast]);

  const filterFields: FilterField[] = [
    { key: 'full_name', label: 'Teacher Name', type: 'text', placeholder: 'Enter name...' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: 'Enter phone...' },
    { key: 'approval_status', label: 'Status', type: 'select', options: [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' }
    ]},
    { key: 'is_active', label: 'Active', type: 'select', options: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' }
    ]},
    { key: 'school_name', label: 'School', type: 'text', placeholder: 'Enter school name...' },
  ];

  const fetchTeachers = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const schoolRows = await phpApi.table<SchoolOption>('schools').list({
          is_active: 1,
          sort: 'name',
          order: 'asc',
          limit: 500,
        });
        const schoolById = new Map(schoolRows.map((school) => [school.id, school]));
        const filters: Record<string, string | number> = {
          role: 'teacher',
          sort: 'created_at',
          order: 'desc',
          limit: 500,
        };

        if (canFull('teachers.manage') && profile?.school_id) {
          filters.school_id = profile.school_id;
        }

        const data = await phpApi.table<Teacher>('user_profiles').list(filters);
        setSchools(schoolRows);
        setTeachers((data || []).map((teacher) => normalizeTeacherProfile(
          teacher,
          teacher.school_id ? schoolById.get(teacher.school_id) : undefined
        )));
        return;
      }

      let query = supabase
        .from('user_profiles')
        .select(`
          *,
          schools (name, school_type)
        `)
        .eq('role', 'teacher');

      // School admins can only see teachers from their school
      if (canFull('teachers.manage') && profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setTeachers(data || []);
    } catch (error) {
      showErrorNotice(handleSupabaseError('Load teachers', error, {
        context: { schoolId: profile?.school_id },
      }));
    } finally {
      setLoading(false);
    }
  }, [canFull, profile?.school_id, showErrorNotice]);

  const fetchSchools = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const data = await phpApi.table<SchoolOption>('schools').list({
          is_active: 1,
          sort: 'name',
          order: 'asc',
          limit: 500,
        });
        setSchools(data || []);
        return;
      }

      const { data, error } = await supabase
        .from('schools')
        .select('id, name, school_type')
        .eq('is_active', true);

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      handleSupabaseError('Load schools for teacher management', error);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
    fetchSchools();

    if (isPhpBackend) {
      return;
    }
    
    // Set up real-time subscription for user_profiles changes
    const channel = supabase
      .channel('teacher_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles'
        },
        (payload) => {
          console.log('Teacher profile change detected:', payload);
          fetchTeachers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTeachers, fetchSchools]);

  usePollingRefresh({
    enabled: isPhpBackend,
    intervalMs: 10000,
    onRefresh: fetchTeachers,
  });

  const handleUpdateTeacher = async () => {
    if (!selectedTeacher) return;

    try {
      setValidationError(null);

      if (isPhpBackend) {
        await phpApi.table<Teacher>('user_profiles').update(selectedTeacher.id, {
          full_name: formData.full_name,
          approval_status: formData.approval_status,
          is_active: formData.is_active,
          phone: formData.phone,
          school_id: formData.school_id === 'none' ? null : formData.school_id,
        });

        toast({
          title: 'Success',
          description: 'Teacher updated successfully',
        });

        setIsEditDialogOpen(false);
        fetchTeachers();
        return;
      }
      
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          approval_status: formData.approval_status,
          is_active: formData.is_active,
          phone: formData.phone,
          school_id: formData.school_id === 'none' ? null : formData.school_id,
        })
        .eq('id', selectedTeacher.id);

      if (error) {
        const notice = handleSupabaseError('Update teacher', error, {
          context: { teacherId: selectedTeacher.id, schoolId: formData.school_id },
        });
        await auditLog.logFailedAction(selectedTeacher.id, {
          entityName: selectedTeacher.full_name,
          changes: {
            full_name: formData.full_name,
            approval_status: formData.approval_status,
            is_active: formData.is_active,
            phone: formData.phone,
          },
          error: notice.description,
        });
        
        showErrorNotice(notice);
        return;
      }

      await auditLog.logAction('UPDATE', selectedTeacher.id, {
        entityName: selectedTeacher.full_name,
        changes: {
          full_name: formData.full_name,
          approval_status: formData.approval_status,
          is_active: formData.is_active,
          phone: formData.phone,
        },
      });

      toast({
        title: 'Success',
        description: 'Teacher updated successfully',
      });

      setIsEditDialogOpen(false);
      fetchTeachers();
    } catch (error) {
      const notice = handleSupabaseError('Update teacher', error, {
        context: { teacherId: selectedTeacher.id, schoolId: formData.school_id },
      });
      await auditLog.logFailedAction(selectedTeacher.id, {
        entityName: selectedTeacher.full_name,
        error: notice.description,
      });
      showErrorNotice(notice);
    }
  };

  const handleApproveTeacher = async (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    try {
      if (isPhpBackend) {
        await phpApi.table<Teacher>('user_profiles').update(teacherId, {
          approval_status: 'approved',
        });

        toast({
          title: 'Success',
          description: 'Teacher approved successfully',
        });

        fetchTeachers();
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ approval_status: 'approved' })
        .eq('id', teacherId);

      if (error) {
        const notice = handleSupabaseError('Approve teacher', error, {
          context: { teacherId, schoolId: teacher.school_id },
        });
        await auditLog.logFailedAction(teacherId, {
          entityName: teacher.full_name,
          action: 'APPROVE',
          transition: 'pending→approved',
          error: notice.description,
        });
        
        toast({
          title: notice.title,
          description: notice.description,
          variant: 'destructive',
        });
        return;
      }

      await auditLog.logAction('APPROVE', teacherId, {
        entityName: teacher.full_name,
        transition: 'pending→approved',
      });

      toast({
        title: 'Success',
        description: 'Teacher approved successfully',
      });

      fetchTeachers();
    } catch (error) {
      const notice = handleSupabaseError('Approve teacher', error, {
        context: { teacherId, schoolId: teacher.school_id },
      });
      await auditLog.logFailedAction(teacherId, {
        entityName: teacher.full_name,
        action: 'APPROVE',
        error: notice.description,
      });
      showErrorNotice(notice);
    }
  };

  const handleRejectTeacher = async (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    try {
      if (isPhpBackend) {
        await phpApi.table<Teacher>('user_profiles').update(teacherId, {
          approval_status: 'rejected',
        });

        toast({
          title: 'Success',
          description: 'Teacher rejected successfully',
        });

        fetchTeachers();
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ approval_status: 'rejected' })
        .eq('id', teacherId);

      if (error) {
        const notice = handleSupabaseError('Reject teacher', error, {
          context: { teacherId, schoolId: teacher.school_id },
        });
        await auditLog.logFailedAction(teacherId, {
          entityName: teacher.full_name,
          action: 'REJECT',
          transition: 'pending→rejected',
          error: notice.description,
        });
        
        toast({
          title: notice.title,
          description: notice.description,
          variant: 'destructive',
        });
        return;
      }

      await auditLog.logAction('REJECT', teacherId, {
        entityName: teacher.full_name,
        transition: 'pending→rejected',
      });

      toast({
        title: 'Success',
        description: 'Teacher rejected successfully',
      });

      fetchTeachers();
    } catch (error) {
      const notice = handleSupabaseError('Reject teacher', error, {
        context: { teacherId, schoolId: teacher.school_id },
      });
      await auditLog.logFailedAction(teacherId, {
        entityName: teacher.full_name,
        action: 'REJECT',
        error: notice.description,
      });
      showErrorNotice(notice);
    }
  };

  const handleDeactivateTeacher = async (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    try {
      if (isPhpBackend) {
        await phpApi.table<Teacher>('user_profiles').update(teacherId, {
          is_active: false,
        });

        toast({
          title: 'Success',
          description: 'Teacher deactivated successfully',
        });

        fetchTeachers();
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', teacherId);

      if (error) {
        const notice = handleSupabaseError('Deactivate teacher', error, {
          context: { teacherId, schoolId: teacher.school_id },
        });
        await auditLog.logFailedAction(teacherId, {
          entityName: teacher.full_name,
          action: 'DEACTIVATE',
          transition: 'active→inactive',
          error: notice.description,
        });
        
        toast({
          title: notice.title,
          description: notice.description,
          variant: 'destructive',
        });
        return;
      }

      await auditLog.logAction('DELETE', teacherId, {
        entityName: teacher.full_name,
        action: 'DEACTIVATE',
        transition: 'active→inactive',
      });

      toast({
        title: 'Success',
        description: 'Teacher deactivated successfully',
      });

      fetchTeachers();
    } catch (error) {
      const notice = handleSupabaseError('Deactivate teacher', error, {
        context: { teacherId, schoolId: teacher.school_id },
      });
      await auditLog.logFailedAction(teacherId, {
        entityName: teacher.full_name,
        action: 'DEACTIVATE',
        error: notice.description,
      });
      showErrorNotice(notice);
    }
  };

  const openEditDialog = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      full_name: teacher.full_name,
      approval_status: teacher.approval_status,
      is_active: teacher.is_active,
      phone: teacher.phone || '',
      school_id: teacher.school_id || 'none',
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsViewDialogOpen(true);
  };

  const handleCreateTeacher = async () => {
    if (!profile?.school_id) {
      toast({
        title: 'Error',
        description: 'No school assigned to your account',
        variant: 'destructive',
      });
      return;
    }

    if (!createFormData.email || !createFormData.password || !createFormData.full_name || !createFormData.phone) {
      setValidationError('Please fill in all required fields: Email, Password, Full Name, and Phone');
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setValidationError(null);

      if (isPhpBackend) {
        const user = await phpApi.register({
          email: createFormData.email,
          password: createFormData.password,
          full_name: createFormData.full_name,
          role: 'teacher',
          school_id: profile.school_id,
        });

        const profileRows = await phpApi.table<Teacher>('user_profiles').list({
          user_id: user.id,
          limit: 1,
        });
        const teacherProfile = profileRows[0];

        if (teacherProfile) {
          await phpApi.table<Teacher>('user_profiles').update(teacherProfile.id, {
            phone: createFormData.phone,
            approval_status: 'approved',
            is_active: true,
          });
        }

        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const teacherId = `TCH-${timestamp}-${random}`;

        await phpApi.table<TeacherRecord>('teachers').create({
          user_id: user.id,
          school_id: profile.school_id,
          full_name: createFormData.full_name,
          phone: createFormData.phone,
          email: createFormData.email,
          qualification: createFormData.qualification || null,
          subject_specialization: createFormData.subject_specialization || null,
          designation: createFormData.designation || null,
          teacher_id: teacherId,
          is_active: true,
        });

        toast({
          title: 'Success',
          description: 'Teacher account created successfully',
        });

        setIsCreateDialogOpen(false);
        setCreateFormData({
          email: '',
          password: '',
          full_name: '',
          phone: '',
          qualification: '',
          subject_specialization: '',
          designation: '',
        });
        fetchTeachers();
        return;
      }

      // Create auth user with teacher role
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createFormData.email,
        password: createFormData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: createFormData.full_name,
            role: 'teacher',
            school_id: profile.school_id,
          },
        },
      });

      if (authError) {
        const notice = handleSupabaseError('Create teacher auth account', authError, {
          context: { schoolId: profile.school_id, email: createFormData.email },
        });
        setValidationError(notice.description);
        await auditLog.logFailedAction('new', {
          entityName: createFormData.full_name,
          action: 'CREATE',
          error: notice.description,
        });
        
        showErrorNotice(notice);
        return;
      }

      if (!authData.user) {
        const accountError = new Error('Supabase did not return a user account after signup');
        const notice = handleSupabaseError('Create teacher auth account', accountError, {
          context: { schoolId: profile.school_id, email: createFormData.email },
        });
        setValidationError(notice.description);
        await auditLog.logFailedAction('new', {
          entityName: createFormData.full_name,
          action: 'CREATE',
          error: notice.description,
        });
        
        showErrorNotice(notice);
        return;
      }

      // Generate teacher ID
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const teacherId = `TCH-${timestamp}-${random}`;

      // Create teacher record
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: authData.user.id,
          school_id: profile.school_id,
          full_name: createFormData.full_name,
          phone: createFormData.phone,
          email: createFormData.email,
          qualification: createFormData.qualification || null,
          subject_specialization: createFormData.subject_specialization || null,
          designation: createFormData.designation || null,
          teacher_id: teacherId,
          is_active: true,
      });

      if (teacherError) {
        const notice = handleSupabaseError('Create teacher record', teacherError, {
          context: { schoolId: profile.school_id, userId: authData.user.id, teacherId },
        });
        await auditLog.logFailedAction(authData.user.id, {
          entityName: createFormData.full_name,
          action: 'CREATE',
          error: notice.description,
        });
        
        showErrorNotice(notice);
        return;
      }

      await auditLog.logAction('CREATE', authData.user.id, {
        entityName: createFormData.full_name,
        email: createFormData.email,
        phone: createFormData.phone,
        teacher_id: teacherId,
      });

      toast({
        title: 'Success',
        description: 'Teacher account created successfully',
      });

      setIsCreateDialogOpen(false);
      setCreateFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        qualification: '',
        subject_specialization: '',
        designation: '',
      });
      fetchTeachers();
    } catch (error) {
      const notice = handleSupabaseError('Create teacher', error, {
        context: { schoolId: profile.school_id, email: createFormData.email },
      });
      setValidationError(notice.description);
      await auditLog.logFailedAction('new', {
        entityName: createFormData.full_name,
        action: 'CREATE',
        error: notice.description,
      });
      showErrorNotice(notice);
    }
  };

  const getStatusBadgeColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getSchoolTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'bangla_medium':
        return 'bg-green-100 text-green-800';
      case 'english_medium':
        return 'bg-blue-100 text-blue-800';
      case 'madrasha':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const teachersWithSchoolName = teachers.map(t => ({
    ...t,
    school_name: t.schools?.name || '',
    is_active_string: String(t.is_active)
  }));

  const filteredTeachersWithMeta = useAdvancedFilter(
    teachersWithSchoolName,
    advancedFilters.map(f => f.field === 'is_active' ? { ...f, field: 'is_active_string' } : f),
    searchTerm,
    ['full_name', 'phone', 'school_name']
  );

  // Map back to original teacher objects
  const filteredTeachers = filteredTeachersWithMeta.map(t => teachers.find(orig => orig.id === t.id)!).filter(Boolean);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teacher Management</h2>
          <p className="text-muted-foreground">Manage teachers and their permissions</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create Teacher
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teachers
          </CardTitle>
          <CardDescription>
            View and manage all teachers in your school
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <AdvancedFilter
              fields={filterFields}
              onFilterChange={setAdvancedFilters}
              onSearch={setSearchTerm}
              searchPlaceholder="Search teachers by name, phone, or school..."
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No teachers found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {teacher.full_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeColor(teacher.approval_status)}>
                          {teacher.approval_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{teacher.schools?.name || 'Not assigned'}</div>
                          {teacher.schools?.school_type && (
                            <Badge className={getSchoolTypeBadgeColor(teacher.schools.school_type)}>
                              {teacher.schools.school_type.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{teacher.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={teacher.is_active ? 'default' : 'secondary'}>
                          {teacher.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewDialog(teacher)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(teacher)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {teacher.approval_status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleApproveTeacher(teacher.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectTeacher(teacher.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {teacher.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeactivateTeacher(teacher.id)}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teacher Details</DialogTitle>
            <DialogDescription>
              View teacher information and details
            </DialogDescription>
          </DialogHeader>
          {selectedTeacher && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{selectedTeacher.full_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">{selectedTeacher.phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">School</Label>
                  <p className="text-sm text-muted-foreground">{selectedTeacher.schools?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge variant={getStatusBadgeColor(selectedTeacher.approval_status)}>
                    {selectedTeacher.approval_status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Active</Label>
                  <Badge variant={selectedTeacher.is_active ? 'default' : 'secondary'}>
                    {selectedTeacher.is_active ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedTeacher.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Teacher Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Teacher Account</DialogTitle>
            <DialogDescription>
              Create a new teacher account with username and password
            </DialogDescription>
          </DialogHeader>
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create_email">Email (Username) *</Label>
              <Input
                id="create_email"
                type="email"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                placeholder="teacher@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_password">Password *</Label>
              <Input
                id="create_password"
                type="password"
                value={createFormData.password}
                onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_full_name">Full Name *</Label>
              <Input
                id="create_full_name"
                value={createFormData.full_name}
                onChange={(e) => setCreateFormData({ ...createFormData, full_name: e.target.value })}
                placeholder="Teacher full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_phone">Phone *</Label>
              <Input
                id="create_phone"
                value={createFormData.phone}
                onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_qualification">Qualification</Label>
              <Input
                id="create_qualification"
                value={createFormData.qualification}
                onChange={(e) => setCreateFormData({ ...createFormData, qualification: e.target.value })}
                placeholder="e.g., B.Ed, M.A."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_subject">Subject Specialization</Label>
              <Input
                id="create_subject"
                value={createFormData.subject_specialization}
                onChange={(e) => setCreateFormData({ ...createFormData, subject_specialization: e.target.value })}
                placeholder="e.g., Mathematics, English"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="create_designation">Designation</Label>
              <Input
                id="create_designation"
                value={createFormData.designation}
                onChange={(e) => setCreateFormData({ ...createFormData, designation: e.target.value })}
                placeholder="e.g., Senior Teacher, Head of Department"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeacher}>
              Create Teacher Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update teacher information and permissions
            </DialogDescription>
          </DialogHeader>
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval_status">Approval Status</Label>
              <Select value={formData.approval_status} onValueChange={(value) => setFormData({ ...formData, approval_status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_id">School</Label>
              <Select value={formData.school_id || "none"} onValueChange={(value) => setFormData({ ...formData, school_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No school assigned</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <Label htmlFor="is_active">Active User</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTeacher}>
              Update Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherManagement;
