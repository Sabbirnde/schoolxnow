import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/php-api/compat-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/lib/notifications-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  User, 
  Bell, 
  Shield,
  Eye,
  Moon,
  Sun,
  Globe,
  Smartphone,
  Key,
  Mail,
  Phone
} from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  full_name_bangla: string | null;
  phone: string | null;
  avatar_url?: string | null;
  address: string | null;
  address_bangla: string | null;
  role: string;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'bn';
  notifications_email: boolean;
  notifications_sms: boolean;
  notifications_push: boolean;
  show_profile_picture: boolean;
  two_factor_enabled: boolean;
}

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'en',
  notifications_email: true,
  notifications_sms: false,
  notifications_push: true,
  show_profile_picture: true,
  two_factor_enabled: false,
};

export default function UserSettings() {
  const { profile, user } = useAuth();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationSettingsId, setNotificationSettingsId] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      if (!profile) return;

      setUserProfile(profile);
      const { id, preferences: loadedPreferences } = await loadNotificationPreferences(
        profile.user_id,
        DEFAULT_USER_PREFERENCES
      );

      if (!isMounted) return;
      setNotificationSettingsId(id);
      setPreferences(loadedPreferences as UserPreferences);
      setLoading(false);
    };

    loadSettings().catch((error) => {
      console.error('Error loading notification preferences:', error);
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!userProfile) return;

    try {
      setSaving(true);

      if (isPhpBackend) {
        const updatedProfile = await phpApi.updateProfile({
          full_name: userProfile.full_name,
          full_name_bangla: userProfile.full_name_bangla,
          phone: userProfile.phone,
          avatar_url: userProfile.avatar_url,
          address: userProfile.address,
          address_bangla: userProfile.address_bangla,
        });
        setUserProfile(updatedProfile);
      } else {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: userProfile.full_name,
            full_name_bangla: userProfile.full_name_bangla,
            phone: userProfile.phone,
            address: userProfile.address,
            address_bangla: userProfile.address_bangla,
          })
          .eq('user_id', profile?.user_id);

        if (error) throw error;
      }

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    if (isPhpBackend && !passwordData.current_password) {
      toast.error('Current password is required');
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      setSaving(true);
      if (isPhpBackend) {
        await phpApi.changePassword(passwordData.current_password, passwordData.new_password);
      } else {
        const { error } = await supabase.auth.updateUser({
          password: passwordData.new_password
        });

        if (error) throw error;
      }
      
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      toast.success('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!profile?.user_id) {
      toast.error('Unable to save preferences: user context missing.');
      return;
    }

    try {
      setSaving(true);
      await saveNotificationPreferences(profile.user_id, preferences, notificationSettingsId);
      if (!notificationSettingsId) {
        const { id } = await loadNotificationPreferences(profile.user_id, preferences);
        setNotificationSettingsId(id);
      }
      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !userProfile) return;

    if (!isPhpBackend) {
      toast.error('Photo uploads are available after switching to the PHP/MySQL backend.');
      return;
    }

    try {
      setSaving(true);
      const upload = await phpApi.uploadFile('avatars', file);
      const updatedProfile = await phpApi.updateProfile({
        full_name: userProfile.full_name,
        full_name_bangla: userProfile.full_name_bangla,
        phone: userProfile.phone,
        avatar_url: upload.url,
        address: userProfile.address,
        address_bangla: userProfile.address_bangla,
      });
      setUserProfile(updatedProfile);
      toast.success('Profile photo updated successfully');
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload profile photo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96 p-3 lg:p-6">
        <div className="animate-spin rounded-full h-16 w-16 lg:h-32 lg:w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-6 p-3 lg:p-6">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">User Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-3 lg:space-y-4">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/50 rounded-lg">
          <TabsTrigger 
            value="profile" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Profile</span>
            <span className="sm:hidden">Prof</span>
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
            value="notifications" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Bell</span>
          </TabsTrigger>
          <TabsTrigger 
            value="preferences" 
            className="text-xs sm:text-sm py-2.5 px-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Preferences</span>
            <span className="sm:hidden">Pref</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              {userProfile && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <Avatar className="h-16 w-16 lg:h-20 lg:w-20">
                      <AvatarImage src={userProfile.avatar_url || "/placeholder-avatar.jpg"} />
                      <AvatarFallback className="text-lg lg:text-xl">
                        {userProfile.full_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-base lg:text-lg font-medium">{userProfile.full_name}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground capitalize">{userProfile.role.replace('_', ' ')}</p>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleChangePhoto}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="touch-target"
                        disabled={saving}
                        onClick={() => photoInputRef.current?.click()}
                      >
                        Change Photo
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-sm font-medium">Full Name (English)</Label>
                      <Input
                        id="full_name"
                        value={userProfile.full_name}
                        onChange={(e) => setUserProfile({ ...userProfile, full_name: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name_bangla" className="text-sm font-medium">Full Name (বাংলা)</Label>
                      <Input
                        id="full_name_bangla"
                        value={userProfile.full_name_bangla || ''}
                        onChange={(e) => setUserProfile({ ...userProfile, full_name_bangla: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={userProfile.phone || ''}
                          onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                          className="pl-10 touch-target"
                          placeholder="+880 1234567890"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={user?.email || ''}
                          disabled
                          className="pl-10 touch-target bg-muted/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium">Address (English)</Label>
                      <Input
                        id="address"
                        value={userProfile.address || ''}
                        onChange={(e) => setUserProfile({ ...userProfile, address: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_bangla" className="text-sm font-medium">Address (বাংলা)</Label>
                      <Input
                        id="address_bangla"
                        value={userProfile.address_bangla || ''}
                        onChange={(e) => setUserProfile({ ...userProfile, address_bangla: e.target.value })}
                        className="touch-target"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="w-full sm:w-auto touch-target"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              )}
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
                Manage your account security and authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Change Password</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="current_password" className="text-sm font-medium">Current Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="current_password"
                        type="password"
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                        className="pl-10 touch-target"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password" className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new_password"
                        type="password"
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                        className="pl-10 touch-target"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-sm font-medium">Confirm New Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm_password"
                        type="password"
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                        className="pl-10 touch-target"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleChangePassword} 
                    disabled={saving || !passwordData.new_password}
                    className="w-full sm:w-auto touch-target"
                  >
                    {saving ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Two-Factor Authentication</Label>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Switch
                    checked={preferences.two_factor_enabled}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, two_factor_enabled: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Bell className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={preferences.notifications_email}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, notifications_email: checked })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      SMS Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">Receive notifications via SMS</p>
                  </div>
                  <Switch
                    checked={preferences.notifications_sms}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, notifications_sms: checked })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Push Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">Receive push notifications in browser</p>
                  </div>
                  <Switch
                    checked={preferences.notifications_push}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, notifications_push: checked })}
                  />
                </div>
              </div>

              <Button 
                onClick={handleSavePreferences}
                className="w-full sm:w-auto touch-target"
              >
                Save Notification Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-3 lg:space-y-4">
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Eye className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Display Preferences
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Customize your app appearance and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Theme
                    </Label>
                    <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={preferences.theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreferences({ ...preferences, theme: 'light' })}
                      className="touch-target-sm"
                    >
                      <Sun className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={preferences.theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreferences({ ...preferences, theme: 'dark' })}
                      className="touch-target-sm"
                    >
                      <Moon className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={preferences.theme === 'system' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreferences({ ...preferences, theme: 'system' })}
                      className="touch-target-sm"
                    >
                      Auto
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Language
                    </Label>
                    <p className="text-xs text-muted-foreground">Choose your preferred language</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={preferences.language === 'en' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreferences({ ...preferences, language: 'en' })}
                      className="touch-target-sm"
                    >
                      English
                    </Button>
                    <Button
                      variant={preferences.language === 'bn' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreferences({ ...preferences, language: 'bn' })}
                      className="touch-target-sm"
                    >
                      বাংলা
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Show Profile Picture</Label>
                    <p className="text-xs text-muted-foreground">Display your profile picture in the app</p>
                  </div>
                  <Switch
                    checked={preferences.show_profile_picture}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, show_profile_picture: checked })}
                  />
                </div>
              </div>

              <Button 
                onClick={handleSavePreferences}
                className="w-full sm:w-auto touch-target"
              >
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
