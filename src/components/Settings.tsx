import { useAuth } from '@/hooks/useAuth';
import SystemSettings from './SystemSettings';
import SchoolSettings from './SchoolSettings';
import UserSettings from './UserSettings';

export default function Settings() {
  const { profile } = useAuth();

  // Route to appropriate settings based on user role
  switch (profile?.role) {
    case 'super_admin':
      return <SystemSettings />;
    case 'school_admin':
      return <SchoolSettings />;
    case 'teacher':
    default:
      return <UserSettings />;
  }
}
