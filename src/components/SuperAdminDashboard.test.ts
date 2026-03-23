import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateMonthlyGrowth, getSchoolTypeLabel, getSchoolTypeBadgeColor, mockSchools, mockStats } from '../test/mockData';

describe('SuperAdminDashboard - Statistics Calculations', () => {
  describe('Monthly Growth Calculation', () => {
    it('should calculate correct growth percentage', () => {
      const growth = calculateMonthlyGrowth(10, 5);
      expect(growth).toBe(100); // (10-5)/5 * 100 = 100%
    });

    it('should handle zero previous month with positive current', () => {
      const growth = calculateMonthlyGrowth(5, 0);
      expect(growth).toBe(100);
    });

    it('should handle zero previous month with zero current', () => {
      const growth = calculateMonthlyGrowth(0, 0);
      expect(growth).toBe(0);
    });

    it('should handle negative growth', () => {
      const growth = calculateMonthlyGrowth(3, 10);
      expect(growth).toBeCloseTo(-70); // (3-10)/10 * 100 = -70%
    });

    it('should round to nearest integer', () => {
      const growth = calculateMonthlyGrowth(7, 3);
      expect(growth).toBe(133); // (7-3)/3 * 100 = 133.33... → 133
    });
  });

  describe('School Type Statistics', () => {
    it('should correctly count school types', () => {
      const typeCounts = {
        bangla_medium: mockSchools.filter(s => s.school_type === 'bangla_medium').length,
        english_medium: mockSchools.filter(s => s.school_type === 'english_medium').length,
        madrasha: mockSchools.filter(s => s.school_type === 'madrasha').length,
      };

      expect(typeCounts.bangla_medium).toBe(1);
      expect(typeCounts.english_medium).toBe(1);
      expect(typeCounts.madrasha).toBe(1);
    });

    it('should calculate total schools from type counts', () => {
      const total = Object.values(mockSchools.reduce((acc: any, school) => {
        acc[school.school_type] = (acc[school.school_type] || 0) + 1;
        return acc;
      }, {})).reduce((a: number, b: number) => a + b, 0);

      expect(total).toBe(mockSchools.length);
    });
  });

  describe('School Type Labels & Colors', () => {
    it('should return correct label for bangla_medium', () => {
      expect(getSchoolTypeLabel('bangla_medium')).toBe('Bangla Medium');
    });

    it('should return correct label for english_medium', () => {
      expect(getSchoolTypeLabel('english_medium')).toBe('English Medium');
    });

    it('should return correct label for madrasha', () => {
      expect(getSchoolTypeLabel('madrasha')).toBe('Madrasha');
    });

    it('should return type as fallback for unknown types', () => {
      expect(getSchoolTypeLabel('unknown_type')).toBe('unknown_type');
    });

    it('should return correct badge color for bangla_medium', () => {
      expect(getSchoolTypeBadgeColor('bangla_medium')).toBe('bg-green-100 text-green-800');
    });

    it('should return correct badge color for english_medium', () => {
      expect(getSchoolTypeBadgeColor('english_medium')).toBe('bg-blue-100 text-blue-800');
    });

    it('should return correct badge color for madrasha', () => {
      expect(getSchoolTypeBadgeColor('madrasha')).toBe('bg-purple-100 text-purple-800');
    });

    it('should return gray color for unknown types', () => {
      expect(getSchoolTypeBadgeColor('unknown')).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('Statistics State Structure', () => {
    it('should have all required stat fields', () => {
      const requiredFields = [
        'totalSchools',
        'activeSchools',
        'totalSchoolAdmins',
        'totalStudents',
        'totalTeachers',
        'totalClasses',
        'totalSubjects',
        'pendingApplications',
        'schoolsThisMonth',
        'studentsThisMonth',
        'teachersThisMonth',
        'monthlyGrowth',
      ];

      requiredFields.forEach(field => {
        expect(mockStats).toHaveProperty(field);
      });
    });

    it('should have all stat fields as numbers', () => {
      Object.values(mockStats).forEach(value => {
        expect(typeof value).toBe('number');
      });
    });

    it('should validate stat value ranges', () => {
      expect(mockStats.totalSchools).toBeGreaterThanOrEqual(0);
      expect(mockStats.activeSchools).toBeLessThanOrEqual(mockStats.totalSchools);
      expect(mockStats.totalStudents).toBeGreaterThanOrEqual(0);
      expect(mockStats.pendingApplications).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Schools This Month Calculation', () => {
    it('should identify schools created in current month', () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const ThisMonthSchools = mockSchools.filter(school => {
        return new Date(school.created_at) >= currentMonthStart;
      });

      expect(ThisMonthSchools.length).toBe(1); // Only Islamic Institute (5 days ago)
    });

    it('should calculate monthly growth based on schools', () => {
      const currentMonthCount = 1;
      const previousMonthCount = 2;
      const growth = calculateMonthlyGrowth(currentMonthCount, previousMonthCount);

      expect(growth).toBeCloseTo(-50); // Negative growth
    });
  });
});
