import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, Shield, Users, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [signupForm, setSignupForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const { toast } = useToast();

  // Redirect to home if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login form submitted', { email: loginForm.email });
    
    if (!loginForm.email || !loginForm.password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await signIn(loginForm.email, loginForm.password);
      
      if (error) {
        console.error('Login error:', error);
        toast({
          title: "Login Failed",
          description: error.message || "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      } else {
        console.log('Login successful');
        toast({
          title: "Success",
          description: "Successfully logged in!",
        });
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupForm.fullName || !signupForm.email || !signupForm.password || !signupForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(
        signupForm.email,
        signupForm.password,
        signupForm.fullName,
        "teacher"
      );

      if (error) {
        toast({
          title: "Signup Failed",
          description: error.message || "Could not create account. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account Created",
          description: "Your account was created. If email verification is enabled, please verify your email before logging in.",
        });
        setShowSignup(false);
        setSignupForm({ fullName: "", email: "", password: "", confirmPassword: "" });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password?mode=reset`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset Email Sent",
          description: "Check your email for password reset instructions.",
        });
        setShowForgotPassword(false);
        setResetEmail("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 px-2 sm:px-0">
        {/* Back to home button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.href = "/"}
          className="mb-4 sm:mb-6 h-11 px-4 text-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span>Back</span>
        </Button>
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <div className="relative group animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-primary rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 animate-pulse" />
              <div className="relative bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-primary/30 backdrop-blur-sm shadow-elegant group-hover:shadow-[0_0_40px_rgba(var(--primary),0.3)] transition-all duration-300 group-hover:scale-105">
                <img src={logo} alt="SchoolXNow Logo" className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-2xl" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              SchoolXNow
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">Welcome back</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Access your school management dashboard</p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="shadow-elegant border-primary/20 backdrop-blur-sm bg-card/95">{showForgotPassword ? (
            // Forgot Password Form
            <div>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForgotPassword(false)}
                    className="p-1 h-8"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-lg sm:text-xl">Reset Password</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Enter your email address and we'll send you a link to reset your password
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Reset Link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </CardContent>
            </div>
          ) : showSignup ? (
            // Signup Form
            <div>
              <CardHeader className="space-y-2 p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl">Create Account</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Register a new account to access your dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={signupForm.fullName}
                      onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-sm">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 text-base shadow-sm" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <div className="text-center text-sm">
                    Already have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setShowSignup(false)}
                    >
                      Sign in
                    </Button>
                  </div>
                </form>
              </CardContent>
            </div>
          ) : (
            // Login Form
            <div>
              <CardHeader className="space-y-2 p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl">Welcome Back!</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Sign in to access your school management dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      disabled={loading}
                      required
                      className="h-11 text-base"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 text-base shadow-sm" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-xs sm:text-sm text-primary hover:underline p-0 h-auto"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot your password?
                    </Button>
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setShowSignup(true)}
                    >
                      Create one
                    </Button>
                  </div>
                </form>
              </CardContent>
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center mt-4 sm:mt-6 space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>Secure Login</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">1000+ Schools</span>
              <span className="sm:hidden">1000+</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              <span>24/7 Support</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-4">
            Supporting Bangla Medium • English Medium • Madrasha
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
