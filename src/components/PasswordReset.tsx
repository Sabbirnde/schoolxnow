import { useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, GraduationCap } from "lucide-react";
import { PasswordStrengthInput, validatePassword } from "@/components/PasswordStrengthInput";
import { supabase } from "@/integrations/php-api/compat-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";

const PasswordReset = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isValidSession =
    searchParams.get('mode') === 'reset' && (!isPhpBackend || Boolean(searchParams.get('token')));

  // Redirect if not a password reset session or if user is already logged in normally
  if (!isValidSession) {
    return <Navigate to="/auth" replace />;
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast({
        title: "Password Too Weak",
        description: `Password must have: ${passwordValidation.errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isPhpBackend) {
        const token = searchParams.get('token');
        if (!token) {
          throw new Error("Password reset link is missing its token");
        }

        await phpApi.resetPassword(token, password);
      } else {
        const { error } = await supabase.auth.updateUser({
          password: password
        });

        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Your password has been updated successfully!",
      });
      window.location.href = isPhpBackend ? "/auth" : "/";
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-light to-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary-foreground/10 p-3 rounded-full backdrop-blur-sm">
              <GraduationCap className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-2">SchoolXNow</h1>
          <p className="text-primary-foreground/80">Reset Your Password</p>
        </div>

        {/* Password Reset Card */}
        <Card className="backdrop-blur-sm bg-card/95 border-0 shadow-2xl">
          <CardHeader>
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>
              Choose a strong password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <PasswordStrengthInput
                id="new-password"
                label="New Password"
                placeholder="Enter your new password"
                value={password}
                onChange={setPassword}
                disabled={loading}
                required
              />
              
              <div className="space-y-2">
                <PasswordStrengthInput
                  id="confirm-password"
                  label="Confirm New Password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  disabled={loading}
                  required
                  showStrengthIndicator={false}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-primary-foreground/70 text-sm">
          Supporting Bangla Medium • English Medium • Madrasha
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;
