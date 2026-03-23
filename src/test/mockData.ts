// Test data fixtures for SuperAdminDashboard tests

export const mockSchools = [
  {
    id: '1',
    name: 'Central High School',
    name_bangla: 'কেন্দ্রীয় মাধ্যমিক বিদ্যালয়',
    school_type: 'bangla_medium' as const,
    address: 'Dhaka, Bangladesh',
    address_bangla: 'ঢাকা, বাংলাদেশ',
    phone: '0171234567',
    email: 'central@school.com',
    eiin_number: '121001',
    established_year: 1995,
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
  },
  {
    id: '2',
    name: 'English Academy',
    name_bangla: 'ইংরেজি একাডেমি',
    school_type: 'english_medium' as const,
    address: 'Gulshan, Dhaka',
    address_bangla: 'গুলশান, ঢাকা',
    phone: '0172345678',
    email: 'academy@school.com',
    eiin_number: '121002',
    established_year: 2000,
    is_active: true,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
  },
  {
    id: '3',
    name: 'Islamic Institute',
    name_bangla: 'ইসলামিক ইনস্টিটিউট',
    school_type: 'madrasha' as const,
    address: 'Mirpur, Dhaka',
    address_bangla: 'মিরপুর, ঢাকা',
    phone: '0173456789',
    email: 'institute@school.com',
    eiin_number: '121003',
    established_year: 1988,
    is_active: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (this month)
  },
];

export const mockStats = {
  totalSchools: 3,
  activeSchools: 3,
  totalSchoolAdmins: 12,
  totalStudents: 1545,
  totalTeachers: 89,
  totalClasses: 32,
  totalSubjects: 145,
  pendingApplications: 5,
  schoolsThisMonth: 1,
  studentsThisMonth: 230,
  teachersThisMonth: 8,
  monthlyGrowth: 50, // 50% growth from last month
};

export const mockSchoolTypeStats = {
  bangla_medium: 1,
  english_medium: 1,
  madrasha: 1,
};

export const mockAuditLogs = [
  {
    id: '1',
    action: 'SCHOOL_CREATED',
    entity_type: 'schools',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    success: true,
    user_id: 'test-admin-id',
  },
  {
    id: '2',
    action: 'SCHOOL_UPDATED',
    entity_type: 'schools',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    success: true,
    user_id: 'test-admin-id',
  },
  {
    id: '3',
    action: 'USER_CREATED',
    entity_type: 'users',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    success: true,
    user_id: 'test-admin-id',
  },
  {
    id: '4',
    action: 'SCHOOL_DELETED',
    entity_type: 'schools',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    success: true,
    user_id: 'test-admin-id',
  },
];

// Statistics calculation helpers for testing
export const calculateMonthlyGrowth = (currentMonth: number, previousMonth: number): number => {
  if (previousMonth === 0) {
    return currentMonth > 0 ? 100 : 0;
  }
  return Math.round(((currentMonth - previousMonth) / previousMonth) * 100);
};

export const getSchoolTypeLabel = (type: string): string => {
  switch (type) {
    case 'bangla_medium':
      return 'Bangla Medium';
    case 'english_medium':
      return 'English Medium';
    case 'madrasha':
      return 'Madrasha';
    default:
      return type;
  }
};

export const getSchoolTypeBadgeColor = (type: string): string => {
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
