import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/php-api/compat-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, GraduationCap } from "lucide-react";

const formSchema = z.object({
  school_id: z.string().min(1, "Please select a school"),
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  full_name_bangla: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  address_bangla: z.string().optional(),
  qualification: z.string().min(2, "Qualification is required"),
  subject_specialization: z.string().min(2, "Subject specialization is required"),
  experience_years: z.coerce.number().min(0, "Experience years must be 0 or more"),
});

interface School {
  id: string;
  name: string;
  name_bangla: string | null;
  school_type: string;
}

interface TeacherRegistrationFormProps {
  onSuccess: () => void;
}

export function TeacherRegistrationForm({ onSuccess }: TeacherRegistrationFormProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      school_id: "",
      full_name: "",
      full_name_bangla: "",
      phone: "",
      address: "",
      address_bangla: "",
      qualification: "",
      subject_specialization: "",
      experience_years: 0,
    },
  });

  const fetchSchools = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const data = await phpApi.listPublicSchools();
        setSchools(data || []);
        return;
      }

      const { data, error } = await supabase
        .from('schools_public_view')
        .select('id, name, name_bangla, school_type')
        .order('name');

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast({
        title: "Error",
        description: "Failed to load schools. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSchools(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const getSchoolTypeLabel = (type: string) => {
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (isPhpBackend) {
        await phpApi.submitTeacherApplication({
          school_id: values.school_id,
          full_name: values.full_name,
          full_name_bangla: values.full_name_bangla || null,
          phone: values.phone,
          address: values.address || null,
          address_bangla: values.address_bangla || null,
          qualification: values.qualification || null,
          subject_specialization: values.subject_specialization || null,
          experience_years: values.experience_years,
        });

        toast({
          title: "Application Submitted!",
          description: "Your teacher application has been submitted successfully. The school administrator will review your application.",
        });

        onSuccess();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('teacher_applications')
        .insert({
          user_id: user.id,
          school_id: values.school_id,
          full_name: values.full_name,
          full_name_bangla: values.full_name_bangla || null,
          phone: values.phone,
          address: values.address || null,
          address_bangla: values.address_bangla || null,
          qualification: values.qualification || null,
          subject_specialization: values.subject_specialization || null,
          experience_years: values.experience_years,
        });

      if (error) throw error;

      toast({
        title: "Application Submitted!",
        description: "Your teacher application has been submitted successfully. The school administrator will review your application.",
      });

      onSuccess();
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive", 
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingSchools) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading schools...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Teacher Application Form
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="school_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select School</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a school to apply to" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          <div className="flex flex-col">
                            <span>{school.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {school.name_bangla && `${school.name_bangla} • `}
                              {getSchoolTypeLabel(school.school_type)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name (English)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name_bangla"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name (Bangla)</FormLabel>
                    <FormControl>
                      <Input placeholder="আপনার পূর্ণ নাম" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+880-xxx-xxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="experience_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Years of Experience</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="qualification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qualification</FormLabel>
                    <FormControl>
                      <Input placeholder="B.A., M.A., B.Ed., etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject_specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Specialization</FormLabel>
                    <FormControl>
                      <Input placeholder="Math, English, Science, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (English)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter your address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_bangla"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Bangla)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="আপনার ঠিকানা" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                "Submit Teacher Application"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
