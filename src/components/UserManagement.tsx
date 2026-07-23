import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, Edit, Users, Eye, Shield, UserCheck, UserX, CheckCircle, XCircle } from 'lucide-react';
import { handleApiError, ApiErrorNotice } from '@/lib/api-error-handler';

interface UserProfile {
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

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'teacher' as 'school_admin' | 'teacher',
    approval_status: 'pending',
    is_active: true,
    phone: '',
    school_id: '',
  });

  const showErrorNotice = useCallback((notice: ApiErrorNotice) => {
    toast({
      title: notice.title,
      description: notice.description,
      variant: 'destructive',
    });
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const [profiles, schoolRows] = await Promise.all([
          phpApi.table<UserProfile>('user_profiles').list({
            sort: 'created_at',
            order: 'desc',
            limit: 500,
          }),
          phpApi.table<SchoolOption>('schools').list({
            is_active: 1,
            sort: 'name',
            order: 'asc',
            limit: 500,
          }),
        ]);
        const schoolById = new Map(schoolRows.map((school) => [school.id, school]));
        setUsers((profiles || [])
          .filter((profile) => profile.role !== 'super_admin')
          .map((profile) => ({
            ...profile,
            is_active: Boolean(profile.is_active),
            schools: profile.school_id ? schoolById.get(profile.school_id) : undefined,
          })));
        setSchools(schoolRows || []);
        return;
      }

      const { data, error } = await apiClient
        .from('user_profiles')
        .select(`
          *,
          schools (name, school_type)
        `)
        .neq('role', 'super_admin') // Don't show super admins in the list
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      showErrorNotice(handleApiError('Load users', error));
    } finally {
      setLoading(false);
    }
  }, [showErrorNotice]);

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

      const { data, error } = await apiClient
        .from('schools')
        .select('id, name')
        .eq('is_active', true);

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      handleApiError('Load schools for user management', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchSchools();

    if (isPhpBackend) {
      return;
    }
    
    // Set up real-time subscription for user_profiles changes
    const channel = apiClient
      .channel('user_profiles_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles'
        },
        (payload) => {
          console.log('User profile change detected:', payload);
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      apiClient.removeChannel(channel);
    };
  }, [fetchUsers, fetchSchools]);

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      if (isPhpBackend) {
        await phpApi.table<UserProfile>('user_profiles').update(selectedUser.id, {
          full_name: formData.full_name,
          role: formData.role,
          approval_status: formData.approval_status,
          is_active: formData.is_active,
          phone: formData.phone,
          school_id: formData.school_id || null,
        });

        toast({
          title: 'Success',
          description: 'User updated successfully',
        });

        setIsEditDialogOpen(false);
        fetchUsers();
        return;
      }

      const { error } = await apiClient
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          approval_status: formData.approval_status,
          is_active: formData.is_active,
          phone: formData.phone,
          school_id: formData.school_id || null,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      showErrorNotice(handleApiError('Update user', error, {
        context: { userId: selectedUser.id, role: formData.role, schoolId: formData.school_id || null },
      }));
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      if (isPhpBackend) {
        await phpApi.table<UserProfile>('user_profiles').update(userId, { approval_status: 'approved' });

        toast({
          title: 'Success',
          description: 'User approved successfully',
        });

        fetchUsers();
        return;
      }

      const { error } = await apiClient
        .from('user_profiles')
        .update({ approval_status: 'approved' })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User approved successfully',
      });

      fetchUsers();
    } catch (error) {
      showErrorNotice(handleApiError('Approve user', error, {
        context: { userId },
      }));
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      if (isPhpBackend) {
        await phpApi.table<UserProfile>('user_profiles').update(userId, { approval_status: 'rejected' });

        toast({
          title: 'Success',
          description: 'User rejected successfully',
        });

        fetchUsers();
        return;
      }

      const { error } = await apiClient
        .from('user_profiles')
        .update({ approval_status: 'rejected' })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User rejected successfully',
      });

      fetchUsers();
    } catch (error) {
      showErrorNotice(handleApiError('Reject user', error, {
        context: { userId },
      }));
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      if (isPhpBackend) {
        await phpApi.table<UserProfile>('user_profiles').update(userId, { is_active: false });

        toast({
          title: 'Success',
          description: 'User deactivated successfully',
        });

        fetchUsers();
        return;
      }

      const { error } = await apiClient
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User deactivated successfully',
      });

      fetchUsers();
    } catch (error) {
      showErrorNotice(handleApiError('Deactivate user', error, {
        context: { userId },
      }));
    }
  };

  const openEditDialog = async (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      role: user.role as 'school_admin' | 'teacher',
      approval_status: user.approval_status,
      is_active: user.is_active,
      phone: user.phone || '',
      school_id: user.school_id || '',
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'school_admin':
        return <Shield className="h-4 w-4" />;
      case 'teacher':
        return <Users className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'school_admin':
        return 'default';
      case 'teacher':
        return 'secondary';
      default:
        return 'outline';
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.schools?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.approval_status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

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
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage all users including teachers and school administrators</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            System Users
          </CardTitle>
          <CardDescription>
            View and manage all users in the system with approval controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="school_admin">School Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          {user.full_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeColor(user.role)}>
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeColor(user.approval_status)}>
                          {user.approval_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{user.schools?.name || 'Not assigned'}</div>
                          {user.schools?.school_type && (
                            <Badge className={getSchoolTypeBadgeColor(user.schools.school_type)}>
                              {user.schools.school_type.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewDialog(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {user.approval_status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleApproveUser(user.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectUser(user.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {user.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeactivateUser(user.id)}
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
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View user information and details
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.full_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Role</Label>
                  <Badge variant={getRoleBadgeColor(selectedUser.role)}>
                    {selectedUser.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">School</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.schools?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge variant={getStatusBadgeColor(selectedUser.approval_status)}>
                    {selectedUser.approval_status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Active</Label>
                  <Badge variant={selectedUser.is_active ? 'default' : 'secondary'}>
                    {selectedUser.is_active ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedUser.created_at).toLocaleDateString()}
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information, role, and permissions
            </DialogDescription>
          </DialogHeader>
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
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value: 'school_admin' | 'teacher') => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="school_admin">School Admin</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="school_id">School</Label>
              <Select value={formData.school_id} onValueChange={(value) => setFormData({ ...formData, school_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
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
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
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
            <Button onClick={handleUpdateUser}>
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
