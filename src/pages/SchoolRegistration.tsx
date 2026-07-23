import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import type { Database } from "@/integrations/database/types";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo.png";

const schoolRegistrationSchema = z.object({
  schoolName: z.string().min(2, "School name must be at least 2 characters"),
  schoolNameBangla: z.string().optional(),
  schoolType: z.enum(["bangla_medium", "english_medium", "madrasha"]),
  address: z.string().min(5, "Address must be at least 5 characters"),
  addressBangla: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email address"),
  eiinNumber: z.string()
    .regex(/^\d{6}$/, "EIIN number must be exactly 6 digits")
    .optional(),
  establishedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  adminFullName: z.string().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().email("Invalid email address"),
  adminPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.adminPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SchoolRegistrationForm = z.infer<typeof schoolRegistrationSchema>;
type SchoolInsert = Database["public"]["Tables"]["schools"]["Insert"];

const SchoolRegistration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<SchoolRegistrationForm>>({
    schoolType: "bangla_medium",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Test Api connection on mount
  useEffect(() => {
    const testApiConnection = async () => {
      if (isPhpBackend) {
        try {
          await phpApi.health();
          toast({
            title: 'Connection Test Successful',
            description: 'Ready to register your school.',
            variant: 'default'
          });
        } catch (error) {
          console.error('PHP API connection error:', error);
          toast({
            title: 'Connection Error',
            description: 'Unable to connect to the PHP API. Please try again later or contact support.',
            variant: 'destructive'
          });
        }
        return;
      }

      console.log('Testing Api connection...');
      
      try {
        // Test database connectivity by attempting to make a simple query
        const { count, error: configError } = await apiClient
          .from('schools')
          .select('*', { count: 'exact', head: true });

        if (configError) {
          if (configError.message?.includes('JWT')) {
            throw new Error('Invalid API configuration');
          }
          if (configError.message?.includes('FetchError')) {
            throw new Error('Unable to reach Api server');
          }
          throw configError;
        }

        // If we got here, the connection is working
        const { data: timeData, error: timeError } = await apiClient
          .from('schools')
          .select('created_at')
          .limit(1);

        if (timeError) {
          console.error('Database connection error:', timeError);
          let errorMessage = 'Could not connect to the database.';
          
          if (timeError.code === 'PGRST301') {
            errorMessage = 'Database access denied. Please check your credentials.';
          } else if (timeError.code === '23505') {
            errorMessage = 'Database constraint violation. Please try again.';
          } else if (timeError.code === '42501') {
            errorMessage = 'Insufficient database permissions.';
          } else if (timeError.message?.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your internet connection.';
          }
          
          toast({
            title: 'Database Connection Error',
            description: errorMessage + ' Please try again later or contact support.',
            variant: 'destructive'
          });
          return;
        }

        // Test auth service
        const { data: authData, error: authError } = await apiClient.auth.getSession();
        if (authError) {
          console.error('Auth service error:', authError);
          let errorMessage = 'Authentication service is unavailable.';
          
          if (authError.message?.includes('JWT')) {
            errorMessage = 'Invalid authentication token.';
          } else if (authError.message?.includes('network')) {
            errorMessage = 'Network error connecting to authentication service.';
          }
          
          toast({
            title: 'Authentication Service Error',
            description: errorMessage + ' Please refresh the page or try again later.',
            variant: 'destructive'
          });
          return;
        }

        // If user is already authenticated, redirect to dashboard
        if (authData.session) {
          console.log('User already authenticated, redirecting to dashboard');
          toast({
            title: 'Already Logged In',
            description: 'You are already logged in. Redirecting to dashboard...',
            variant: 'default'
          });
          navigate('/dashboard');
          return;
        }

        console.log('✅ Api connection test successful');
        console.log('- Database connection: OK');
        console.log('- Auth service: OK');
        console.log('- User session: Not authenticated (expected)');
        
        toast({
          title: 'Connection Test Successful',
          description: 'Ready to register your school.',
          variant: 'default'
        });

      } catch (err) {
        console.error('Unexpected error during connection test:', err);
        let errorTitle = 'Connection Error';
        let errorMessage = 'An unexpected error occurred. Please try again later.';

        if (err instanceof Error) {
          if (err.message.includes('VITE_API_URL')) {
            errorTitle = 'Configuration Error';
            errorMessage = 'PHP API URL is not properly configured. Please contact support.';
          } else if (err.message.includes('Failed to fetch')) {
            errorTitle = 'Network Error';
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
          } else if (err.message.includes('timeout')) {
            errorTitle = 'Timeout Error';
            errorMessage = 'The server is taking too long to respond. Please try again later.';
          }
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive'
        });

        // Show a help message if there are multiple errors
        if (Object.keys(err).length > 1) {
          console.log('Troubleshooting tips:');
          console.log('1. Check your internet connection');
          console.log('2. Verify PHP API configuration in .env file');
          console.log('3. Ensure the database is running');
          console.log('4. Check if the PHP API service is operational');
        }
      }
    };

    testApiConnection();
  }, [toast, navigate]);

  const handleInputChange = (field: keyof SchoolRegistrationForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission started');
    setErrors({});
    setLoading(true);
    
    try {
      console.log('Form data before validation:', formData);
      
      // Validate form data
      const validatedData = schoolRegistrationSchema.parse(formData);
      console.log("Form validation passed:", validatedData);

      if (isPhpBackend) {
        await phpApi.registerSchool({
          school: {
            name: validatedData.schoolName,
            name_bangla: validatedData.schoolNameBangla || null,
            school_type: validatedData.schoolType,
            address: validatedData.address,
            address_bangla: validatedData.addressBangla || null,
            phone: validatedData.phone,
            email: validatedData.email,
            eiin_number: validatedData.eiinNumber || null,
            established_year: validatedData.establishedYear || null,
          },
          admin: {
            full_name: validatedData.adminFullName,
            email: validatedData.adminEmail,
            phone: validatedData.adminPhone,
            password: validatedData.adminPassword,
          },
        });

        toast({
          title: "Registration Successful!",
          description: "Your school and admin account were created. Please sign in while your registration is reviewed.",
        });

        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      // Step 1: Create the school with error handling
      const newSchool: SchoolInsert = {
        name: validatedData.schoolName,
        name_bangla: validatedData.schoolNameBangla || null,
        school_type: validatedData.schoolType,
        address: validatedData.address,
        address_bangla: validatedData.addressBangla || null,
        phone: validatedData.phone,
        email: validatedData.email,
        eiin_number: validatedData.eiinNumber || null,
        established_year: validatedData.establishedYear || null,
        is_active: true,
      };

      const { data: schoolData, error: schoolError } = await apiClient
        .from("schools")
        .insert(newSchool)
        .select()
        .single();

      if (schoolError || !schoolData) {
        console.error('School creation error:', schoolError);
        
        // Check for EIIN number uniqueness violation
        if (schoolError?.message?.includes('schools_eiin_number_key')) {
          toast({
            title: "Registration Failed",
            description: "This EIIN number is already registered. Please verify the number or contact support if you believe this is an error.",
            variant: "destructive",
          });
          setErrors(prev => ({
            ...prev,
            eiinNumber: "This EIIN number is already registered"
          }));
        } else {
          toast({
            title: "Registration Failed",
            description: schoolError?.message || "Failed to create school. Please try again.",
            variant: "destructive",
          });
          console.error('Detailed error:', schoolError);
        }
        setLoading(false);
        return;
      }

      console.log('School created successfully:', schoolData);

      // Step 2: Sign up the admin user with school_id in metadata
      const { data: userData, error: signUpError } = await apiClient.auth.signUp({
        email: validatedData.adminEmail,
        password: validatedData.adminPassword,
        options: {
          data: {
            full_name: validatedData.adminFullName,
            role: "school_admin",
            school_id: schoolData.id,
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (signUpError) {
        console.error('User signup error:', signUpError);
        // If user signup fails, delete the school
        const deleteResult = await apiClient
          .from('schools')
          .delete()
          .eq('id', schoolData.id);
          
        if (deleteResult.error) {
          console.error('Failed to delete school after user signup failed:', deleteResult.error);
        }
        
        toast({
          title: "Registration Failed",
          description: "Failed to create admin account. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log('Admin user created successfully:', userData);

      toast({
        title: "Registration Successful!",
        description: "Please check your email to verify your account. Once verified and approved by our team, you can start using the system.",
      });

      // Redirect to auth page
      setTimeout(() => navigate("/auth"), 2000);
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof z.ZodError) {
        console.log('Validation errors:', error.errors);
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          variant: "destructive",
          title: "Validation Failed",
          description: "Please check the form for errors and try again.",
        });
      } else if (error instanceof Error) {
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: error.message || "An error occurred during registration. Please try again.",
        });
      } else {
        console.error('Unknown error:', error);
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: "An unexpected error occurred. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-3 sm:p-4 lg:p-6">
      <div className="w-full max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-4 sm:mb-6 h-11 px-4 text-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span>Back to Home</span>
        </Button>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl sm:rounded-2xl blur-md sm:blur-lg group-hover:blur-xl transition-all duration-300" />
            <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-primary/30 group-hover:border-primary/50 transition-all duration-300 shadow-elegant group-hover:scale-105">
              <img src={logo} alt="SchoolXNow Logo" className="h-12 w-12 sm:h-14 sm:w-14 object-contain drop-shadow-xl" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground text-center sm:text-left">
            Register Your School
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* School Information Card */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">School Information</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Enter your school's basic details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="schoolName" className="text-sm">School Name (English) *</Label>
                  <Input
                    id="schoolName"
                    value={formData.schoolName || ""}
                    onChange={(e) => handleInputChange("schoolName", e.target.value)}
                    placeholder="Enter school name"
                    className="h-11 text-base"
                  />
                  {errors.schoolName && <p className="text-xs sm:text-sm text-destructive">{errors.schoolName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schoolNameBangla" className="text-sm">School Name (Bangla)</Label>
                  <Input
                    id="schoolNameBangla"
                    value={formData.schoolNameBangla || ""}
                    onChange={(e) => handleInputChange("schoolNameBangla", e.target.value)}
                    placeholder="স্কুলের নাম"
                    className="h-11 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schoolType" className="text-sm">School Type *</Label>
                  <Select
                    value={formData.schoolType}
                    onValueChange={(value) => handleInputChange("schoolType", value)}
                  >
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bangla_medium">Bangla Medium</SelectItem>
                      <SelectItem value="english_medium">English Medium</SelectItem>
                      <SelectItem value="madrasha">Madrasha</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.schoolType && <p className="text-xs sm:text-sm text-destructive">{errors.schoolType}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm">Address (English) *</Label>
                  <Input
                    id="address"
                    value={formData.address || ""}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Enter school address"
                    className="h-11 text-base"
                  />
                  {errors.address && <p className="text-xs sm:text-sm text-destructive">{errors.address}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressBangla" className="text-sm">Address (Bangla)</Label>
                  <Input
                    id="addressBangla"
                    value={formData.addressBangla || ""}
                    onChange={(e) => handleInputChange("addressBangla", e.target.value)}
                    placeholder="স্কুলের ঠিকানা"
                    className="h-11 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">School Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+880..."
                    className="h-11 text-base"
                  />
                  {errors.phone && <p className="text-xs sm:text-sm text-destructive">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">School Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="school@example.com"
                    className="h-11 text-base"
                  />
                  {errors.email && <p className="text-xs sm:text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eiinNumber" className="text-sm">EIIN Number</Label>
                  <Input
                    id="eiinNumber"
                    value={formData.eiinNumber || ""}
                    onChange={(e) => handleInputChange("eiinNumber", e.target.value)}
                    placeholder="Educational Institution ID"
                    className="h-11 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="establishedYear" className="text-sm">Established Year</Label>
                  <Input
                    id="establishedYear"
                    type="number"
                    value={formData.establishedYear || ""}
                    onChange={(e) => handleInputChange("establishedYear", parseInt(e.target.value))}
                    placeholder="1990"
                    className="h-11 text-base"
                  />
                  {errors.establishedYear && <p className="text-xs sm:text-sm text-destructive">{errors.establishedYear}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Admin Information Card */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Administrator Account</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Set up your admin account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="adminFullName" className="text-sm">Full Name *</Label>
                  <Input
                    id="adminFullName"
                    value={formData.adminFullName || ""}
                    onChange={(e) => handleInputChange("adminFullName", e.target.value)}
                    placeholder="Enter your full name"
                    className="h-11 text-base"
                  />
                  {errors.adminFullName && <p className="text-xs sm:text-sm text-destructive">{errors.adminFullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail" className="text-sm">Admin Email *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminEmail || ""}
                    onChange={(e) => handleInputChange("adminEmail", e.target.value)}
                    placeholder="admin@example.com"
                    className="h-11 text-base"
                  />
                  {errors.adminEmail && <p className="text-xs sm:text-sm text-destructive">{errors.adminEmail}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPhone" className="text-sm">Phone Number *</Label>
                  <Input
                    id="adminPhone"
                    value={formData.adminPhone || ""}
                    onChange={(e) => handleInputChange("adminPhone", e.target.value)}
                    placeholder="+880..."
                    className="h-11 text-base"
                  />
                  {errors.adminPhone && <p className="text-xs sm:text-sm text-destructive">{errors.adminPhone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="text-sm">Password *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={formData.adminPassword || ""}
                    onChange={(e) => handleInputChange("adminPassword", e.target.value)}
                    placeholder="Min. 6 characters"
                    className="h-11 text-base"
                  />
                  {errors.adminPassword && <p className="text-xs sm:text-sm text-destructive">{errors.adminPassword}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword || ""}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    placeholder="Re-enter password"
                    className="h-11 text-base"
                  />
                  {errors.confirmPassword && <p className="text-xs sm:text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <div className="pt-2 sm:pt-4 space-y-3 sm:space-y-4">
                  <div className="bg-muted p-3 sm:p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">What happens next?</h4>
                    <ul className="text-xs sm:text-sm space-y-1 text-muted-foreground">
                      <li>• Your school will be registered in our system</li>
                      <li>• You'll receive a verification email</li>
                      <li>• Our team will review and approve your registration</li>
                      <li>• Once approved, you can start using all features</li>
                    </ul>
                  </div>

                  <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                    {loading ? "Registering..." : "Register School"}
                  </Button>

                  <p className="text-xs sm:text-sm text-center text-muted-foreground">
                    Already have an account?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-xs sm:text-sm"
                      onClick={() => navigate("/auth")}
                      type="button"
                    >
                      Sign in here
                    </Button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolRegistration;
