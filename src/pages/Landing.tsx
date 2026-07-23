import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  BookOpen, 
  Calendar, 
  TrendingUp, 
  Shield, 
  School,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Clock,
  Globe,
  Mail,
  Phone,
  MessageSquare
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useState } from "react";

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [salesForm, setSalesForm] = useState({
    name: "",
    email: "",
    phone: "",
    schoolName: "",
    message: ""
  });

  const handleSalesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send this to your backend
    toast({
      title: "Thank you for your interest!",
      description: "Our sales team will contact you within 24 hours.",
    });
    setSalesDialogOpen(false);
    setSalesForm({ name: "", email: "", phone: "", schoolName: "", message: "" });
  };

  const features = [
    {
      icon: Users,
      title: "Student Management",
      description: "Comprehensive student records, attendance, and performance tracking"
    },
    {
      icon: BookOpen,
      title: "Academic Management",
      description: "Manage classes, subjects, exams, and results seamlessly"
    },
    {
      icon: Calendar,
      title: "Smart Timetabling",
      description: "Automated timetable generation and conflict resolution"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Real-time insights and comprehensive reporting tools"
    },
    {
      icon: Globe,
      title: "Bangla & English",
      description: "Full bilingual support for local and international curricula"
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with role-based access control"
    }
  ];

  const benefits = [
    "Reduce administrative workload by 60%",
    "Access from anywhere, anytime",
    "Real-time parent communication",
    "Automated attendance tracking",
    "Digital exam management",
    "Cloud-based data security"
  ];

  const schoolTypes = [
    "Bangla Medium",
    "English Medium", 
    "Madrasha",
    "English Version",
    "Kindergarten"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-lg sm:rounded-xl blur-sm sm:blur-md group-hover:blur-lg transition-all duration-300" />
              <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-primary/20 group-hover:border-primary/40 transition-all duration-300 group-hover:scale-110">
                <BrandLogo className="h-6 w-6 sm:h-8 sm:w-8 drop-shadow-lg" />
              </div>
            </div>
            <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SchoolXNow</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-4" asChild>
              <Link to="/auth">Login</Link>
            </Button>
            <Button size="sm" className="text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-10" onClick={() => navigate('/school-registration')}>
              <span className="hidden sm:inline">Register Your School</span>
              <span className="sm:hidden">Register</span>
              <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container px-4 py-12 sm:py-16 lg:py-28">
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-6 sm:space-y-8 text-center lg:text-left">
              <div className="space-y-4">
                <Badge variant="secondary" className="mb-2 sm:mb-4 text-xs sm:text-sm">
                  {/* <TrendingUp className="mr-1 h-3 w-3" /> */}
                  {/* <span className="hidden sm:inline">Trusted by 1000+ Schools in Bangladesh</span>
                  <span className="sm:hidden">1000+ Schools</span> */}
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
                  Complete School Management
                  <span className="text-primary block mt-2">Made Simple</span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0">
                  Empower your institution with Bangladesh's most comprehensive cloud-based school management system. 
                  Built for schools, by educators.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                <Button size="lg" asChild className="gap-2 h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto">
                  <Link to="/auth">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                </Button>
              <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" variant="outline" className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto">
                      Schedule Demo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Talk to Our Sales Team</DialogTitle>
                      <DialogDescription>
                        Fill out the form below and our team will get back to you within 24 hours.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSalesSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sales-name">Full Name *</Label>
                        <Input
                          id="sales-name"
                          value={salesForm.name}
                          onChange={(e) => setSalesForm({...salesForm, name: e.target.value})}
                          placeholder="Your name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sales-email">Email *</Label>
                        <Input
                          id="sales-email"
                          type="email"
                          value={salesForm.email}
                          onChange={(e) => setSalesForm({...salesForm, email: e.target.value})}
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sales-phone">Phone Number *</Label>
                        <Input
                          id="sales-phone"
                          value={salesForm.phone}
                          onChange={(e) => setSalesForm({...salesForm, phone: e.target.value})}
                          placeholder="+880..."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sales-school">School Name</Label>
                        <Input
                          id="sales-school"
                          value={salesForm.schoolName}
                          onChange={(e) => setSalesForm({...salesForm, schoolName: e.target.value})}
                          placeholder="Your school name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sales-message">Message</Label>
                        <Textarea
                          id="sales-message"
                          value={salesForm.message}
                          onChange={(e) => setSalesForm({...salesForm, message: e.target.value})}
                          placeholder="Tell us about your requirements..."
                          rows={4}
                        />
                      </div>
                      <div className="flex flex-col gap-3 pt-2">
                        <Button type="submit" className="w-full">
                          Submit Request
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                          <a href="mailto:sales@schoolxnow.com" className="flex items-center gap-2 hover:text-foreground transition-colors">
                            <Mail className="h-4 w-4" />
                            <span className="hidden sm:inline">sales@schoolxnow.com</span>
                          </a>
                          <a href="tel:+8801734222467" className="flex items-center gap-2 hover:text-foreground transition-colors">
                            <Phone className="h-4 w-4" />
                            <span>+880 1734-222467</span>
                          </a>
                        </div>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                  <span>Setup in 5 minutes</span>
                </div>
              </div>
            </div>

            <div className="relative mt-8 lg:mt-0">
              <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl sm:rounded-3xl blur-2xl sm:blur-3xl opacity-30" />
              <Card className="relative shadow-elegant border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <School className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 p-3 sm:p-4 bg-primary/5 rounded-lg">
                      <p className="text-2xl sm:text-3xl font-bold text-primary">10+</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Active Schools</p>
                    </div>
                    <div className="space-y-1 p-3 sm:p-4 bg-accent/5 rounded-lg">
                      <p className="text-2xl sm:text-3xl font-bold text-accent">5K+</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Students</p>
                    </div>
                    <div className="space-y-1 p-3 sm:p-4 bg-success/5 rounded-lg">
                      <p className="text-2xl sm:text-3xl font-bold text-success">99.9%</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Uptime</p>
                    </div>
                    <div className="space-y-1 p-3 sm:p-4 bg-primary/5 rounded-lg">
                      <p className="text-2xl sm:text-3xl font-bold text-primary">24/7</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Support</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container px-4 py-12 sm:py-16 lg:py-20">
        <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
          <Badge variant="secondary" className="text-xs sm:text-sm">Features</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight px-4">
            Everything Your School Needs
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            From admissions to alumni, manage every aspect of your institution with one powerful platform
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="border-primary/10 hover:shadow-elegant transition-all duration-300 hover:border-primary/30">
              <CardHeader className="p-4 sm:p-6">
                <div className="bg-primary/10 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                  <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <CardTitle className="text-base sm:text-lg lg:text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-y bg-muted/30">
        <div className="container px-4 py-12 sm:py-16 lg:py-20">
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-4 sm:space-y-6 text-center lg:text-left order-2 lg:order-1">
              <div className="space-y-3 sm:space-y-4">
                <Badge variant="secondary" className="text-xs sm:text-sm">Why Choose Us</Badge>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Transform Your School Operations
                </h2>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                  Join hundreds of schools across Bangladesh that have modernized their management systems with SchoolXNow
                </p>
              </div>

              <div className="space-y-2 sm:space-y-3 text-left max-w-lg mx-auto lg:mx-0">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base">{benefit}</span>
                  </div>
                ))}
              </div>

              <Button size="lg" onClick={() => navigate('/auth')} className="gap-2 w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base">
                Start Your Free Trial
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>

            <Card className="shadow-elegant order-1 lg:order-2">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Supported School Types</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  We support all types of educational institutions in Bangladesh
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 p-4 sm:p-6 pt-0">
                {schoolTypes.map((type, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-primary/5 rounded-lg">
                    <School className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">{type}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-12 sm:py-16 lg:py-20">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
          <CardContent className="relative p-6 sm:p-8 lg:p-12 text-center space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                Ready to Modernize Your School?
              </h2>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
                Join thousands of schools using SchoolXNow. Get started in minutes with our easy setup process.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md mx-auto">
              <Button size="lg" onClick={() => navigate('/auth')} className="gap-2 h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto">
                <span className="hidden sm:inline">Create Your School Account</span>
                <span className="sm:hidden">Get Started</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto">
                    Talk to Sales
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Talk to Our Sales Team</DialogTitle>
                    <DialogDescription>
                      Fill out the form below and our team will get back to you within 24 hours.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSalesSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cta-sales-name">Full Name *</Label>
                      <Input
                        id="cta-sales-name"
                        value={salesForm.name}
                        onChange={(e) => setSalesForm({...salesForm, name: e.target.value})}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta-sales-email">Email *</Label>
                      <Input
                        id="cta-sales-email"
                        type="email"
                        value={salesForm.email}
                        onChange={(e) => setSalesForm({...salesForm, email: e.target.value})}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta-sales-phone">Phone Number *</Label>
                      <Input
                        id="cta-sales-phone"
                        value={salesForm.phone}
                        onChange={(e) => setSalesForm({...salesForm, phone: e.target.value})}
                        placeholder="+880..."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta-sales-school">School Name</Label>
                      <Input
                        id="cta-sales-school"
                        value={salesForm.schoolName}
                        onChange={(e) => setSalesForm({...salesForm, schoolName: e.target.value})}
                        placeholder="Your school name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta-sales-message">Message</Label>
                      <Textarea
                        id="cta-sales-message"
                        value={salesForm.message}
                        onChange={(e) => setSalesForm({...salesForm, message: e.target.value})}
                        placeholder="Tell us about your requirements..."
                        rows={4}
                      />
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                      <Button type="submit" className="w-full">
                        Submit Request
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                        <a href="mailto:sales@schoolxnow.com" className="flex items-center gap-2 hover:text-foreground transition-colors">
                          <Mail className="h-4 w-4" />
                          <span className="hidden sm:inline">sales@schoolxnow.com</span>
                        </a>
                        <a href="tel:+8801234567890" className="flex items-center gap-2 hover:text-foreground transition-colors">
                          <Phone className="h-4 w-4" />
                          <span>+880 1734-222467</span>
                        </a>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground pt-2 sm:pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>5-minute setup</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Bank-level security</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Free support</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container px-4 py-8 sm:py-12">
          <div className="grid gap-6 sm:gap-8 grid-cols-2 md:grid-cols-4">
            <div className="space-y-3 sm:space-y-4 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg blur-sm" />
                  <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 p-1.5 sm:p-2 rounded-lg border border-primary/20">
                    <BrandLogo className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow-md" />
                  </div>
                </div>
                <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SchoolXNow</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xs">
                Bangladesh's leading school management system. Empowering education through technology.
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-sm sm:text-base">Product</h3>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors">Features</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Pricing</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Security</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Roadmap</li>
              </ul>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-sm sm:text-base">Support</h3>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors">Documentation</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Help Center</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Contact Us</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Status</li>
              </ul>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-sm sm:text-base">Company</h3>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors">About</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Blog</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Careers</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Privacy</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t pt-6 text-center text-xs text-muted-foreground sm:mt-12 sm:flex-row sm:pt-8 sm:text-left">
            <p>&copy; {new Date().getFullYear()} SchoolXNow. All rights reserved.</p>
            <p className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              First-party SchoolXNow experience
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
