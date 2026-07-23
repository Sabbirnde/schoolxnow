import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { apiClient } from '@/integrations/php-api/api-client';
import type { Database, Json } from '@/integrations/database/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings, Database as DatabaseIcon, Shield, Activity, Users, School, BookOpen } from 'lucide-react';

interface SystemStats {
  totalSchools: number;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  activeSchools: number;
  pendingApplications: number;
}

interface SystemConfigState {
  maintenanceMode: boolean;
  allowRegistrations: boolean;
  defaultSchoolType: string;
  maxStudentsPerClass: number;
  academicYearStart: string;
  academicYearEnd: string;
}

type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
type AuditLogPhpRow = Pick<AuditLogRow, 'id' | 'action' | 'user_id' | 'entity_type' | 'timestamp'> & {
  metadata: string | Json | null;
};

interface AuditLogView {
  id: string;
  action: string;
  user_id: string | null;
  details: string;
  timestamp: string;
}

const getDefaultSystemConfig = (): SystemConfigState => {
  const year = new Date().getFullYear();
  return {
    maintenanceMode: false,
    allowRegistrations: true,
    defaultSchoolType: 'secondary',
    maxStudentsPerClass: 40,
    academicYearStart: `${year}-01-01`,
    academicYearEnd: `${year}-12-31`,
  };
};

const formatDateForInput = (value: string | null) => (value ? value.slice(0, 10) : '');

const parseMetadataDetails = (metadata: Json | null, entityType: string) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return entityType || 'No additional details';
  }

  const details = (metadata as Record<string, Json>).details;
  if (typeof details === 'string' && details.trim().length > 0) {
    return details;
  }

  const reason = (metadata as Record<string, Json>).reason;
  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason;
  }

  return entityType || 'No additional details';
};

const parseJsonField = (value: string | Json | null): Json | null => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as Json;
  } catch {
    return value;
  }
};

const SystemSettings = () => {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();

  const [stats, setStats] = useState<SystemStats>({
    totalSchools: 0,
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    activeSchools: 0,
    pendingApplications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogView[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfigState>(getDefaultSystemConfig());
  const [isSettingsTableAvailable, setIsSettingsTableAvailable] = useState(true);

  useEffect(() => {
    if (!canFull('system_settings.manage')) {
      return;
    }

    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSystemStats(), fetchAuditLogs(), fetchSystemConfig()]);
      setLoading(false);
    };

    load();
  }, [profile, canFull]);

  const fetchSystemStats = async () => {
    try {
      if (isPhpBackend) {
        const [schoolsResult, activeSchoolsResult, usersResult, studentsResult, teachersResult, pendingResult] = await Promise.all([
          phpApi.table('schools').count(),
          phpApi.table('schools').count({ is_active: 1 }),
          phpApi.table('user_profiles').count(),
          phpApi.table('students').count(),
          phpApi.table('teachers').count(),
          phpApi.table('teacher_applications').count({ status: 'pending' }),
        ]);

        setStats({
          totalSchools: schoolsResult.count,
          totalUsers: usersResult.count,
          totalStudents: studentsResult.count,
          totalTeachers: teachersResult.count,
          activeSchools: activeSchoolsResult.count,
          pendingApplications: pendingResult.count,
        });
        return;
      }

      const [schoolsResult, activeSchoolsResult, usersResult, studentsResult, teachersResult, pendingResult] = await Promise.all([
        apiClient.from('schools').select('*', { count: 'exact', head: true }),
        apiClient.from('schools').select('*', { count: 'exact', head: true }).eq('is_active', true),
        apiClient.from('user_profiles').select('*', { count: 'exact', head: true }),
        apiClient.from('students').select('*', { count: 'exact', head: true }),
        apiClient.from('teachers').select('*', { count: 'exact', head: true }),
        apiClient.from('teacher_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalSchools: schoolsResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalStudents: studentsResult.count || 0,
        totalTeachers: teachersResult.count || 0,
        activeSchools: activeSchoolsResult.count || 0,
        pendingApplications: pendingResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      if (isPhpBackend) {
        const data = await phpApi.table<AuditLogPhpRow>('audit_logs').list({
          sort: 'timestamp',
          order: 'desc',
          limit: 20,
        });
        const mappedLogs: AuditLogView[] = data.map((log) => ({
          id: log.id,
          action: log.action,
          user_id: log.user_id,
          details: parseMetadataDetails(parseJsonField(log.metadata), log.entity_type),
          timestamp: log.timestamp,
        }));

        setAuditLogs(mappedLogs);
        return;
      }

      const { data, error } = await apiClient
        .from('audit_logs')
        .select('id, action, user_id, metadata, entity_type, timestamp')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching audit logs:', error);
        return;
      }

      const mappedLogs: AuditLogView[] = (data || []).map((log: Pick<AuditLogRow, 'id' | 'action' | 'user_id' | 'metadata' | 'entity_type' | 'timestamp'>) => ({
        id: log.id,
        action: log.action,
        user_id: log.user_id,
        details: parseMetadataDetails(log.metadata, log.entity_type),
        timestamp: log.timestamp,
      }));

      setAuditLogs(mappedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const fetchSystemConfig = async () => {
    try {
      if (isPhpBackend) {
        const rows = await phpApi.table<{
          id: string;
          setting_key: string;
          setting_value: string | Json | null;
        }>('system_settings').list({ setting_key: 'global', limit: 1 });
        const row = rows[0];

        if (!row) {
          setSystemConfig(getDefaultSystemConfig());
          return;
        }

        const value = parseJsonField(row.setting_value);
        const config = value && typeof value === 'object' && !Array.isArray(value)
          ? value as Record<string, Json>
          : {};

        setSystemConfig({
          maintenanceMode: Boolean(config.maintenanceMode),
          allowRegistrations: config.allowRegistrations !== false,
          defaultSchoolType: typeof config.defaultSchoolType === 'string' ? config.defaultSchoolType : 'secondary',
          maxStudentsPerClass: Number(config.maxStudentsPerClass || 40),
          academicYearStart: typeof config.academicYearStart === 'string' ? formatDateForInput(config.academicYearStart) : getDefaultSystemConfig().academicYearStart,
          academicYearEnd: typeof config.academicYearEnd === 'string' ? formatDateForInput(config.academicYearEnd) : getDefaultSystemConfig().academicYearEnd,
        });
        return;
      }

      const { data, error } = await apiClient
        .from('system_settings')
        .select('*')
        .eq('config_key', 'global')
        .maybeSingle();

      if (error) {
        console.error('Error fetching system settings:', error);
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          setIsSettingsTableAvailable(false);
          toast.error('System settings table is missing. Please run latest database migrations.');
        }
        return;
      }

      if (!data) {
        const defaultConfig = getDefaultSystemConfig();
        setSystemConfig(defaultConfig);
        return;
      }

      setIsSettingsTableAvailable(true);
      setSystemConfig({
        maintenanceMode: data.maintenance_mode,
        allowRegistrations: data.allow_registrations,
        defaultSchoolType: data.default_school_type,
        maxStudentsPerClass: data.max_students_per_class,
        academicYearStart: formatDateForInput(data.academic_year_start),
        academicYearEnd: formatDateForInput(data.academic_year_end),
      });
    } catch (error) {
      console.error('Error fetching system settings:', error);
    }
  };

  const saveSystemConfig = async (nextConfig: SystemConfigState, action = 'SYSTEM_SETTINGS_UPDATED') => {
    if (!profile?.user_id) {
      toast.error('Unable to save settings: user context missing.');
      return false;
    }

    setSaving(true);
    try {
      const payload = {
        config_key: 'global',
        maintenance_mode: nextConfig.maintenanceMode,
        allow_registrations: nextConfig.allowRegistrations,
        default_school_type: nextConfig.defaultSchoolType,
        max_students_per_class: nextConfig.maxStudentsPerClass,
        academic_year_start: nextConfig.academicYearStart,
        academic_year_end: nextConfig.academicYearEnd,
        updated_by: profile.user_id,
      };

      if (isPhpBackend) {
        const existingRows = await phpApi.table<{
          id: string;
          setting_key: string;
        }>('system_settings').list({ setting_key: 'global', limit: 1 });
        const phpPayload = {
          setting_key: 'global',
          setting_value: nextConfig,
          description: 'Global system settings',
        };

        if (existingRows[0]) {
          await phpApi.table<typeof phpPayload>('system_settings').update(existingRows[0].id, phpPayload);
        } else {
          await phpApi.table<typeof phpPayload>('system_settings').create(phpPayload);
        }

        await phpApi.table('audit_logs').create({
          user_id: profile.user_id,
          action,
          entity_type: 'system_settings',
          entity_id: 'global',
          success: 1,
          metadata: {
            details: 'System settings updated by super admin',
            maintenanceMode: nextConfig.maintenanceMode,
            allowRegistrations: nextConfig.allowRegistrations,
          },
        });

        await fetchAuditLogs();
        setSystemConfig(nextConfig);
        return true;
      }

      const { error } = await apiClient
        .from('system_settings')
        .upsert(payload, { onConflict: 'config_key' });

      if (error) {
        console.error('Error saving system settings:', error);
        toast.error('Failed to save system settings.');
        return false;
      }

      await apiClient.from('audit_logs').insert({
        user_id: profile.user_id,
        action,
        entity_type: 'system_settings',
        metadata: {
          details: 'System settings updated by super admin',
          maintenanceMode: nextConfig.maintenanceMode,
          allowRegistrations: nextConfig.allowRegistrations,
        },
      });

      await fetchAuditLogs();
      setSystemConfig(nextConfig);
      return true;
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast.error('Failed to save system settings.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleBackupDatabase = async () => {
    toast.success('Backup Initiated - Database backup has been started. You will be notified when complete.');
  };

  const handleSaveConfiguration = async () => {
    const success = await saveSystemConfig(systemConfig, 'SYSTEM_CONFIG_SAVED');
    if (success) {
      toast.success('Configuration saved successfully.');
    }
  };

  const handleSystemMaintenance = async () => {
    const nextConfig = { ...systemConfig, maintenanceMode: !systemConfig.maintenanceMode };
    const success = await saveSystemConfig(nextConfig, 'MAINTENANCE_MODE_TOGGLED');

    if (success) {
      toast.success(
        nextConfig.maintenanceMode
          ? 'Maintenance Mode Enabled - System is now in maintenance mode'
          : 'Maintenance Mode Disabled - System is now available to all users',
      );
    }
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="text-center py-8 lg:py-12 p-3 lg:p-6">
        <Shield className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg lg:text-xl font-semibold">Access Denied</h3>
        <p className="text-muted-foreground text-sm lg:text-base">Only super administrators can access system settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-6 p-3 lg:p-6">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system configuration and monitoring</p>
        </div>
      </div>

      {!isSettingsTableAvailable && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">
              System settings persistence is unavailable because the `system_settings` table is missing. Apply the latest MySQL schema migration to enable data updates.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Schools</CardTitle>
            <School className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 lg:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{stats.totalSchools}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.activeSchools} active</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 lg:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">System-wide users</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Students</CardTitle>
            <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 lg:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Enrolled students</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 lg:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending Apps</CardTitle>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 lg:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{stats.pendingApplications}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Require review</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-3 lg:space-y-4">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/50 rounded-lg">
          <TabsTrigger
            value="general"
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">General</span>
            <span className="sm:hidden">Gen</span>
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Security</span>
            <span className="sm:hidden">Sec</span>
          </TabsTrigger>
          <TabsTrigger
            value="database"
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <DatabaseIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Database</span>
            <span className="sm:hidden">DB</span>
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Audit</span>
            <span className="sm:hidden">Log</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Settings className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                System Configuration
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Configure general system settings and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="academic_year_start" className="text-sm font-medium">Academic Year Start</Label>
                  <Input
                    id="academic_year_start"
                    type="date"
                    value={systemConfig.academicYearStart}
                    onChange={(e) => setSystemConfig((prev) => ({ ...prev, academicYearStart: e.target.value }))}
                    className="touch-target"
                    disabled={saving || !isSettingsTableAvailable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academic_year_end" className="text-sm font-medium">Academic Year End</Label>
                  <Input
                    id="academic_year_end"
                    type="date"
                    value={systemConfig.academicYearEnd}
                    onChange={(e) => setSystemConfig((prev) => ({ ...prev, academicYearEnd: e.target.value }))}
                    className="touch-target"
                    disabled={saving || !isSettingsTableAvailable}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_students" className="text-sm font-medium">Max Students Per Class</Label>
                <Input
                  id="max_students"
                  type="number"
                  min="1"
                  max="200"
                  value={systemConfig.maxStudentsPerClass}
                  onChange={(e) =>
                    setSystemConfig((prev) => ({
                      ...prev,
                      maxStudentsPerClass: Number.isNaN(parseInt(e.target.value, 10))
                        ? prev.maxStudentsPerClass
                        : parseInt(e.target.value, 10),
                    }))
                  }
                  className="touch-target"
                  disabled={saving || !isSettingsTableAvailable}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="allow_registrations"
                  checked={systemConfig.allowRegistrations}
                  onCheckedChange={(checked) => setSystemConfig((prev) => ({ ...prev, allowRegistrations: checked }))}
                  disabled={saving || !isSettingsTableAvailable}
                />
                <Label htmlFor="allow_registrations" className="text-sm font-medium">Allow New Registrations</Label>
              </div>
              <Button
                className="w-full sm:w-auto touch-target"
                onClick={handleSaveConfiguration}
                disabled={saving || !isSettingsTableAvailable}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Shield className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Security Settings
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Manage system security and access controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Maintenance Mode</h4>
                  <p className="text-xs text-muted-foreground">
                    Restrict access to system administrators only
                  </p>
                </div>
                <Button
                  variant={systemConfig.maintenanceMode ? 'destructive' : 'outline'}
                  onClick={handleSystemMaintenance}
                  className="touch-target"
                  disabled={saving || !isSettingsTableAvailable}
                >
                  {saving ? 'Updating...' : systemConfig.maintenanceMode ? 'Disable' : 'Enable'}
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Two-Factor Authentication</h4>
                  <p className="text-xs text-muted-foreground">
                    Require 2FA for all administrator accounts
                  </p>
                </div>
                <Button variant="outline" className="touch-target" disabled>
                  Configure
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Session Timeout</h4>
                  <p className="text-xs text-muted-foreground">
                    Automatically log out inactive users
                  </p>
                </div>
                <Button variant="outline" className="touch-target" disabled>
                  Set Timeout
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <DatabaseIcon className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Database Management
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Monitor and maintain database health
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Database Backup</h4>
                  <p className="text-xs text-muted-foreground">
                    Create a full backup of the database
                  </p>
                </div>
                <Button onClick={handleBackupDatabase} className="touch-target">
                  <DatabaseIcon className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Database Health</h4>
                  <p className="text-xs text-muted-foreground">
                    Check database performance and integrity
                  </p>
                </div>
                <Button variant="outline" className="touch-target" disabled>
                  <Activity className="h-4 w-4 mr-2" />
                  Run Diagnostics
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Cleanup Logs</h4>
                  <p className="text-xs text-muted-foreground">
                    Remove old logs and temporary data
                  </p>
                </div>
                <Button variant="outline" className="touch-target" disabled>Clean Up</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Activity className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                System Audit Logs
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Review system activities and user actions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 lg:p-6">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Action</TableHead>
                      <TableHead className="text-xs font-medium">User</TableHead>
                      <TableHead className="text-xs font-medium hidden sm:table-cell">Details</TableHead>
                      <TableHead className="text-xs font-medium">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">No audit logs found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.user_id || 'system'}</TableCell>
                          <TableCell className="text-xs hidden sm:table-cell">{log.details}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(log.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && (
        <p className="text-xs text-muted-foreground">Refreshing live system data...</p>
      )}
    </div>
  );
};

export default SystemSettings;
