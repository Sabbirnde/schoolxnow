import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Edit, Trash2, School, MapPin, Phone, Mail } from 'lucide-react';

interface School {
  id: string;
  name: string;
  name_bangla: string | null;
  school_type: 'madrasha' | 'bangla_medium' | 'english_medium';
  address: string;
  address_bangla: string | null;
  phone: string | null;
  email: string | null;
  eiin_number: string | null;
  established_year: number | null;
  is_active: boolean;
  created_at: string;
}

const SchoolManagement = () => {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    name_bangla: string;
    school_type: 'madrasha' | 'bangla_medium' | 'english_medium';
    address: string;
    address_bangla: string;
    phone: string;
    email: string;
    eiin_number: string;
    established_year: number;
    is_active: boolean;
  }>({
    name: '',
    name_bangla: '',
    school_type: 'bangla_medium',
    address: '',
    address_bangla: '',
    phone: '',
    email: '',
    eiin_number: '',
    established_year: new Date().getFullYear(),
    is_active: true,
  });

  useEffect(() => {
    if (canFull('schools.view')) {
      fetchSchools();
    }
  }, [profile, canFull]);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching schools:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch schools',
          variant: 'destructive',
        });
        return;
      }

      setSchools(data || []);
    } catch (error) {
      console.error('Error in fetchSchools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchool = async () => {
    try {
      const { error } = await supabase
        .from('schools')
        .insert([{
          name: formData.name,
          name_bangla: formData.name_bangla || null,
          school_type: formData.school_type,
          address: formData.address,
          address_bangla: formData.address_bangla || null,
          phone: formData.phone || null,
          email: formData.email || null,
          eiin_number: formData.eiin_number || null,
          established_year: formData.established_year,
          is_active: formData.is_active,
        }]);

      if (error) {
        console.error('Error creating school:', error);
        toast({
          title: 'Error',
          description: 'Failed to create school',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'School created successfully',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchSchools();
    } catch (error) {
      console.error('Error in handleCreateSchool:', error);
    }
  };

  const handleUpdateSchool = async () => {
    if (!selectedSchool) return;

    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: formData.name,
          name_bangla: formData.name_bangla || null,
          school_type: formData.school_type,
          address: formData.address,
          address_bangla: formData.address_bangla || null,
          phone: formData.phone || null,
          email: formData.email || null,
          eiin_number: formData.eiin_number || null,
          established_year: formData.established_year,
          is_active: formData.is_active,
        })
        .eq('id', selectedSchool.id);

      if (error) {
        console.error('Error updating school:', error);
        toast({
          title: 'Error',
          description: 'Failed to update school',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'School updated successfully',
      });

      setIsDialogOpen(false);
      fetchSchools();
    } catch (error) {
      console.error('Error in handleUpdateSchool:', error);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!confirm('Are you sure you want to delete this school? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('schools')
        .delete()
        .eq('id', schoolId);

      if (error) {
        console.error('Error deleting school:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete school',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'School deleted successfully',
      });

      fetchSchools();
    } catch (error) {
      console.error('Error in handleDeleteSchool:', error);
    }
  };

  const openCreateDialog = () => {
    setIsCreateMode(true);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (school: School) => {
    setIsCreateMode(false);
    setSelectedSchool(school);
    setFormData({
      name: school.name,
      name_bangla: school.name_bangla || '',
      school_type: school.school_type,
      address: school.address,
      address_bangla: school.address_bangla || '',
      phone: school.phone || '',
      email: school.email || '',
      eiin_number: school.eiin_number || '',
      established_year: school.established_year || new Date().getFullYear(),
      is_active: school.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_bangla: '',
      school_type: 'bangla_medium' as const,
      address: '',
      address_bangla: '',
      phone: '',
      email: '',
      eiin_number: '',
      established_year: new Date().getFullYear(),
      is_active: true,
    });
  };

  const getSchoolTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      madrasha: 'Madrasha',
      bangla_medium: 'Bangla Medium',
      english_medium: 'English Medium',
    };
    return types[type] || type;
  };

  const getSchoolTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      madrasha: 'outline',
      bangla_medium: 'default',
      english_medium: 'secondary',
    };
    return colors[type] || 'outline';
  };

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.school_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (profile?.role !== 'super_admin') {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold">Access Denied</h3>
        <p className="text-muted-foreground">Only super administrators can manage schools.</p>
      </div>
    );
  }

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
          <h2 className="text-3xl font-bold tracking-tight">School Management</h2>
          <p className="text-muted-foreground">Manage schools across the platform</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add School
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schools Directory</CardTitle>
          <CardDescription>
            View and manage all schools in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>EIIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No schools found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSchools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{school.name}</div>
                          {school.name_bangla && (
                            <div className="text-sm text-muted-foreground">{school.name_bangla}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSchoolTypeBadgeColor(school.school_type) as any}>
                          {getSchoolTypeLabel(school.school_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {school.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {school.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {school.phone}
                            </div>
                          )}
                          {school.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {school.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{school.eiin_number || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={school.is_active ? 'default' : 'secondary'}>
                          {school.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(school)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSchool(school.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? 'Create New School' : 'Edit School'}</DialogTitle>
            <DialogDescription>
              {isCreateMode ? 'Add a new school to the platform' : 'Update school information'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">School Name (English) *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_bangla">School Name (Bangla)</Label>
              <Input
                id="name_bangla"
                value={formData.name_bangla}
                onChange={(e) => setFormData({ ...formData, name_bangla: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_type">School Type *</Label>
              <Select value={formData.school_type} onValueChange={(value: any) => setFormData({ ...formData, school_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="madrasha">Madrasha</SelectItem>
                  <SelectItem value="bangla_medium">Bangla Medium</SelectItem>
                  <SelectItem value="english_medium">English Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eiin_number">EIIN Number</Label>
              <Input
                id="eiin_number"
                value={formData.eiin_number}
                onChange={(e) => setFormData({ ...formData, eiin_number: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">Address (English) *</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address_bangla">Address (Bangla)</Label>
              <Textarea
                id="address_bangla"
                value={formData.address_bangla}
                onChange={(e) => setFormData({ ...formData, address_bangla: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="established_year">Established Year</Label>
              <Input
                id="established_year"
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={formData.established_year}
                onChange={(e) => setFormData({ ...formData, established_year: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <Label htmlFor="is_active">Active School</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={isCreateMode ? handleCreateSchool : handleUpdateSchool}>
              {isCreateMode ? 'Create School' : 'Update School'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolManagement;
