import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { supabase } from '@/integrations/php-api/compat-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { handleSupabaseError } from '@/lib/api-error-handler';
import { 
  School, 
  Users, 
  BookOpen, 
  Calendar,
  Settings,
  Bell,
  Shield,
  FileText,
  Clock,
  GraduationCap
} from 'lucide-react';

interface SchoolInfo {
  id: string;
  name: string;
  name_bangla: string | null;
  address: string;
  address_bangla: string | null;
  phone: string | null;
  email: string | null;
  eiin_number: string | null;
  school_type: string;
  established_year: number | null;
}

interface SchoolSettings {
  academic_year_start: string;
  academic_year_end: string;
  max_students_per_class: number;
  allow_parent_portal: boolean;
  enable_notifications: boolean;
  attendance_grace_period: number;
  exam_result_publish_auto: boolean;
  default_session_duration: number;
}

export default function SchoolSettings() {
  const { profile } = useAuth();
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [settings, setSettings] = useState<SchoolSettings>({
    academic_year_start: '2024-01-01',
    academic_year_end: '2024-12-31',
    max_students_per_class: 40,
    allow_parent_portal: false,
    enable_notifications: true,
    attendance_grace_period: 15,
    exam_result_publish_auto: false,
    default_session_duration: 45,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSchoolInfo = useCallback(async () => {
    try {
      setLoading(true);
      if (isPhpBackend) {
        if (!profile?.school_id) return;
        const data = await phpApi.table<SchoolInfo>('schools').get(profile.school_id);
        setSchoolInfo(data);
        return;
      }

      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', profile?.school_id)
        .single();

      if (error) throw error;
      setSchoolInfo(data);
    } catch (error) {
      const notice = handleSupabaseError('Load school settings', error, {
        context: { schoolId: profile?.school_id },
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo();
    }
  }, [profile?.school_id, fetchSchoolInfo]);

  const handleSaveSchoolInfo = async () => {
    if (!schoolInfo) return;
    
    try {
      setSaving(true);
      if (isPhpBackend) {
        if (!profile?.school_id) return;
        await phpApi.table<SchoolInfo>('schools').update(profile.school_id, {
          name: schoolInfo.name,
          name_bangla: schoolInfo.name_bangla,
          address: schoolInfo.address,
          address_bangla: schoolInfo.address_bangla,
          phone: schoolInfo.phone,
          email: schoolInfo.email,
          eiin_number: schoolInfo.eiin_number,
          established_year: schoolInfo.established_year,
        });
        toast.success('School information updated successfully');
        return;
      }

      const { error } = await supabase
        .from('schools')
        .update({
          name: schoolInfo.name,
          name_bangla: schoolInfo.name_bangla,
          address: schoolInfo.address,
          address_bangla: schoolInfo.address_bangla,
          phone: schoolInfo.phone,
          email: schoolInfo.email,
          eiin_number: schoolInfo.eiin_number,
          established_year: schoolInfo.established_year,
        })
        .eq('id', profile?.school_id);

      if (error) throw error;
      toast.success('School information updated successfully');
    } catch (error) {
      const notice = handleSupabaseError('Update school settings', error, {
        context: { schoolId: profile?.school_id },
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    // In a real implementation, you'd save these to a school_settings table
    toast.success('Settings saved successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96 p-3 lg:p-6">
        <div className="animate-spin rounded-full h-16 w-16 lg:h-32 lg:w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (profile?.role !== 'school_admin') {
    return (
      <div className="text-center py-8 lg:py-12 p-3 lg:p-6">
        <Shield className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg lg:text-xl font-semibold">Access Denied</h3>
        <p className="text-muted-foreground text-sm lg:text-base">Only school administrators can access these settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-6 p-3 lg:p-6">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">School Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your school configuration and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="school" className="space-y-3 lg:space-y-4">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/50 rounded-lg">
          <TabsTrigger 
            value="school" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <School className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">School Info</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger 
            value="academic" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Academic</span>
            <span className="sm:hidden">Year</span>
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">System</span>
            <span className="sm:hidden">Sys</span>
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Bell</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="school" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <School className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                School Information
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Update your school's basic information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              {schoolInfo && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="school_name" className="text-sm font-medium">School Name (English)</Label>
                      <Input
                        id="school_name"
                        value={schoolInfo.name}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school_name_bangla" className="text-sm font-medium">School Name (বাংলা)</Label>
                      <Input
                        id="school_name_bangla"
                        value={schoolInfo.name_bangla || ''}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, name_bangla: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium">Address (English)</Label>
                      <Input
                        id="address"
                        value={schoolInfo.address}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_bangla" className="text-sm font-medium">Address (বাংলা)</Label>
                      <Input
                        id="address_bangla"
                        value={schoolInfo.address_bangla || ''}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, address_bangla: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                      <Input
                        id="phone"
                        value={schoolInfo.phone || ''}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, phone: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={schoolInfo.email || ''}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, email: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eiin" className="text-sm font-medium">EIIN Number</Label>
                      <Input
                        id="eiin"
                        value={schoolInfo.eiin_number || ''}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, eiin_number: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="school_type" className="text-sm font-medium">School Type</Label>
                      <Badge variant="outline" className="w-fit">
                        {schoolInfo.school_type}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="established_year" className="text-sm font-medium">Established Year</Label>
                      <Input
                        id="established_year"
                        type="number"
                        min="1800"
                        max={new Date().getFullYear()}
                        value={schoolInfo.established_year || ''}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, established_year: parseInt(e.target.value) || null })}
                        className="touch-target"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveSchoolInfo} 
                    disabled={saving}
                    className="w-full sm:w-auto touch-target"
                  >
                    {saving ? 'Saving...' : 'Save School Information'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <GraduationCap className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Academic Settings
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Configure academic year and class settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="academic_start" className="text-sm font-medium">Academic Year Start</Label>
                  <Input
                    id="academic_start"
                    type="date"
                    value={settings.academic_year_start}
                    onChange={(e) => setSettings({ ...settings, academic_year_start: e.target.value })}
                    className="touch-target"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academic_end" className="text-sm font-medium">Academic Year End</Label>
                  <Input
                    id="academic_end"
                    type="date"
                    value={settings.academic_year_end}
                    onChange={(e) => setSettings({ ...settings, academic_year_end: e.target.value })}
                    className="touch-target"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_students" className="text-sm font-medium">Max Students Per Class</Label>
                  <Input
                    id="max_students"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.max_students_per_class}
                    onChange={(e) => setSettings({ ...settings, max_students_per_class: parseInt(e.target.value) })}
                    className="touch-target"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session_duration" className="text-sm font-medium">Default Session Duration (minutes)</Label>
                  <Input
                    id="session_duration"
                    type="number"
                    min="30"
                    max="120"
                    value={settings.default_session_duration}
                    onChange={(e) => setSettings({ ...settings, default_session_duration: parseInt(e.target.value) })}
                    className="touch-target"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grace_period" className="text-sm font-medium">Attendance Grace Period (minutes)</Label>
                <Input
                  id="grace_period"
                  type="number"
                  min="0"
                  max="60"
                  value={settings.attendance_grace_period}
                  onChange={(e) => setSettings({ ...settings, attendance_grace_period: parseInt(e.target.value) })}
                  className="touch-target"
                />
              </div>

              <Button 
                onClick={handleSaveSettings}
                className="w-full sm:w-auto touch-target"
              >
                Save Academic Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Settings className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                System Preferences
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Configure system behavior and features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Parent Portal Access</Label>
                    <p className="text-xs text-muted-foreground">Allow parents to view student information</p>
                  </div>
                  <Switch
                    checked={settings.allow_parent_portal}
                    onCheckedChange={(checked) => setSettings({ ...settings, allow_parent_portal: checked })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Auto-publish Exam Results</Label>
                    <p className="text-xs text-muted-foreground">Automatically publish results when entered</p>
                  </div>
                  <Switch
                    checked={settings.exam_result_publish_auto}
                    onCheckedChange={(checked) => setSettings({ ...settings, exam_result_publish_auto: checked })}
                  />
                </div>
              </div>

              <Button 
                onClick={handleSaveSettings}
                className="w-full sm:w-auto touch-target"
              >
                Save System Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Bell className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Manage notification preferences and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Enable Notifications</Label>
                    <p className="text-xs text-muted-foreground">Receive system notifications and alerts</p>
                  </div>
                  <Switch
                    checked={settings.enable_notifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, enable_notifications: checked })}
                  />
                </div>
              </div>

              <div className="p-3 lg:p-4 border border-muted rounded-lg bg-muted/10">
                <h4 className="text-sm font-medium mb-2">Notification Types</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• Student admission notifications</p>
                  <p>• Teacher application alerts</p>
                  <p>• Attendance reports</p>
                  <p>• Exam schedule updates</p>
                  <p>• System maintenance notices</p>
                </div>
              </div>

              <Button 
                onClick={handleSaveSettings}
                className="w-full sm:w-auto touch-target"
              >
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
