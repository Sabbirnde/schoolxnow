import React from 'react';
import { FEATURE_ACCESS_MATRIX, UserRole, AccessLevel } from '@/lib/access-control';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Component to visualize the feature distribution matrix
 * Useful for debugging and understanding access levels
 */

export function FeatureMatrixViewer() {
  const [selectedRole, setSelectedRole] = React.useState<UserRole>('teacher');

  const roles: UserRole[] = [
    'super_admin',
    'school_admin',
    'teacher',
    'student',
    'guardian',
  ];

  const roleLabels: Record<UserRole, string> = {
    super_admin: '🔐 Super Admin',
    school_admin: '🏫 School Admin',
    teacher: '👨‍🏫 Teacher',
    student: '👨‍🎓 Student',
    guardian: '👨‍👩‍👧 Guardian',
  };

  const roleColors: Record<AccessLevel, string> = {
    full: 'bg-green-100 text-green-800 border-green-300',
    'read-only': 'bg-blue-100 text-blue-800 border-blue-300',
    none: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  const getFeatures = (role: UserRole) => {
    const features = FEATURE_ACCESS_MATRIX[role];
    return Object.entries(features)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([feature, access]) => ({ feature, access }));
  };

  const currentFeatures = getFeatures(selectedRole);
  const fullAccessCount = currentFeatures.filter((f) => f.access === 'full').length;
  const readOnlyCount = currentFeatures.filter((f) => f.access === 'read-only').length;
  const noneCount = currentFeatures.filter((f) => f.access === 'none').length;

  // Group features by category
  const groupedFeatures = React.useMemo(() => {
    const groups: Record<string, typeof currentFeatures> = {};
    currentFeatures.forEach((item) => {
      const [category] = item.feature.split('.');
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
  }, [currentFeatures]);

  return (
    <div className="space-y-6">
      {/* Role Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Distribution Matrix - Role Selector</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedRole === role
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Access Summary for {roleLabels[selectedRole]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <div className="text-3xl font-bold text-green-600">{fullAccessCount}</div>
              <div className="text-sm text-green-700 mt-1">Full Access</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{readOnlyCount}</div>
              <div className="text-sm text-blue-700 mt-1">Read-Only</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
              <div className="text-3xl font-bold text-gray-600">{noneCount}</div>
              <div className="text-sm text-gray-700 mt-1">No Access</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Feature List */}
      <div className="space-y-4">
        {Object.entries(groupedFeatures).map(([category, features]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base capitalize">{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {features.map(({ feature, access }) => (
                  <div
                    key={feature}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="font-mono text-sm text-foreground">{feature}</span>
                    <Badge className={roleColors[access]}>{access}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Role Comparison - All Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-semibold">Feature</th>
                  {roles.map((role) => (
                    <th key={role} className="px-4 py-2 text-center font-semibold text-xs">
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentFeatures.map(({ feature }) => (
                  <tr key={feature} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-2 font-mono text-xs">{feature}</td>
                    {roles.map((role) => {
                      const access = FEATURE_ACCESS_MATRIX[role][feature];
                      return (
                        <td key={`${role}-${feature}`} className="px-4 py-2 text-center">
                          <Badge className={roleColors[access]} variant="outline">
                            {access === 'none' ? '-' : access === 'full' ? '✓✓' : '✓'}
                          </Badge>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge className={roleColors['full']}>Full</Badge>
              <span className="text-sm text-muted-foreground">
                User has full access (create, read, update, delete)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={roleColors['read-only']}>Read-Only</Badge>
              <span className="text-sm text-muted-foreground">
                User can only view/read this feature
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={roleColors['none']}>None</Badge>
              <span className="text-sm text-muted-foreground">
                User has no access to this feature
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FeatureMatrixViewer;
