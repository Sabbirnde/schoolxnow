import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, AlertTriangle, CheckCircle, Lock, Info } from "lucide-react";
import { PasswordStrengthInput, validatePassword } from "@/components/PasswordStrengthInput";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Bootstrap = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    secretKey: "",
  });
  const [loading, setLoading] = useState(false);
  const [checkingAdmins, setCheckingAdmins] = useState(true);
  const [hasAdmins, setHasAdmins] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if super admin already exists
  useEffect(() => {
    const checkSuperAdmins = async () => {
      try {
        const { data, error } = await supabase.rpc('super_admin_exists');

        if (error) {
          console.error('Error checking super admins:', error);
          return;
        }

        setHasAdmins(data || false);
      } catch (error) {
        console.error('Error checking super admins:', error);
      } finally {
        setCheckingAdmins(false);
      }
    };

    checkSuperAdmins();
  }, []);

  // Redirect if super admin already exists
  if (checkingAdmins) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasAdmins) {
    return <Navigate to="/auth" replace />;
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate full name
    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 3) {
      errors.fullName = "Full name must be at least 3 characters";
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    // Validate password strength
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors.join(", ");
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    // Validate secret key
    if (!formData.secretKey.trim()) {
      errors.secretKey = "Bootstrap secret key is required";
    } else if (formData.secretKey.trim().length < 8) {
      errors.secretKey = "Secret key appears invalid";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFieldErrors({});

    // Validate form
    if (!validateForm()) {
      toast({
        title: "Validation Failed",
        description: "Please correct the errors before continuing",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-super-admin', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          secretKey: formData.secretKey,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create super admin');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Bootstrap Complete!",
        description: "Super administrator created. Redirecting to login...",
      });

      // Redirect after a short delay to show success message
      setTimeout(() => {
        navigate("/auth");
      }, 1500);
    } catch (error: any) {
      let errorMessage = "Failed to create super admin account";
      
      // Provide more specific error messages
      if (error.message?.includes("secret")) {
        errorMessage = "Invalid bootstrap secret key";
      } else if (error.message?.includes("email")) {
        errorMessage = "Email address is already in use";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Bootstrap Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-orange-100 p-3 rounded-full">
              <Shield className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-orange-800 mb-2">System Bootstrap</h1>
          <p className="text-orange-700">Initialize your SchoolXNow platform</p>
        </div>

        {/* Bootstrap Notice */}
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <p className="font-medium mb-1">First Time Setup Required</p>
            <p className="text-sm">No super administrator exists. This is a one-time process to initialize your SchoolXNow platform.</p>
          </AlertDescription>
        </Alert>

        {/* Security Notice */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Lock className="h-5 w-5 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <p className="font-medium mb-1">Security Requirements</p>
            <ul className="text-sm space-y-1 mt-2">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>A bootstrap secret key is required to prevent unauthorized access</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>This page will be disabled after the first administrator is created</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Use a strong password with at least 8 characters</span>
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Bootstrap Form */}
        <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Create Super Administrator</span>
            </CardTitle>
            <CardDescription>
              Set up the first admin account for your school management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bootstrap-name">Full Name</Label>
                <Input
                  id="bootstrap-name"
                  type="text"
                  placeholder="System Administrator"
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData({ ...formData, fullName: e.target.value });
                    if (fieldErrors.fullName) {
                      setFieldErrors({ ...fieldErrors, fullName: "" });
                    }
                  }}
                  disabled={loading}
                  required
                  className={fieldErrors.fullName ? "border-destructive" : ""}
                />
                {fieldErrors.fullName && (
                  <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bootstrap-email">Admin Email</Label>
                <Input
                  id="bootstrap-email"
                  type="email"
                  placeholder="admin@yourschool.edu"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (fieldErrors.email) {
                      setFieldErrors({ ...fieldErrors, email: "" });
                    }
                  }}
                  disabled={loading}
                  required
                  className={fieldErrors.email ? "border-destructive" : ""}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <PasswordStrengthInput
                  id="bootstrap-password"
                  label="Admin Password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(value) => {
                    setFormData({ ...formData, password: value });
                    if (fieldErrors.password) {
                      setFieldErrors({ ...fieldErrors, password: "" });
                    }
                  }}
                  disabled={loading}
                  required
                />
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bootstrap-confirm">Confirm Password</Label>
                <Input
                  id="bootstrap-confirm"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value });
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors({ ...fieldErrors, confirmPassword: "" });
                    }
                  }}
                  disabled={loading}
                  required
                  className={fieldErrors.confirmPassword ? "border-destructive" : ""}
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bootstrap-secret" className="flex items-center gap-2">
                  Bootstrap Secret Key
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Label>
                <Input
                  id="bootstrap-secret"
                  type="password"
                  placeholder="Enter the bootstrap secret key"
                  value={formData.secretKey}
                  onChange={(e) => {
                    setFormData({ ...formData, secretKey: e.target.value });
                    if (fieldErrors.secretKey) {
                      setFieldErrors({ ...fieldErrors, secretKey: "" });
                    }
                  }}
                  disabled={loading}
                  className={`font-mono ${fieldErrors.secretKey ? "border-destructive" : ""}`}
                  required
                />
                {fieldErrors.secretKey ? (
                  <p className="text-sm text-destructive">{fieldErrors.secretKey}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Required to authorize bootstrap. Set via SUPER_ADMIN_SECRET environment variable.
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-orange-600 hover:bg-orange-700" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Administrator...
                  </>
                ) : (
                  "Initialize System"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <Alert className="mt-6 border-slate-200 bg-slate-50">
          <Info className="h-4 w-4 text-slate-600" />
          <AlertDescription className="text-slate-700 text-sm">
            <p className="font-medium">What happens next?</p>
            <ol className="mt-2 space-y-1 text-xs">
              <li>1. Your administrator account will be created with full system access</li>
              <li>2. This bootstrap page will be permanently disabled</li>
              <li>3. You'll be redirected to the login page to access your account</li>
            </ol>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default Bootstrap;
