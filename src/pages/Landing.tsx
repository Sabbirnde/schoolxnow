import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Banknote, BookOpen, CalendarCheck, Check, ChevronRight,
  CircleDollarSign, Clock3, FileCheck2, GraduationCap, Mail, Menu,
  Phone, School, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const workflows = [
  {
    number: "01",
    icon: FileCheck2,
    title: "Admissions become records",
    description: "Review applications, accept students, and create the correct year enrollment in one transaction.",
    detail: "Applications · enrollment · guardians",
  },
  {
    number: "02",
    icon: BookOpen,
    title: "The year stays connected",
    description: "Classes, subjects, timetable, attendance, assessments, and report cards share the same academic context.",
    detail: "Years · terms · class offerings",
  },
  {
    number: "03",
    icon: CircleDollarSign,
    title: "Billing follows enrollment",
    description: "Build fee plans, issue invoices in bulk, record payments, and keep an auditable balance for each student.",
    detail: "Fees · invoices · receipts",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    description: "Core administration for a smaller school.",
    monthlyPrice: 39,
    annualPrice: 390,
    studentLimit: "Up to 300 students",
    features: ["Student and teacher records", "Classes, timetable, attendance", "Exams and standard reports", "Email support"],
    action: "Start with Starter",
  },
  {
    name: "Growth",
    description: "Connected operations for a growing school.",
    monthlyPrice: 89,
    annualPrice: 890,
    studentLimit: "Up to 1,000 students",
    features: ["Everything in Starter", "Admissions and academic years", "Guardian access and notifications", "Fees, invoices, and payments", "Assisted onboarding"],
    action: "Choose Growth",
    featured: true,
  },
  {
    name: "Professional",
    description: "More control for established institutions.",
    monthlyPrice: 179,
    annualPrice: 1790,
    studentLimit: "Up to 3,000 students",
    features: ["Everything in Growth", "Advanced reporting", "Custom branding", "Priority support", "Bulk import and API access"],
    action: "Choose Professional",
  },
  {
    name: "Enterprise",
    description: "A tailored rollout for groups and districts.",
    monthlyPrice: null,
    annualPrice: null,
    studentLimit: "3,000+ students",
    features: ["Multiple schools", "Dedicated infrastructure options", "SSO and custom integrations", "Service-level agreement", "Migration support"],
    action: "Talk to sales",
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [annualBilling, setAnnualBilling] = useState(true);
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [salesForm, setSalesForm] = useState({
    name: "", email: "", phone: "", schoolName: "", message: "",
  });

  const handleSalesSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast({ title: "Request received", description: "Our sales team will contact you within one business day." });
    setSalesDialogOpen(false);
    setSalesForm({ name: "", email: "", phone: "", schoolName: "", message: "" });
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background">
      <a href="#landing-main" className="skip-link">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 backdrop-blur-xl">
        <div className="container flex h-[4.5rem] items-center justify-between px-4">
          <Link to="/" className="group flex items-center gap-3" aria-label="SchoolXNow home">
            <span className="rounded-lg border border-primary/15 bg-primary/5 p-1.5 transition-transform duration-300 group-hover:-rotate-2">
              <BrandLogo className="h-8 w-8" />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-none tracking-tight">SchoolXNow</span>
              <span className="mt-1 hidden text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">School operations</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex" aria-label="Main navigation">
            <a href="#workflows" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#capabilities" className="transition-colors hover:text-foreground">Capabilities</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
            <Button onClick={() => navigate("/school-registration")}>Register a school<ArrowRight /></Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Menu />
          </Button>
        </div>
        {mobileNavOpen && (
          <nav className="border-t border-border/70 bg-background px-4 py-4 md:hidden" aria-label="Mobile navigation">
            <div className="container grid gap-1">
              {[
                ["How it works", "#workflows"], ["Capabilities", "#capabilities"], ["Pricing", "#pricing"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary" onClick={() => setMobileNavOpen(false)}>{label}</a>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <Button variant="outline" asChild><Link to="/auth">Sign in</Link></Button>
                <Button onClick={() => navigate("/school-registration")}>Register</Button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main id="landing-main">
        <section className="surface-grid relative border-b border-border/70">
          <div className="pointer-events-none absolute -right-40 top-16 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="container relative grid gap-14 px-4 pb-20 pt-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:gap-20 lg:pb-28 lg:pt-24">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 border-l-2 border-primary pl-3 text-xs font-semibold uppercase tracking-[0.17em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Admissions to payments, connected
              </div>
              <h1 className="max-w-3xl text-[clamp(3.35rem,7vw,6.75rem)] font-semibold leading-[0.88] tracking-[-0.058em]">
                Run the school year <span className="text-primary">without the gaps.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                SchoolXNow keeps academic operations, people, and billing in one reliable workspace—so every team works from the same record.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="h-12 px-6" onClick={() => navigate("/school-registration")}>
                  Register your school <ArrowRight />
                </Button>
                <button type="button" className="group inline-flex h-12 items-center justify-center gap-2 px-4 text-sm font-semibold text-foreground" onClick={() => setSalesDialogOpen(true)}>
                  Book a product walkthrough <ChevronRight className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground">
                {["No card required", "Role-based access", "Node and PHP deployment"].map((item) => (
                  <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{item}</span>
                ))}
              </div>
            </div>

            <div className="relative lg:translate-y-8">
              <div className="absolute -inset-8 rounded-[2.5rem] bg-primary/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.5rem] border border-primary/15 bg-card/95 shadow-strong">
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Friday · 24 July</p>
                    <p className="mt-1 font-semibold">Operations overview</p>
                  </div>
                  <span className="flex items-center gap-2 text-xs font-medium text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Updated now</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border/70">
                  {[
                    ["94.7%", "Attendance today", CalendarCheck],
                    ["৳86,420", "Fees collected", Banknote],
                    ["12", "Admissions to review", GraduationCap],
                    ["4", "Classes need cover", UsersRound],
                  ].map(([value, label, Icon]) => (
                    <div key={String(label)} className="bg-card p-5 sm:p-6">
                      <Icon className="mb-7 h-5 w-5 text-primary" />
                      <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-0 px-5">
                  {[
                    ["08:30", "Morning attendance completed", "Grade 6 · Section A"],
                    ["10:15", "Admission review", "4 applications ready"],
                    ["13:40", "Invoice batch issued", "128 active enrollments"],
                  ].map(([time, title, detail]) => (
                    <div key={time} className="grid grid-cols-[3.5rem_1fr] gap-3 border-b border-border/60 py-4 last:border-0">
                      <span className="font-mono text-xs text-muted-foreground">{time}</span>
                      <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 bg-primary-dark text-primary-foreground">
          <div className="container grid gap-6 px-4 py-7 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/55">Designed around real school structures</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-medium sm:grid-cols-5">
              {["Bangla medium", "English medium", "English version", "Madrasa", "Kindergarten"].map((type) => <span key={type}>{type}</span>)}
            </div>
          </div>
        </section>

        <section id="workflows" className="container scroll-mt-24 px-4 py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary">One operating model</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl">Every handoff keeps its context.</h2>
              <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                Each workflow builds on the one before it. That means fewer duplicate records, fewer reconciliation errors, and a clearer school year.
              </p>
            </div>
            <div className="divide-y divide-border/80 border-y border-border/80">
              {workflows.map(({ number, icon: Icon, title, description, detail }) => (
                <article key={number} className="group grid gap-5 py-8 sm:grid-cols-[3rem_3rem_1fr] sm:gap-5 sm:py-10">
                  <span className="font-mono text-xs text-muted-foreground">{number}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
                    <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">{description}</p>
                    <p className="mt-5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-primary">{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-24 border-y border-border/70 bg-muted/45">
          <div className="container px-4 py-20 lg:py-28">
            <div className="mb-12 grid gap-5 lg:grid-cols-2 lg:items-end">
              <div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary">Built-in control</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Serious foundations, already in place.</h2></div>
              <p className="max-w-lg leading-relaxed text-muted-foreground lg:justify-self-end">The system handles the operational details that become expensive to retrofit later.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
              {[
                [ShieldCheck, "School and role isolation", "Every table and workflow is scoped by school and role.", "lg:col-span-7"],
                [CalendarCheck, "Academic-year history", "Enrollment, attendance, reports, and billing retain their year context.", "lg:col-span-5"],
                [Banknote, "Auditable payments", "Fixed-precision money, transactional allocation, receipts, and overpayment protection.", "lg:col-span-5"],
                [Clock3, "Deployment visibility", "Health checks, request IDs, sanitized errors, and migration verification.", "lg:col-span-7"],
              ].map(([Icon, title, copy, width]) => (
                <article key={String(title)} className={`group rounded-xl border border-border/60 bg-card/80 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-medium ${width}`}>
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-12 text-2xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24">
          <div className="container px-4 py-20 lg:py-28">
            <div className="mb-12 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary">International pricing</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">A plan that grows with your school</h2>
                <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">Start with the operating capacity you need now. Move up when enrollment and support requirements change.</p>
              </div>
              <div className="inline-flex self-start rounded-lg border border-border/80 bg-muted/65 p-1" role="group" aria-label="Billing period">
                <Button type="button" size="sm" variant={annualBilling ? "ghost" : "default"} onClick={() => setAnnualBilling(false)}>Monthly</Button>
                <Button type="button" size="sm" variant={annualBilling ? "default" : "ghost"} onClick={() => setAnnualBilling(true)}>Annual <span className="text-[0.65rem] opacity-70">2 months free</span></Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pricingPlans.map((plan) => (
                <Card key={plan.name} className={`relative flex flex-col overflow-hidden ${plan.featured ? "border-primary bg-primary-dark text-primary-foreground shadow-strong" : ""}`}>
                  {plan.featured && <div className="bg-primary px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground">Most popular</div>}
                  <CardHeader className="min-h-[14.5rem]">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className={plan.featured ? "text-primary-foreground/65" : ""}>{plan.description}</CardDescription>
                    <div className="pt-6">
                      {plan.monthlyPrice === null ? <p className="text-4xl font-semibold tracking-tight">Custom</p> : (
                        <p><span className="text-4xl font-semibold tracking-tight">${annualBilling ? plan.annualPrice : plan.monthlyPrice}</span><span className={plan.featured ? "text-primary-foreground/60" : "text-muted-foreground"}>/{annualBilling ? "year" : "month"}</span></p>
                      )}
                      <p className={`mt-3 text-sm font-medium ${plan.featured ? "text-primary-foreground/75" : "text-primary"}`}>{plan.studentLimit}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-7">
                    <ul className="flex-1 space-y-3">
                      {plan.features.map((feature) => <li key={feature} className="flex gap-2.5 text-sm"><Check className={`mt-0.5 h-4 w-4 flex-none ${plan.featured ? "text-primary-foreground" : "text-primary"}`} />{feature}</li>)}
                    </ul>
                    <Button
                      variant={plan.featured ? "secondary" : "outline"}
                      className="w-full"
                      onClick={() => plan.name === "Enterprise" ? setSalesDialogOpen(true) : navigate("/school-registration")}
                    >
                      {plan.action}<ArrowRight />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="mt-7 text-sm text-muted-foreground">Prices are in USD. SMS, payment processing, migration, and custom implementation are quoted separately.</p>
          </div>
        </section>

        <section className="container px-4 pb-20 lg:pb-28">
          <div className="surface-grid relative overflow-hidden rounded-[1.5rem] border border-primary/15 bg-primary-dark px-6 py-12 text-primary-foreground shadow-strong sm:px-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:px-14 lg:py-16">
            <div className="relative max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary-foreground/55">Start with your school structure</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl">See how your next school year could run.</h2>
              <p className="mt-5 max-w-xl leading-relaxed text-primary-foreground/65">Register a school workspace or talk through your migration, hosting, and rollout requirements with us.</p>
            </div>
            <div className="relative mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col">
              <Button size="lg" variant="secondary" onClick={() => navigate("/school-registration")}>Register your school<ArrowRight /></Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setSalesDialogOpen(true)}>Talk to sales</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="container flex flex-col gap-7 px-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3"><BrandLogo className="h-8 w-8" /><span className="text-lg font-semibold tracking-tight">SchoolXNow</span></div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Connected school operations for admissions, academics, attendance, billing, and guardian access.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <a href="#workflows" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="mailto:sales@schoolxnow.com" className="hover:text-foreground">Contact</a>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="container flex flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} SchoolXNow. All rights reserved.</p>
            <p>First-party SchoolXNow experience</p>
          </div>
        </div>
      </footer>

      <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
        <DialogContent className="sm:max-w-[32rem]">
          <DialogHeader>
            <DialogTitle>Plan your SchoolXNow rollout</DialogTitle>
            <DialogDescription>Tell us about your school. Our team will respond within one business day.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSalesSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" id="sales-name"><Input id="sales-name" value={salesForm.name} onChange={(event) => setSalesForm({ ...salesForm, name: event.target.value })} required /></Field>
              <Field label="Work email" id="sales-email"><Input id="sales-email" type="email" value={salesForm.email} onChange={(event) => setSalesForm({ ...salesForm, email: event.target.value })} required /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number" id="sales-phone"><Input id="sales-phone" type="tel" value={salesForm.phone} onChange={(event) => setSalesForm({ ...salesForm, phone: event.target.value })} required /></Field>
              <Field label="School name" id="sales-school"><Input id="sales-school" value={salesForm.schoolName} onChange={(event) => setSalesForm({ ...salesForm, schoolName: event.target.value })} /></Field>
            </div>
            <Field label="What do you need?" id="sales-message"><Textarea id="sales-message" value={salesForm.message} onChange={(event) => setSalesForm({ ...salesForm, message: event.target.value })} rows={4} /></Field>
            <Button type="submit" className="w-full">Send request<ArrowRight /></Button>
            <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
              <a href="mailto:sales@schoolxnow.com" className="flex items-center gap-1.5 hover:text-foreground"><Mail className="h-3.5 w-3.5" />sales@schoolxnow.com</a>
              <a href="tel:+8801734222467" className="flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" />+880 1734-222467</a>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

export default Landing;
