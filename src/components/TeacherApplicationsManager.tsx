import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle, Eye, Calendar, Phone, MapPin, GraduationCap, BookOpen } from "lucide-react";
import { format } from "date-fns";

interface TeacherApplication {
  id: string;
  user_id: string | null;
  school_id?: string | null;
  full_name: string;
  full_name_bangla: string | null;
  phone: string;
  address: string | null;
  address_bangla: string | null;
  qualification: string | null;
  subject_specialization: string | null;
  experience_years: number;
  status: string;
  application_date: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

interface TeacherProfile {
  id: string;
  user_id: string;
  approval_status: string | null;
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian';
}

export function TeacherApplicationsManager() {
  const [applications, setApplications] = useState<TeacherApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<TeacherApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchApplications = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const data = await phpApi.table<TeacherApplication>('teacher_applications').list({
          sort: 'application_date',
          order: 'desc',
          limit: 500,
        });
        setApplications(data || []);
        return;
      }

      const { data, error } = await apiClient
        .from('teacher_applications')
        .select('*')
        .order('application_date', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to load teacher applications.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApproveApplication = async (applicationId: string, userId: string | null) => {
    setProcessingId(applicationId);
    try {
      if (isPhpBackend) {
        await phpApi.table<TeacherApplication>('teacher_applications').update(applicationId, {
          status: 'approved',
          reviewed_by: profile?.user_id || null,
          reviewed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });

        if (userId) {
          const profiles = await phpApi.table<TeacherProfile>('user_profiles').list({
            user_id: userId,
            limit: 1,
          });
          const teacherProfile = profiles[0];

          if (teacherProfile) {
            await phpApi.table<TeacherProfile>('user_profiles').update(teacherProfile.id, {
              approval_status: 'approved',
              role: 'teacher',
            });
          }
        }

        toast({
          title: "Application Approved",
          description: "The teacher application has been approved successfully.",
        });

        fetchApplications();
        return;
      }

      const { data: { user } } = await apiClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update application status
      const { error: appError } = await apiClient
        .from('teacher_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (appError) throw appError;

      // Update user profile status and role
      const { error: profileError } = await apiClient
        .from('user_profiles')
        .update({
          approval_status: 'approved',
          role: 'teacher',
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      toast({
        title: "Application Approved",
        description: "The teacher application has been approved successfully.",
      });

      fetchApplications();
    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: "Error",
        description: "Failed to approve application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectApplication = async (applicationId: string, userId: string | null) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(applicationId);
    try {
      if (isPhpBackend) {
        await phpApi.table<TeacherApplication>('teacher_applications').update(applicationId, {
          status: 'rejected',
          reviewed_by: profile?.user_id || null,
          reviewed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          rejection_reason: rejectionReason,
        });

        if (userId) {
          const profiles = await phpApi.table<TeacherProfile>('user_profiles').list({
            user_id: userId,
            limit: 1,
          });
          const teacherProfile = profiles[0];

          if (teacherProfile) {
            await phpApi.table<TeacherProfile>('user_profiles').update(teacherProfile.id, {
              approval_status: 'rejected',
            });
          }
        }

        toast({
          title: "Application Rejected",
          description: "The teacher application has been rejected.",
        });

        setRejectionReason("");
        setSelectedApp(null);
        fetchApplications();
        return;
      }

      const { data: { user } } = await apiClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update application status
      const { error: appError } = await apiClient
        .from('teacher_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', applicationId);

      if (appError) throw appError;

      // Update user profile status
      const { error: profileError } = await apiClient
        .from('user_profiles')
        .update({
          approval_status: 'rejected',
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      toast({
        title: "Application Rejected",
        description: "The teacher application has been rejected.",
      });

      setRejectionReason("");
      setSelectedApp(null);
      fetchApplications();
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        title: "Error",
        description: "Failed to reject application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6">Loading applications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Teacher Applications</h2>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No teacher applications found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{app.full_name}</CardTitle>
                    {app.full_name_bangla && (
                      <p className="text-sm text-muted-foreground">{app.full_name_bangla}</p>
                    )}
                  </div>
                  {getStatusBadge(app.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{app.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{app.subject_specialization}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{app.qualification}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{format(new Date(app.application_date), 'MMM dd, yyyy')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedApp(app)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Teacher Application Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Full Name (English)</Label>
                            <p className="font-medium">{app.full_name}</p>
                          </div>
                          {app.full_name_bangla && (
                            <div>
                              <Label>Full Name (Bangla)</Label>
                              <p className="font-medium">{app.full_name_bangla}</p>
                            </div>
                          )}
                          <div>
                            <Label>Phone</Label>
                            <p className="font-medium">{app.phone}</p>
                          </div>
                          <div>
                            <Label>Experience</Label>
                            <p className="font-medium">{app.experience_years} years</p>
                          </div>
                          <div>
                            <Label>Qualification</Label>
                            <p className="font-medium">{app.qualification}</p>
                          </div>
                          <div>
                            <Label>Subject Specialization</Label>
                            <p className="font-medium">{app.subject_specialization}</p>
                          </div>
                        </div>
                        
                        {app.address && (
                          <div>
                            <Label>Address (English)</Label>
                            <p className="font-medium">{app.address}</p>
                          </div>
                        )}
                        
                        {app.address_bangla && (
                          <div>
                            <Label>Address (Bangla)</Label>
                            <p className="font-medium">{app.address_bangla}</p>
                          </div>
                        )}

                        {app.status === 'rejected' && app.rejection_reason && (
                          <div>
                            <Label>Rejection Reason</Label>
                            <p className="font-medium text-destructive">{app.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {app.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApproveApplication(app.id, app.user_id)}
                        disabled={processingId === app.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => setSelectedApp(app)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reject Application</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p>Are you sure you want to reject {app.full_name}'s application?</p>
                            <div>
                              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
                              <Textarea
                                id="rejection-reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Please provide a reason for rejection..."
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="destructive"
                                onClick={() => handleRejectApplication(app.id, app.user_id)}
                                disabled={processingId === app.id}
                              >
                                Confirm Rejection
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
