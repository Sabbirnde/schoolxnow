import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { supabase } from "@/integrations/php-api/compat-client";
import type { Database } from "@/integrations/database/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Clock, Users, MapPin, Plus, Edit2, Trash2, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { handleSupabaseError } from "@/lib/api-error-handler";

interface TimetableEntry {
  id: string;
  day_of_week: string;
  time_slot: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  room_number?: string;
  created_at: string;
  // Joined data
  class_name?: string;
  subject_name?: string;
  teacher_name?: string;
}

type TimetableInsert = Database["public"]["Tables"]["timetable"]["Insert"];
type TimetableUpdate = Database["public"]["Tables"]["timetable"]["Update"];
type SelectedView = 'weekly' | 'teacher' | 'class';

interface Teacher {
  id: string;
  full_name: string;
  subject_specialization?: string;
}

interface Class {
  id: string;
  name: string;
  section: string;
  class_level: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  class_level: string;
}

interface TimetablePhpRow {
  id: string;
  school_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  room: string | null;
  created_at: string;
}

interface TimetablePhpPayload {
  school_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  room: string | null;
  is_active?: number;
}

interface TeacherPhpRow extends Teacher {
  user_id?: string | null;
  is_active?: boolean | number;
}

interface ClassPhpRow extends Class {
  is_active?: boolean | number;
}

interface SubjectPhpRow extends Subject {
  is_active?: boolean | number;
}

const PHP_PAGE_SIZE = 200;

async function phpListAll<T extends object>(
  table: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  sort = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const page = await phpApi.table<T>(table).list({
      ...params,
      sort,
      order,
      limit: PHP_PAGE_SIZE,
      offset,
    });

    rows.push(...page);
    if (page.length < PHP_PAGE_SIZE) break;
    offset += PHP_PAGE_SIZE;
  }

  return rows;
}

function normalizeTime(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function parseTimeSlot(timeSlot: string) {
  const [start, end] = timeSlot.split('-');
  return {
    start_time: `${normalizeTime(start || '')}:00`,
    end_time: `${normalizeTime(end || '')}:00`,
  };
}

function formatTimeSlot(startTime: string, endTime: string) {
  return `${normalizeTime(startTime)}-${normalizeTime(endTime)}`;
}

const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const timeSlots = [
  '08:00-08:45', '08:45-09:30', '09:30-10:15', '10:15-11:00',
  '11:30-12:15', '12:15-13:00', '13:00-13:45', '13:45-14:30'
];

export function TimetableManagement() {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<SelectedView>('weekly');
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    day_of_week: '',
    time_slot: '',
    class_id: '',
    subject_id: '',
    teacher_id: '',
    room_number: ''
  });

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      setLoading(true);

      if (isPhpBackend) {
        let teacherRecord: TeacherPhpRow | null = null;
        const canManageTimetable = canFull('timetable.manage');

        if (!canManageTimetable) {
          const teacherRows = await phpListAll<TeacherPhpRow>('teachers', {
            school_id: profile.school_id,
            user_id: profile.user_id,
          });
          teacherRecord = teacherRows[0] || null;
        }

        const [timetableData, classesData, subjectsData, teachersData] = await Promise.all([
          teacherRecord || canManageTimetable
            ? phpListAll<TimetablePhpRow>('timetable', {
                school_id: profile.school_id,
                ...(teacherRecord ? { teacher_id: teacherRecord.id } : {}),
              }, 'day_of_week', 'asc')
            : Promise.resolve([]),
          phpListAll<ClassPhpRow>('classes', {
            school_id: profile.school_id,
            is_active: 1,
          }, 'name', 'asc'),
          phpListAll<SubjectPhpRow>('subjects', {
            school_id: profile.school_id,
            is_active: 1,
          }, 'name', 'asc'),
          phpListAll<TeacherPhpRow>('teachers', {
            school_id: profile.school_id,
            is_active: 1,
          }, 'full_name', 'asc'),
        ]);

        const classesMap = new Map(classesData.map(c => [c.id, c]));
        const subjectsMap = new Map(subjectsData.map(s => [s.id, s]));
        const teachersMap = new Map(teachersData.map(t => [t.id, t]));

        const formattedTimetable = timetableData
          .map((entry) => {
            const classData = classesMap.get(entry.class_id);
            const subjectData = subjectsMap.get(entry.subject_id);
            const teacherData = entry.teacher_id ? teachersMap.get(entry.teacher_id) : null;

            return {
              id: entry.id,
              day_of_week: entry.day_of_week,
              time_slot: formatTimeSlot(entry.start_time, entry.end_time),
              class_id: entry.class_id,
              subject_id: entry.subject_id,
              teacher_id: entry.teacher_id || '',
              room_number: entry.room || undefined,
              created_at: entry.created_at,
              class_name: classData ? `${classData.name} - ${classData.section}` : 'Unknown Class',
              subject_name: subjectData?.name || 'Unknown Subject',
              teacher_name: teacherData?.full_name || 'Unknown Teacher',
            };
          })
          .sort((a, b) => {
            const dayDiff = daysOfWeek.indexOf(a.day_of_week) - daysOfWeek.indexOf(b.day_of_week);
            return dayDiff || a.time_slot.localeCompare(b.time_slot);
          });

        setTimetableEntries(formattedTimetable);
        setTeachers(teachersData);
        setClasses(classesData);
        setSubjects(subjectsData);
        return;
      }

      // For teachers, get their teacher record first
      let teacherRecord = null;
      if (!canFull('timetable.manage')) {
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();

        if (teacherError && teacherError.code !== 'PGRST116') {
          throw teacherError;
        }
        teacherRecord = teacherData;
      }

      // Fetch timetable entries - filter by teacher if teacher role
      let timetableQuery = supabase
        .from('timetable')
        .select('*')
        .eq('school_id', profile.school_id);

      // Role-based filtering: Teachers only see their own schedule
      if (!canFull('timetable.manage') && teacherRecord) {
        timetableQuery = timetableQuery.eq('teacher_id', teacherRecord.id);
      }

      const { data: timetableData, error: timetableError } = await timetableQuery
        .order('day_of_week')
        .order('time_slot');

      if (timetableError) throw timetableError;

      // Fetch classes, subjects, and teachers for mapping
      const [classesResponse, subjectsResponse, teachersResponse] = await Promise.all([
        supabase.from('classes').select('id, name, section').eq('school_id', profile.school_id),
        supabase.from('subjects').select('id, name, code').eq('school_id', profile.school_id),
        supabase.from('teachers').select('id, full_name').eq('school_id', profile.school_id)
      ]);

      const classesMap = new Map(classesResponse.data?.map(c => [c.id, c]) || []);
      const subjectsMap = new Map(subjectsResponse.data?.map(s => [s.id, s]) || []);
      const teachersMap = new Map(teachersResponse.data?.map(t => [t.id, t]) || []);

      // Format the data with manual joins
      const formattedTimetable = timetableData?.map((entry) => {
        const classData = classesMap.get(entry.class_id);
        const subjectData = subjectsMap.get(entry.subject_id);
        const teacherData = teachersMap.get(entry.teacher_id);
        
        return {
          id: entry.id,
          day_of_week: entry.day_of_week,
          time_slot: entry.time_slot,
          class_id: entry.class_id,
          subject_id: entry.subject_id,
          teacher_id: entry.teacher_id,
          room_number: entry.room_number,
          created_at: entry.created_at,
          class_name: classData ? `${classData.name} - ${classData.section}` : 'Unknown Class',
          subject_name: subjectData?.name || 'Unknown Subject',
          teacher_name: teacherData?.full_name || 'Unknown Teacher'
        };
      }) || [];

      setTimetableEntries(formattedTimetable);

      // Fetch teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('id, full_name, subject_specialization')
        .eq('school_id', profile.school_id)
        .eq('is_active', true);

      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // Fetch classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, section, class_level')
        .eq('school_id', profile.school_id)
        .eq('is_active', true);

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code, class_level')
        .eq('school_id', profile.school_id)
        .eq('is_active', true);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

    } catch (error) {
      const notice = handleSupabaseError('Load timetable data', error, {
        context: { schoolId: profile?.school_id, userId: profile?.user_id },
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setLoading(false);
    }
  }, [canFull, profile?.school_id, profile?.user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const checkConflicts = (data: typeof formData) => {
    const conflicts: string[] = [];
    
    // Check teacher conflict
    const teacherConflict = timetableEntries.find(entry => 
      entry.teacher_id === data.teacher_id &&
      entry.day_of_week === data.day_of_week &&
      entry.time_slot === data.time_slot &&
      (!editingEntry || entry.id !== editingEntry.id)
    );
    
    if (teacherConflict) {
      conflicts.push(`Teacher is already scheduled for ${teacherConflict.class_name} during this time`);
    }
    
    // Check class conflict
    const classConflict = timetableEntries.find(entry => 
      entry.class_id === data.class_id &&
      entry.day_of_week === data.day_of_week &&
      entry.time_slot === data.time_slot &&
      (!editingEntry || entry.id !== editingEntry.id)
    );
    
    if (classConflict) {
      conflicts.push(`Class already has a scheduled period during this time`);
    }
    
    // Check room conflict
    if (data.room_number) {
      const roomConflict = timetableEntries.find(entry => 
        entry.room_number === data.room_number &&
        entry.day_of_week === data.day_of_week &&
        entry.time_slot === data.time_slot &&
        (!editingEntry || entry.id !== editingEntry.id)
      );
      
      if (roomConflict) {
        conflicts.push(`Room ${data.room_number} is already booked during this time`);
      }
    }
    
    setConflicts(conflicts);
    return conflicts.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.school_id) {
      toast.error('School assignment is required to save timetable entries');
      return;
    }
    
    if (!checkConflicts(formData)) {
      toast.error('Schedule conflicts detected. Please resolve them before saving.');
      return;
    }

    try {
      if (isPhpBackend) {
        const { start_time, end_time } = parseTimeSlot(formData.time_slot);
        const dataToSave: TimetablePhpPayload = {
          school_id: profile.school_id,
          day_of_week: formData.day_of_week,
          start_time,
          end_time,
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          teacher_id: formData.teacher_id,
          room: formData.room_number || null,
          is_active: 1,
        };

        if (editingEntry) {
          await phpApi.table<TimetablePhpPayload>('timetable').update(editingEntry.id, dataToSave);
          toast.success('Timetable entry updated successfully');
        } else {
          await phpApi.table<TimetablePhpPayload>('timetable').create(dataToSave);
          toast.success('Timetable entry created successfully');
        }

        setIsDialogOpen(false);
        setEditingEntry(null);
        setFormData({
          day_of_week: '',
          time_slot: '',
          class_id: '',
          subject_id: '',
          teacher_id: '',
          room_number: ''
        });
        setConflicts([]);
        fetchData();
        return;
      }

      const dataToSave: TimetableInsert = {
        ...formData,
        school_id: profile.school_id,
        room_number: formData.room_number || null
      };

      if (editingEntry) {
        const dataToUpdate: TimetableUpdate = dataToSave;
        const { error } = await supabase
          .from('timetable')
          .update(dataToUpdate)
          .eq('id', editingEntry.id);

        if (error) throw error;
        toast.success('Timetable entry updated successfully');
      } else {
        const { error } = await supabase
          .from('timetable')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Timetable entry created successfully');
      }

      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData({
        day_of_week: '',
        time_slot: '',
        class_id: '',
        subject_id: '',
        teacher_id: '',
        room_number: ''
      });
      setConflicts([]);
      fetchData();
    } catch (error) {
      const notice = handleSupabaseError('Save timetable entry', error, {
        context: {
          schoolId: profile.school_id,
          editingEntryId: editingEntry?.id,
          classId: formData.class_id,
          subjectId: formData.subject_id,
          teacherId: formData.teacher_id,
          day: formData.day_of_week,
          timeSlot: formData.time_slot,
        },
      });
      toast.error(notice.title, { description: notice.description });
    }
  };

  const handleEdit = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setFormData({
      day_of_week: entry.day_of_week,
      time_slot: entry.time_slot,
      class_id: entry.class_id,
      subject_id: entry.subject_id,
      teacher_id: entry.teacher_id,
      room_number: entry.room_number || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      if (isPhpBackend) {
        await phpApi.table<TimetablePhpPayload>('timetable').delete(id);
        toast.success('Timetable entry deleted successfully');
        fetchData();
        return;
      }

      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Timetable entry deleted successfully');
      fetchData();
    } catch (error) {
      const notice = handleSupabaseError('Delete timetable entry', error, {
        context: { entryId: id, schoolId: profile?.school_id },
      });
      toast.error(notice.title, { description: notice.description });
    }
  };

  const getFilteredEntries = () => {
    if (!selectedFilter) return timetableEntries;
    
    switch (selectedView) {
      case 'teacher':
        return timetableEntries.filter(entry => entry.teacher_id === selectedFilter);
      case 'class':
        return timetableEntries.filter(entry => entry.class_id === selectedFilter);
      default:
        return timetableEntries;
    }
  };

  const renderWeeklyView = () => {
    const filteredEntries = getFilteredEntries();
    
    return (
      <div className="w-full">
        {/* Mobile-first: Show simplified cards view on very small screens */}
        <div className="block sm:hidden space-y-2">
          {timeSlots.map(timeSlot => (
            <div key={timeSlot} className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground bg-muted/30 px-2 py-1 rounded sticky top-0 z-10">
                {timeSlot}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {daysOfWeek.slice(0, 6).map(day => {
                  const entry = filteredEntries.find(
                    e => e.day_of_week === day && e.time_slot === timeSlot
                  );
                  
                  return (
                    <div key={`${day}-${timeSlot}`} className="space-y-1">
                      <div className="text-[10px] font-medium text-center text-muted-foreground">
                        {day.slice(0, 3)}
                      </div>
                      {entry ? (
                        <Card className="shadow-sm bg-card/80 backdrop-blur-sm border-l-4 border-l-primary">
                          <CardContent className="p-2">
                            <div className="space-y-1">
                              <div className="font-medium text-xs truncate text-foreground">{entry.subject_name}</div>
                              <div className="text-[9px] text-muted-foreground truncate">{entry.class_name?.split(' - ')[0]}</div>
                              {profile?.role !== 'teacher' && (
                                <div className="flex gap-1 justify-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 touch-target-sm"
                                    onClick={() => handleEdit(entry)}
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 touch-target-sm"
                                    onClick={() => handleDelete(entry.id)}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="h-12 border border-dashed border-muted/30 rounded bg-muted/5"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Tablet and desktop: Enhanced table view */}
        <div className="hidden sm:block">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <Table className="min-w-[600px] lg:min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-16 lg:w-24 text-xs lg:text-sm font-semibold sticky left-0 bg-muted/30 z-10">
                    Time
                  </TableHead>
                  {daysOfWeek.map(day => (
                    <TableHead key={day} className="min-w-24 lg:min-w-48 text-xs lg:text-sm text-center font-semibold">
                      <span className="hidden lg:inline">{day}</span>
                      <span className="lg:hidden">{day.slice(0, 3)}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSlots.map(timeSlot => (
                  <TableRow key={timeSlot} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-medium text-xs lg:text-sm p-1.5 lg:p-2 bg-muted/20 sticky left-0 z-10 border-r">
                      <div className="text-center">
                        <span className="hidden lg:inline">{timeSlot}</span>
                        <span className="lg:hidden text-[10px] leading-tight">
                          {timeSlot.split('-')[0]}
                          <br />
                          {timeSlot.split('-')[1]}
                        </span>
                      </div>
                    </TableCell>
                    {daysOfWeek.map(day => {
                      const entry = filteredEntries.find(
                        e => e.day_of_week === day && e.time_slot === timeSlot
                      );
                      
                      return (
                        <TableCell key={`${day}-${timeSlot}`} className="p-1 lg:p-2 align-top">
                          {entry ? (
                            <Card className="w-full shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm border-l-4 border-l-primary">
                              <CardContent className="p-1.5 lg:p-3">
                                <div className="space-y-1">
                                  <div className="font-medium text-xs lg:text-sm truncate text-foreground leading-tight">
                                    {entry.subject_name}
                                  </div>
                                  <div className="text-[10px] lg:text-xs text-muted-foreground truncate">
                                    {entry.class_name}
                                  </div>
                                  <div className="text-[10px] lg:text-xs text-muted-foreground truncate hidden lg:block">
                                    {entry.teacher_name}
                                  </div>
                                  {entry.room_number && (
                                    <div className="text-[10px] lg:text-xs text-muted-foreground hidden lg:flex items-center gap-1">
                                      <MapPin className="h-2 w-2 lg:h-3 lg:w-3" />
                                      {entry.room_number}
                                    </div>
                                  )}
                                  {profile?.role !== 'teacher' && (
                                    <div className="flex gap-1 mt-1 lg:mt-2 justify-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 lg:h-6 lg:w-6 p-0 touch-target-sm hover:bg-primary/10 rounded-full"
                                        onClick={() => handleEdit(entry)}
                                      >
                                        <Edit2 className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 lg:h-6 lg:w-6 p-0 touch-target-sm hover:bg-destructive/10 rounded-full"
                                        onClick={() => handleDelete(entry.id)}
                                      >
                                        <Trash2 className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="h-12 lg:h-20 border-2 border-dashed border-muted/30 rounded-lg hover:border-muted/50 transition-colors cursor-pointer flex items-center justify-center group">
                              <Plus className="h-3 w-3 lg:h-4 lg:w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const filteredEntries = getFilteredEntries();
    
    return (
      <div className="space-y-2 lg:space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 lg:py-12">
            <Calendar className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm lg:text-base">No schedule entries found</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <Card key={entry.id} className="shadow-sm hover:shadow-md transition-all duration-200 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-3 lg:p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20">
                          {entry.day_of_week}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-secondary/10 text-secondary-foreground border-secondary/20">
                          {entry.time_slot}
                        </Badge>
                      </div>
                      
                      <div className="text-base lg:text-lg font-semibold text-foreground leading-tight">
                        {entry.subject_name}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs lg:text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 lg:h-4 lg:w-4 text-primary/60 flex-shrink-0" />
                          <span className="truncate">{entry.class_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 lg:h-4 lg:w-4 text-primary/60 flex-shrink-0" />
                          <span className="truncate">{entry.teacher_name}</span>
                        </div>
                        {entry.room_number && (
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <MapPin className="h-3 w-3 lg:h-4 lg:w-4 text-primary/60 flex-shrink-0" />
                            <span>Room {entry.room_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {profile?.role !== 'teacher' && (
                      <div className="flex gap-2 self-start sm:self-center flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(entry)}
                          className="touch-target h-8 px-3 hover:bg-primary/10 hover:text-primary border-primary/20"
                        >
                          <Edit2 className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline ml-1.5">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(entry.id)}
                          className="touch-target h-8 px-3 hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                        >
                          <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline ml-1.5">Delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96 p-3 md:p-6">
        <div className="animate-spin rounded-full h-16 w-16 md:h-32 md:w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-6 p-3 lg:p-6">
      <div className="flex flex-col gap-3 lg:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl lg:text-3xl font-bold text-foreground">
              {!canFull('timetable.manage') ? 'My Schedule' : 'Timetable Management'}
            </h1>
            {!canFull('timetable.manage') && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                Personal View
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {!canFull('timetable.manage') 
              ? 'View your teaching schedule and class assignments'
              : 'Manage class schedules and timetables with intelligent conflict detection'}
          </p>
          
          {/* Quick Stats for Teacher */}
          {!canFull('timetable.manage') && timetableEntries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Total Classes</div>
                <div className="text-lg font-bold text-primary">{timetableEntries.length}</div>
              </div>
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Unique Subjects</div>
                <div className="text-lg font-bold text-green-600">
                  {new Set(timetableEntries.map(e => e.subject_id)).size}
                </div>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Classes</div>
                <div className="text-lg font-bold text-blue-600">
                  {new Set(timetableEntries.map(e => e.class_id)).size}
                </div>
              </div>
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-2">
                <div className="text-xs text-muted-foreground">Days Active</div>
                <div className="text-lg font-bold text-orange-600">
                  {new Set(timetableEntries.map(e => e.day_of_week)).size}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Only admins can add/edit timetable */}
        {profile?.role !== 'teacher' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="w-full sm:w-auto touch-target bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                onClick={() => {
                  setEditingEntry(null);
                  setFormData({
                    day_of_week: '',
                    time_slot: '',
                    class_id: '',
                    subject_id: '',
                    teacher_id: '',
                    room_number: ''
                  });
                  setConflicts([]);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-lg mx-3 lg:mx-0 max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-lg lg:text-xl font-semibold">
                {editingEntry ? 'Edit Schedule' : 'Add New Schedule'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Create or update a timetable entry for your school.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="day_of_week" className="text-sm font-medium">Day</Label>
                  <Select
                    value={formData.day_of_week}
                    onValueChange={(value) => {
                      setFormData({ ...formData, day_of_week: value });
                      checkConflicts({ ...formData, day_of_week: value });
                    }}
                  >
                    <SelectTrigger className="touch-target h-10">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {daysOfWeek.map(day => (
                        <SelectItem key={day} value={day} className="text-sm py-2.5">{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time_slot" className="text-sm font-medium">Time Slot</Label>
                  <Select
                    value={formData.time_slot}
                    onValueChange={(value) => {
                      setFormData({ ...formData, time_slot: value });
                      checkConflicts({ ...formData, time_slot: value });
                    }}
                  >
                    <SelectTrigger className="touch-target h-10">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeSlots.map(slot => (
                        <SelectItem key={slot} value={slot} className="text-sm py-2.5">{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_id" className="text-sm font-medium">Class</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, class_id: value });
                    checkConflicts({ ...formData, class_id: value });
                  }}
                >
                  <SelectTrigger className="touch-target h-10">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id} className="text-sm py-2.5">
                        {cls.name} - {cls.section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject_id" className="text-sm font-medium">
                  Subject
                  {formData.class_id && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Filtered by class level)
                    </span>
                  )}
                </Label>
                <Select
                  value={formData.subject_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, subject_id: value });
                    // Auto-suggest teacher based on subject specialization
                    const selectedSubject = subjects.find(s => s.id === value);
                    if (selectedSubject && !formData.teacher_id) {
                      const matchingTeacher = teachers.find(t => 
                        t.subject_specialization?.toLowerCase().includes(selectedSubject.name.toLowerCase())
                      );
                      if (matchingTeacher) {
                        setFormData(prev => ({ ...prev, teacher_id: matchingTeacher.id }));
                        toast.success(`Auto-assigned ${matchingTeacher.full_name} based on specialization`);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="touch-target h-10">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {subjects
                      .filter(subject => {
                        const selectedClass = classes.find(c => c.id === formData.class_id);
                        return !selectedClass || subject.class_level === selectedClass.class_level;
                      })
                      .map(subject => {
                        const selectedClass = classes.find(c => c.id === formData.class_id);
                        return (
                          <SelectItem key={subject.id} value={subject.id} className="text-sm py-2.5">
                            <div className="flex items-center justify-between w-full">
                              <span>{subject.name} ({subject.code})</span>
                              {selectedClass && subject.class_level === selectedClass.class_level && (
                                <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                                  Match
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    {subjects.filter(subject => {
                      const selectedClass = classes.find(c => c.id === formData.class_id);
                      return !selectedClass || subject.class_level === selectedClass.class_level;
                    }).length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        No subjects available for selected class
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teacher_id" className="text-sm font-medium">
                  Teacher
                  {formData.subject_id && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Specialists highlighted)
                    </span>
                  )}
                </Label>
                <Select
                  value={formData.teacher_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, teacher_id: value });
                    checkConflicts({ ...formData, teacher_id: value });
                  }}
                >
                  <SelectTrigger className="touch-target h-10">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {teachers.map(teacher => {
                      const selectedSubject = subjects.find(s => s.id === formData.subject_id);
                      const isSpecialist = selectedSubject && teacher.subject_specialization?.toLowerCase().includes(selectedSubject.name.toLowerCase());
                      
                      // Check if teacher has conflict at this time
                      const hasConflict = formData.day_of_week && formData.time_slot && timetableEntries.find(entry => 
                        entry.teacher_id === teacher.id &&
                        entry.day_of_week === formData.day_of_week &&
                        entry.time_slot === formData.time_slot &&
                        (!editingEntry || entry.id !== editingEntry.id)
                      );
                      
                      return (
                        <SelectItem 
                          key={teacher.id} 
                          value={teacher.id} 
                          className="text-sm py-2.5"
                          disabled={!!hasConflict}
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex flex-col items-start">
                              <span className={hasConflict ? 'text-muted-foreground' : ''}>
                                {teacher.full_name}
                              </span>
                              {teacher.subject_specialization && (
                                <span className="text-xs text-muted-foreground">
                                  {teacher.subject_specialization}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {isSpecialist && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                                  Specialist
                                </Badge>
                              )}
                              {hasConflict && (
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                                  Busy
                                </Badge>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_number" className="text-sm font-medium">Room Number (Optional)</Label>
                <Input
                  id="room_number"
                  value={formData.room_number}
                  onChange={(e) => {
                    setFormData({ ...formData, room_number: e.target.value });
                    checkConflicts({ ...formData, room_number: e.target.value });
                  }}
                  placeholder="e.g., Room 101"
                  className="touch-target h-10"
                />
              </div>

              {conflicts.length > 0 && (
                <div className="p-3 border border-destructive rounded-lg bg-destructive/5 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="text-sm font-medium text-destructive">Schedule Conflicts</span>
                  </div>
                  <ul className="text-xs lg:text-sm text-destructive space-y-1 pl-6">
                    {conflicts.map((conflict, index) => (
                      <li key={index} className="list-disc">{conflict}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  type="submit" 
                  disabled={conflicts.length > 0} 
                  className="w-full sm:w-auto touch-target bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {editingEntry ? 'Update' : 'Create'} Schedule
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)} 
                  className="w-full sm:w-auto touch-target"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as SelectedView)}>
        <div className="flex flex-col gap-3 lg:gap-4">
          <TabsList className="w-full grid grid-cols-3 h-auto p-1 bg-muted/50 rounded-lg">
            <TabsTrigger 
              value="weekly" 
              className="text-xs sm:text-sm py-2.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Weekly</span>
              <span className="sm:hidden">Week</span>
            </TabsTrigger>
            <TabsTrigger 
              value="teacher" 
              className="text-xs sm:text-sm py-2.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Teacher</span>
              <span className="sm:hidden">Prof</span>
            </TabsTrigger>
            <TabsTrigger 
              value="class" 
              className="text-xs sm:text-sm py-2.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Class
            </TabsTrigger>
          </TabsList>

          {(selectedView === 'teacher' || selectedView === 'class') && (
            <div className="w-full">
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="touch-target h-11 bg-background/50 backdrop-blur-sm">
                  <SelectValue placeholder={`Select ${selectedView}`} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {selectedView === 'teacher'
                    ? teachers.map(teacher => (
                        <SelectItem key={teacher.id} value={teacher.id} className="text-sm py-2.5">
                          {teacher.full_name}
                        </SelectItem>
                      ))
                    : classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id} className="text-sm py-2.5">
                          {cls.name} - {cls.section}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="weekly" className="space-y-3 lg:space-y-4">
          <Card className="shadow-lg bg-card/80 backdrop-blur-sm border-0">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
                <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Weekly Timetable
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                View and manage the weekly class schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 lg:p-6">
              {renderWeeklyView()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teacher" className="space-y-3 lg:space-y-4">
          <Card className="shadow-lg bg-card/80 backdrop-blur-sm border-0">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Users className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Teacher Schedule
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                View schedule by teacher
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 lg:p-6">
              {selectedFilter ? renderListView() : (
                <div className="text-center py-8 lg:py-12">
                  <Users className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Select a teacher to view their schedule
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="class" className="space-y-3 lg:space-y-4">
          <Card className="shadow-lg bg-card/80 backdrop-blur-sm border-0">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                Class Schedule
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                View schedule by class
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 lg:p-6">
              {selectedFilter ? renderListView() : (
                <div className="text-center py-8 lg:py-12">
                  <Clock className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Select a class to view their schedule
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
