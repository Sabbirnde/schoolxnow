import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/php-api/compat-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight,
  Users,
  GraduationCap,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class_id: string | null;
  status: string;
  classes?: {
    name: string;
    section: string;
    class_level: string;
  };
}

interface Class {
  id: string;
  name: string;
  section: string;
  class_level: string;
  capacity: number;
  student_count?: number;
}

const CLASS_LEVEL_ORDER = [
  'nursery', 'kg', 'class_1', 'class_2', 'class_3', 'class_4',
  'class_5', 'class_6', 'class_7', 'class_8', 'class_9', 'class_10',
  'class_11', 'class_12'
];

export function ClassAssignment() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSourceClass, setSelectedSourceClass] = useState<string>("");
  const [selectedTargetClass, setSelectedTargetClass] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [promotionMode, setPromotionMode] = useState<'next' | 'custom'>('next');

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      setLoading(true);

      if (isPhpBackend) {
        const [studentsData, classesData] = await Promise.all([
          phpApi.table<Student>('students').list({
            school_id: profile.school_id,
            status: 'active',
            sort: 'full_name',
            order: 'asc',
            limit: 200,
          }),
          phpApi.table<Class>('classes').list({
            school_id: profile.school_id,
            is_active: 1,
            sort: 'class_level',
            order: 'asc',
            limit: 200,
          }),
        ]);

        const classesById = new Map(classesData.map((classItem) => [classItem.id, classItem]));
        const studentsWithClass = studentsData.map((student) => ({
          ...student,
          classes: student.class_id ? classesById.get(student.class_id) : undefined,
        }));
        const classesWithCounts = await Promise.all(
          classesData.map(async (classItem) => {
            const { count } = await phpApi.table('students').count({
              class_id: classItem.id,
              status: 'active',
            });

            return { ...classItem, student_count: count };
          })
        );

        setStudents(studentsWithClass);
        setClasses(classesWithCounts);
        return;
      }

      // Fetch students with their class info
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          classes (name, section, class_level)
        `)
        .eq('school_id', profile.school_id)
        .eq('status', 'active')
        .order('full_name');

      if (studentsError) throw studentsError;

      // Fetch classes with student counts
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', profile.school_id)
        .eq('is_active', true)
        .order('class_level');

      if (classesError) throw classesError;

      // Count students per class
      const classesWithCounts = await Promise.all(
        (classesData || []).map(async (classItem) => {
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', classItem.id)
            .eq('status', 'active');

          return { ...classItem, student_count: count || 0 };
        })
      );

      setStudents(studentsData || []);
      setClasses(classesWithCounts);
    } catch (error: unknown) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, toast]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchData();
    }
  }, [profile?.school_id, fetchData]);

  const getNextClassLevel = (currentLevel: string): string | null => {
    const currentIndex = CLASS_LEVEL_ORDER.indexOf(currentLevel);
    if (currentIndex === -1 || currentIndex === CLASS_LEVEL_ORDER.length - 1) {
      return null; // Already at highest level
    }
    return CLASS_LEVEL_ORDER[currentIndex + 1];
  };

  const handleSourceClassChange = (classId: string) => {
    setSelectedSourceClass(classId);
    setSelectedStudents(new Set());
    
    // Auto-select next class level if in promotion mode
    if (promotionMode === 'next') {
      const sourceClass = classes.find(c => c.id === classId);
      if (sourceClass) {
        const nextLevel = getNextClassLevel(sourceClass.class_level);
        if (nextLevel) {
          const nextClass = classes.find(c => c.class_level === nextLevel);
          if (nextClass) {
            setSelectedTargetClass(nextClass.id);
          }
        }
      }
    }
  };

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudents(newSet);
  };

  const toggleAllStudents = () => {
    const filteredStudents = getFilteredStudents();
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const getFilteredStudents = () => {
    return students.filter(s => s.class_id === selectedSourceClass);
  };

  const handlePromoteStudents = async () => {
    if (!selectedTargetClass || selectedStudents.size === 0) {
      toast({
        title: "Error",
        description: "Please select a target class and at least one student",
        variant: "destructive",
      });
      return;
    }

    const targetClass = classes.find(c => c.id === selectedTargetClass);
    if (!targetClass) return;

    const availableCapacity = targetClass.capacity - (targetClass.student_count || 0);
    if (selectedStudents.size > availableCapacity) {
      toast({
        title: "Capacity Error",
        description: `Target class can only accommodate ${availableCapacity} more students`,
        variant: "destructive",
      });
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  const confirmPromotion = async () => {
    setIsProcessing(true);
    setIsConfirmDialogOpen(false);

    try {
      const studentIds = Array.from(selectedStudents);

      if (isPhpBackend) {
        await Promise.all(
          studentIds.map((studentId) =>
            phpApi.table<Student>('students').update(studentId, { class_id: selectedTargetClass })
          )
        );

        toast({
          title: "Success",
          description: `Successfully assigned ${studentIds.length} student(s) to the new class`,
        });

        setSelectedStudents(new Set());
        setSelectedSourceClass("");
        setSelectedTargetClass("");
        await fetchData();
        return;
      }
      
      const { error } = await supabase
        .from('students')
        .update({ class_id: selectedTargetClass })
        .in('id', studentIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully assigned ${studentIds.length} student(s) to the new class`,
      });

      // Reset and refresh
      setSelectedStudents(new Set());
      setSelectedSourceClass("");
      setSelectedTargetClass("");
      await fetchData();
    } catch (error: unknown) {
      console.error('Error promoting students:', error);
      toast({
        title: "Error",
        description: "Failed to assign students to class",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGraduateStudents = async () => {
    if (selectedStudents.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one student",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const studentIds = Array.from(selectedStudents);

      if (isPhpBackend) {
        await Promise.all(
          studentIds.map((studentId) =>
            phpApi.table<Student>('students').update(studentId, {
              status: 'graduated',
              class_id: null,
            })
          )
        );

        toast({
          title: "Success",
          description: `Successfully graduated ${studentIds.length} student(s)`,
        });

        setSelectedStudents(new Set());
        setSelectedSourceClass("");
        await fetchData();
        return;
      }
      
      const { error } = await supabase
        .from('students')
        .update({ 
          status: 'graduated',
          class_id: null
        })
        .in('id', studentIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully graduated ${studentIds.length} student(s)`,
      });

      setSelectedStudents(new Set());
      setSelectedSourceClass("");
      await fetchData();
    } catch (error: unknown) {
      console.error('Error graduating students:', error);
      toast({
        title: "Error",
        description: "Failed to graduate students",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredStudents = getFilteredStudents();
  const sourceClass = classes.find(c => c.id === selectedSourceClass);
  const targetClass = classes.find(c => c.id === selectedTargetClass);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Class Assignment</h1>
        <p className="text-muted-foreground">Promote students to next class or assign to different classes</p>
      </div>

      {/* Promotion Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Promotion Mode</CardTitle>
          <CardDescription>Choose how you want to assign students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={promotionMode === 'next' ? 'default' : 'outline'}
              onClick={() => setPromotionMode('next')}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Auto Promotion (Next Level)
            </Button>
            <Button
              variant={promotionMode === 'custom' ? 'default' : 'outline'}
              onClick={() => setPromotionMode('custom')}
              className="flex-1"
            >
              <Users className="h-4 w-4 mr-2" />
              Custom Assignment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Class Selection */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Source Class</CardTitle>
            <CardDescription>Select the class to promote students from</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedSourceClass} onValueChange={handleSourceClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select source class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((classItem) => (
                  <SelectItem key={classItem.id} value={classItem.id}>
                    {classItem.name} - {classItem.section} ({classItem.student_count}/{classItem.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceClass && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">{sourceClass.name} - {sourceClass.section}</p>
                <p className="text-xs text-muted-foreground">
                  {sourceClass.student_count} students enrolled
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target Class</CardTitle>
            <CardDescription>Select the destination class</CardDescription>
          </CardHeader>
          <CardContent>
            <Select 
              value={selectedTargetClass} 
              onValueChange={setSelectedTargetClass}
              disabled={!selectedSourceClass || (promotionMode === 'next' && !getNextClassLevel(sourceClass?.class_level || ''))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target class" />
              </SelectTrigger>
              <SelectContent>
                {classes
                  .filter(c => c.id !== selectedSourceClass)
                  .map((classItem) => {
                    const available = classItem.capacity - (classItem.student_count || 0);
                    return (
                      <SelectItem key={classItem.id} value={classItem.id} disabled={available === 0}>
                        {classItem.name} - {classItem.section} ({available} spots available)
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {targetClass && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">{targetClass.name} - {targetClass.section}</p>
                <p className="text-xs text-muted-foreground">
                  {targetClass.capacity - (targetClass.student_count || 0)} spots available
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Students List */}
      {selectedSourceClass && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Students ({filteredStudents.length})</CardTitle>
                <CardDescription>
                  Select students to assign to the target class
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {selectedStudents.size} selected
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active students in this class</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <Button variant="outline" size="sm" onClick={toggleAllStudents}>
                    {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="rounded-md border max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.has(student.id)}
                              onCheckedChange={() => toggleStudent(student.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{student.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {selectedSourceClass && selectedStudents.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Button
                onClick={handlePromoteStudents}
                disabled={!selectedTargetClass || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Assign to Class ({selectedStudents.size} students)
              </Button>
              
              {sourceClass?.class_level === 'class_12' && (
                <Button
                  onClick={handleGraduateStudents}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Mark as Graduated
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Class Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to assign {selectedStudents.size} student(s) from{' '}
              <strong>{sourceClass?.name} - {sourceClass?.section}</strong> to{' '}
              <strong>{targetClass?.name} - {targetClass?.section}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPromotion}>
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
