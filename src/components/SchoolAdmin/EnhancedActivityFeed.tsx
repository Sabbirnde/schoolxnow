import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar,
  UserPlus,
  MoreVertical,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Clock,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  success: boolean;
  error_message?: string | null;
  user_id: string;
  metadata?: any;
}

interface ActivityFeed {
  entries: AuditLogEntry[];
  filtered: AuditLogEntry[];
  selectedFilter: string | null;
}

const ActionIcons: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  'CREATE': { icon: <UserPlus className="h-4 w-4" />, color: 'bg-green-500/10 text-green-700 dark:text-green-400', label: 'Created' },
  'UPDATE': { icon: <Edit className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', label: 'Updated' },
  'DELETE': { icon: <Trash2 className="h-4 w-4" />, color: 'bg-red-500/10 text-red-700 dark:text-red-400', label: 'Deleted' },
  'STATUS_CHANGE': { icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', label: 'Status Changed' },
  'APPROVE': { icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500/10 text-green-700 dark:text-green-400', label: 'Approved' },
  'REJECT': { icon: <XCircle className="h-4 w-4" />, color: 'bg-red-500/10 text-red-700 dark:text-red-400', label: 'Rejected' },
};

const EntityBadgeColors: Record<string, string> = {
  'students': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'teachers': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'classes': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'exams': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'attendance': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'exam_marks': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  'timetable': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  'subjects': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

const getTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const secondsAgo = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (secondsAgo < 60) return 'Just now';
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;
  
  return past.toLocaleDateString();
};

const groupByDate = (entries: AuditLogEntry[]): Record<string, AuditLogEntry[]> => {
  const groups: Record<string, AuditLogEntry[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Older': [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  entries.forEach(entry => {
    const entryDate = new Date(entry.timestamp);
    const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

    if (entryDateOnly.getTime() === today.getTime()) {
      groups['Today'].push(entry);
    } else if (entryDateOnly.getTime() === yesterday.getTime()) {
      groups['Yesterday'].push(entry);
    } else if (entryDateOnly.getTime() > weekAgo.getTime()) {
      groups['This Week'].push(entry);
    } else {
      groups['Older'].push(entry);
    }
  });

  return groups;
};

export function EnhancedActivityFeed() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [activityFeed, setActivityFeed] = useState<ActivityFeed>({
    entries: [],
    filtered: [],
    selectedFilter: null,
  });
  const [loading, setLoading] = useState(true);
  const [filterOptions] = useState([
    { value: null, label: 'All' },
    { value: 'students', label: 'Students' },
    { value: 'teachers', label: 'Teachers' },
    { value: 'classes', label: 'Classes' },
    { value: 'exams', label: 'Exams' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'exam_marks', label: 'Marks' },
  ]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchActivityFeed();
    }
  }, [profile?.school_id]);

  const fetchActivityFeed = async () => {
    if (!profile?.school_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch audit logs for school
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          entity_type,
          entity_id,
          timestamp,
          success,
          error_message,
          user_id,
          metadata
        `)
        .in('entity_type', ['students', 'teachers', 'classes', 'exams', 'attendance', 'exam_marks', 'timetable', 'subjects'])
        .order('timestamp', { ascending: false })
        .limit(15);

      if (error) throw error;

      setActivityFeed({
        entries: data || [],
        filtered: data || [],
        selectedFilter: null,
      });
    } catch (error: any) {
      console.error('Error fetching activity feed:', error);
      toast({
        title: 'Error',
        description: 'Failed to load activity feed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (filterValue: string | null) => {
    setActivityFeed(prev => ({
      ...prev,
      selectedFilter: filterValue,
      filtered: filterValue 
        ? prev.entries.filter(e => e.entity_type === filterValue)
        : prev.entries,
    }));
  };

  const groupedActivities = groupByDate(activityFeed.filtered);
  const hasActivities = activityFeed.filtered.length > 0;

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            Recent Activity
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 pb-4 border-b border-border overflow-x-auto">
          {filterOptions.map(option => (
            <Button
              key={option.value || 'all'}
              onClick={() => handleFilter(option.value as string | null)}
              variant={activityFeed.selectedFilter === (option.value as string | null) ? 'default' : 'outline'}
              size="sm"
              className={`whitespace-nowrap ${
                activityFeed.selectedFilter === (option.value as string | null)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50'
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !hasActivities ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="p-4 bg-muted/30 rounded-full w-fit mx-auto mb-4">
              <Calendar className="h-12 w-12 opacity-50" />
            </div>
            <p className="text-lg font-medium mb-1">No Activity Yet</p>
            <p className="text-sm">
              {activityFeed.selectedFilter 
                ? 'No activity for this category'
                : 'Activity log will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([dateGroup, entries]) => 
              entries.length > 0 && (
                <div key={dateGroup}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pl-4">
                    {dateGroup}
                  </h3>
                  <div className="space-y-2">
                    {entries.map((entry) => {
                      const actionInfo = ActionIcons[entry.action] || {
                        icon: <Clock className="h-4 w-4" />,
                        color: 'bg-gray-500/10 text-gray-700',
                        label: entry.action,
                      };
                      const entityBadgeColor = EntityBadgeColors[entry.entity_type] || 'bg-gray-100 text-gray-800';
                      
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                            !entry.success
                              ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/50'
                              : 'bg-muted/30 border-border/50 hover:border-primary/30'
                          }`}
                        >
                          {/* Action Icon */}
                          <div className={`p-2 rounded-full flex-shrink-0 ${actionInfo.color}`}>
                            {actionInfo.icon}
                          </div>

                          {/* Activity Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mr-2 ${entityBadgeColor}`}>
                                    {entry.entity_type.charAt(0).toUpperCase() + entry.entity_type.slice(1)}
                                  </span>
                                  {`${actionInfo.label} item`}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {actionInfo.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground">
                                    {getTimeAgo(entry.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Error Message if Failed */}
                            {!entry.success && entry.error_message && (
                              <div className="flex items-start gap-2 mt-2 p-2 bg-red-100/50 dark:bg-red-950/30 rounded border border-red-200/50 dark:border-red-800/50">
                                <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700 dark:text-red-300">{entry.error_message}</p>
                              </div>
                            )}
                          </div>

                          {/* Status Badge */}
                          <div className="flex-shrink-0">
                            <Badge 
                              variant="outline"
                              className={`text-xs ${
                                entry.success
                                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400'
                                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400'
                              }`}
                            >
                              {entry.success ? '✓ Success' : '✗ Failed'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
