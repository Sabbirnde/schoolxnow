import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, ClipboardCheck, GraduationCap, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { phpApi } from "@/integrations/php-api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type Row = Record<string, any> & { id: string };

export function AcademicOperations() {
  const [years, setYears] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Row[]>([]);
  const [terms, setTerms] = useState<Row[]>([]);
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [admissions, setAdmissions] = useState<Row[]>([]);
  const [offerings, setOfferings] = useState<Row[]>([]);
  const [reportCards, setReportCards] = useState<Row[]>([]);
  const [subjectOfferings, setSubjectOfferings] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [yearForm, setYearForm] = useState({ name: "", start_date: "", end_date: "", status: "planned" });
  const [admissionForm, setAdmissionForm] = useState({
    academic_year_id: "", requested_class_id: "", application_number: "", applicant_name: "",
    date_of_birth: "", guardian_name: "", guardian_email: "", guardian_phone: "",
  });
  const [bulkForm, setBulkForm] = useState({
    source_academic_year_id: "", target_academic_year_id: "", target_class_id: "", mode: "enroll",
  });
  const [guardianForm, setGuardianForm] = useState({ student_id: "", email: "", relationship_type: "legal_guardian" });
  const [subjectOfferingForm, setSubjectOfferingForm] = useState({ class_offering_id: "", subject_id: "", academic_term_id: "" });
  const [categoryForm, setCategoryForm] = useState({ academic_year_id: "", name: "", weight_percent: "100", sequence_number: "1" });
  const [scaleForm, setScaleForm] = useState({ academic_year_id: "", name: "", scale_type: "percentage" });
  const [termForm, setTermForm] = useState({ academic_year_id: "", name: "", sequence_number: "1", start_date: "", end_date: "" });
  const [admissionDecisions, setAdmissionDecisions] = useState<Record<string, { student_number: string; class_id: string }>>({});

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [yearRows, classRows, termRows, subjectRows, studentRows, admissionRows, offeringRows, subjectOfferingRows, reportRows] = await Promise.all([
        phpApi.table<Row>("academic_years").list({ sort: "start_date", order: "desc" }),
        phpApi.table<Row>("classes").list({ sort: "name", order: "asc" }),
        phpApi.table<Row>("academic_terms").list({ sort: "start_date", order: "desc" }),
        phpApi.table<Row>("subjects").list({ sort: "name", order: "asc" }),
        phpApi.table<Row>("students").list({ status: "active", sort: "full_name", order: "asc", limit: 200 }),
        phpApi.table<Row>("admission_applications").list({ sort: "created_at", order: "desc", limit: 100 }),
        phpApi.table<Row>("class_offerings").list({ sort: "created_at", order: "desc" }),
        phpApi.table<Row>("subject_offerings").list({ sort: "created_at", order: "desc" }),
        phpApi.table<Row>("report_cards").list({ sort: "created_at", order: "desc", limit: 100 }),
      ]);
      setYears(yearRows); setClasses(classRows); setTerms(termRows); setSubjects(subjectRows); setStudents(studentRows);
      setAdmissions(admissionRows); setOfferings(offeringRows); setSubjectOfferings(subjectOfferingRows); setReportCards(reportRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load academic operations");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const activeYear = useMemo(() => years.find((year) => year.status === "active"), [years]);

  async function createYear() {
    setBusy(true);
    try {
      await phpApi.table<Row>("academic_years").create(yearForm);
      toast.success("Academic year created");
      setYearForm({ name: "", start_date: "", end_date: "", status: "planned" });
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Create failed"); }
    finally { setBusy(false); }
  }

  async function createAdmission() {
    setBusy(true);
    try {
      await phpApi.table<Row>("admission_applications").create({
        ...admissionForm,
        requested_class_id: admissionForm.requested_class_id || null,
        guardian_email: admissionForm.guardian_email || null,
        gender: "unspecified",
        status: "submitted",
      });
      toast.success("Admission application created");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Create failed"); }
    finally { setBusy(false); }
  }

  async function runBulkOperation() {
    if (!selectedStudents.length) return toast.error("Select at least one student");
    setBusy(true);
    try {
      if (bulkForm.mode === "enroll") {
        await phpApi.academic.bulkEnroll({
          academic_year_id: bulkForm.target_academic_year_id,
          class_id: bulkForm.target_class_id,
          student_ids: selectedStudents,
        });
        toast.success(`${selectedStudents.length} students enrolled`);
      } else {
        await phpApi.academic.promote({
          source_academic_year_id: bulkForm.source_academic_year_id,
          target_academic_year_id: bulkForm.target_academic_year_id,
          target_class_id: bulkForm.target_class_id,
          student_ids: selectedStudents,
        });
        toast.success(`${selectedStudents.length} students promoted`);
      }
      setSelectedStudents([]);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Bulk operation failed"); }
    finally { setBusy(false); }
  }

  async function acceptAdmission(application: Row) {
    const decision = admissionDecisions[application.id];
    const studentNumber = decision?.student_number?.trim();
    const classId = decision?.class_id || application.requested_class_id || classes[0]?.id;
    if (!studentNumber) return toast.error("Assign a student number");
    if (!classId) return toast.error("Create a class before accepting this application");
    setBusy(true);
    try {
      await phpApi.academic.acceptAdmission(application.id, { student_number: studentNumber, class_id: classId });
      toast.success("Application accepted and student enrolled");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Acceptance failed"); }
    finally { setBusy(false); }
  }

  async function createOffering(yearId: string, classId: string) {
    setBusy(true);
    try {
      await phpApi.table<Row>("class_offerings").create({ academic_year_id: yearId, class_id: classId, status: "active" });
      toast.success("Class offering created");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Create failed"); }
    finally { setBusy(false); }
  }

  async function inviteGuardian() {
    setBusy(true);
    try {
      const invitation = await phpApi.academic.inviteGuardian(guardianForm);
      await navigator.clipboard?.writeText(invitation.invitation_url || invitation.token);
      toast.success("Guardian invitation created; secure link copied");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Invitation failed"); }
    finally { setBusy(false); }
  }

  async function createSubjectOffering() {
    const classOffering = offerings.find((item) => item.id === subjectOfferingForm.class_offering_id);
    if (!classOffering) return;
    setBusy(true);
    try {
      await phpApi.table<Row>("subject_offerings").create({
        ...subjectOfferingForm,
        academic_year_id: classOffering.academic_year_id,
        academic_term_id: subjectOfferingForm.academic_term_id || null,
        maximum_marks: 100,
        pass_marks: 40,
        status: "active",
      });
      toast.success("Subject offering created");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Create failed"); }
    finally { setBusy(false); }
  }

  async function createTerm() {
    setBusy(true);
    try {
      await phpApi.table<Row>("academic_terms").create({
        ...termForm,
        sequence_number: Number(termForm.sequence_number),
        status: "planned",
      });
      toast.success("Academic term created");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Create failed"); }
    finally { setBusy(false); }
  }

  async function createAssessmentSetup(kind: "category" | "scale") {
    setBusy(true);
    try {
      if (kind === "category") {
        await phpApi.table<Row>("assessment_categories").create({
          ...categoryForm,
          weight_percent: Number(categoryForm.weight_percent),
          sequence_number: Number(categoryForm.sequence_number),
        });
        toast.success("Assessment category created");
      } else {
        await phpApi.table<Row>("grading_scales").create({ ...scaleForm, is_default: 0 });
        toast.success("Grading scale created");
      }
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Create failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Operations</h1>
          <p className="text-muted-foreground">Admissions, yearly offerings, promotion, assessment and guardian access.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeYear && <Badge variant="secondary">Active year: {activeYear.name}</Badge>}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Academic years", years.length, CalendarDays],
          ["Admissions", admissions.length, ClipboardCheck],
          ["Class offerings", offerings.length, BookOpen],
          ["Report cards", reportCards.length, GraduationCap],
        ].map(([label, value, Icon]: any) => (
          <Card key={label}><CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="years">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="years">Years & offerings</TabsTrigger>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
          <TabsTrigger value="enrollment">Enrollment & promotion</TabsTrigger>
          <TabsTrigger value="assessment">Assessment & reports</TabsTrigger>
          <TabsTrigger value="guardians">Guardian access</TabsTrigger>
        </TabsList>

        <TabsContent value="years" className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Create academic year</CardTitle><CardDescription>Only one year can be active per school.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Name"><Input value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} placeholder="2027–2028" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><Input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} /></Field>
                <Field label="End"><Input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} /></Field>
              </div>
              <Button onClick={() => void createYear()} disabled={busy || !yearForm.name || !yearForm.start_date || !yearForm.end_date}>Create year</Button>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Year-specific classes</CardTitle><CardDescription>Create an offering from an existing class template.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {classes.map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3">
                <span>{item.name} · {item.section}</span>
                <Button size="sm" variant="outline" disabled={!activeYear || busy} onClick={() => activeYear && void createOffering(activeYear.id, item.id)}>Offer</Button>
              </div>)}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>Create academic term</CardTitle><CardDescription>Terms provide the reporting boundary for assessments and report cards.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">
              <Field label="Academic year"><Choice value={termForm.academic_year_id} onValueChange={(v) => setTermForm({ ...termForm, academic_year_id: v })} items={years} /></Field>
              <Field label="Name"><Input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} placeholder="Term 1" /></Field>
              <Field label="Sequence"><Input type="number" min="1" value={termForm.sequence_number} onChange={(e) => setTermForm({ ...termForm, sequence_number: e.target.value })} /></Field>
              <Field label="Start"><Input type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} /></Field>
              <Field label="End"><Input type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} /></Field>
              <Button className="md:col-span-5" disabled={busy || !termForm.academic_year_id || !termForm.name || !termForm.start_date || !termForm.end_date} onClick={() => void createTerm()}>Create term</Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>Year-specific subject offering</CardTitle><CardDescription>Attach curriculum subjects to a class offering and optional term.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <Field label="Class offering"><Choice value={subjectOfferingForm.class_offering_id} onValueChange={(v) => setSubjectOfferingForm({ ...subjectOfferingForm, class_offering_id: v })} items={offerings.map((o) => ({ ...o, name: `${classes.find((c) => c.id === o.class_id)?.name || "Class"} · ${years.find((y) => y.id === o.academic_year_id)?.name || "Year"}` }))} /></Field>
              <Field label="Subject"><Choice value={subjectOfferingForm.subject_id} onValueChange={(v) => setSubjectOfferingForm({ ...subjectOfferingForm, subject_id: v })} items={subjects} /></Field>
              <Field label="Term"><Choice value={subjectOfferingForm.academic_term_id} onValueChange={(v) => setSubjectOfferingForm({ ...subjectOfferingForm, academic_term_id: v })} items={terms} /></Field>
              <div className="flex items-end"><Button className="w-full" disabled={busy || !subjectOfferingForm.class_offering_id || !subjectOfferingForm.subject_id} onClick={() => void createSubjectOffering()}>Add subject</Button></div>
              <p className="text-sm text-muted-foreground md:col-span-4">{subjectOfferings.length} subject offering{subjectOfferings.length === 1 ? "" : "s"} configured.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admissions">
          <div className="space-y-4">
          <Card><CardHeader><CardTitle>New admission application</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Academic year"><Choice value={admissionForm.academic_year_id} onValueChange={(v) => setAdmissionForm({ ...admissionForm, academic_year_id: v })} items={years} /></Field>
              <Field label="Requested class"><Choice value={admissionForm.requested_class_id} onValueChange={(v) => setAdmissionForm({ ...admissionForm, requested_class_id: v })} items={classes} /></Field>
              {(["application_number", "applicant_name", "guardian_name", "guardian_email", "guardian_phone"] as const).map((key) =>
                <Field key={key} label={key.replaceAll("_", " ")}><Input value={admissionForm[key]} onChange={(e) => setAdmissionForm({ ...admissionForm, [key]: e.target.value })} /></Field>)}
              <Field label="Date of birth"><Input type="date" value={admissionForm.date_of_birth} onChange={(e) => setAdmissionForm({ ...admissionForm, date_of_birth: e.target.value })} /></Field>
              <Button className="md:col-span-2" disabled={busy || !admissionForm.academic_year_id || !admissionForm.application_number || !admissionForm.applicant_name || !admissionForm.guardian_name || !admissionForm.guardian_phone || !admissionForm.date_of_birth} onClick={() => void createAdmission()}>Submit application</Button>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Application pipeline</CardTitle><CardDescription>Acceptance creates the student and first enrollment atomically.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {admissions.length === 0 ? <p className="text-sm text-muted-foreground">No applications submitted.</p> : admissions.map((application) => (
                <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                  <div><div className="font-medium">{application.applicant_name}</div><div className="text-xs text-muted-foreground">{application.application_number} · {application.guardian_name}</div></div>
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{application.status}</Badge>
                    {["submitted", "under_review", "waitlisted"].includes(application.status) && <>
                      <Input className="h-9 w-36" placeholder="Student number" value={admissionDecisions[application.id]?.student_number || ""} onChange={(event) => setAdmissionDecisions((current) => ({ ...current, [application.id]: { student_number: event.target.value, class_id: current[application.id]?.class_id || application.requested_class_id || "" } }))} />
                      <div className="w-44"><Choice value={admissionDecisions[application.id]?.class_id || application.requested_class_id || ""} onValueChange={(class_id) => setAdmissionDecisions((current) => ({ ...current, [application.id]: { student_number: current[application.id]?.student_number || "", class_id } }))} items={classes} /></div>
                      <Button size="sm" disabled={busy || !admissionDecisions[application.id]?.student_number} onClick={() => void acceptAdmission(application)}>Accept & enroll</Button>
                    </>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="enrollment" className="space-y-4">
          <Card><CardHeader><CardTitle>Bulk enrollment and promotion</CardTitle><CardDescription>Runs as one database transaction.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Operation"><Select value={bulkForm.mode} onValueChange={(v) => setBulkForm({ ...bulkForm, mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="enroll">Enroll</SelectItem><SelectItem value="promote">Promote</SelectItem></SelectContent></Select></Field>
                {bulkForm.mode === "promote" && <Field label="Source year"><Choice value={bulkForm.source_academic_year_id} onValueChange={(v) => setBulkForm({ ...bulkForm, source_academic_year_id: v })} items={years} /></Field>}
                <Field label="Target year"><Choice value={bulkForm.target_academic_year_id} onValueChange={(v) => setBulkForm({ ...bulkForm, target_academic_year_id: v })} items={years} /></Field>
                <Field label="Target class"><Choice value={bulkForm.target_class_id} onValueChange={(v) => setBulkForm({ ...bulkForm, target_class_id: v })} items={classes} /></Field>
              </div>
              <div className="grid max-h-80 gap-2 overflow-auto rounded border p-3 md:grid-cols-2">
                {students.map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted">
                  <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => setSelectedStudents((current) => current.includes(student.id) ? current.filter((id) => id !== student.id) : [...current, student.id])} />
                  <span>{student.full_name} <span className="text-muted-foreground">({student.student_id})</span></span>
                </label>)}
              </div>
              <Button disabled={busy || !bulkForm.target_academic_year_id || !bulkForm.target_class_id || !selectedStudents.length} onClick={() => void runBulkOperation()}>
                Process {selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessment" className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Assessment category</CardTitle><CardDescription>Define weighted coursework, examination, practical, or other categories.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Academic year"><Choice value={categoryForm.academic_year_id} onValueChange={(v) => setCategoryForm({ ...categoryForm, academic_year_id: v })} items={years} /></Field>
              <Field label="Name"><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Coursework" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Weight %"><Input type="number" value={categoryForm.weight_percent} onChange={(e) => setCategoryForm({ ...categoryForm, weight_percent: e.target.value })} /></Field><Field label="Sequence"><Input type="number" value={categoryForm.sequence_number} onChange={(e) => setCategoryForm({ ...categoryForm, sequence_number: e.target.value })} /></Field></div>
              <Button disabled={busy || !categoryForm.academic_year_id || !categoryForm.name} onClick={() => void createAssessmentSetup("category")}>Create category</Button>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Grading scale</CardTitle><CardDescription>Create the scale, then configure its ordered bands through the secured grading-band table.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Academic year"><Choice value={scaleForm.academic_year_id} onValueChange={(v) => setScaleForm({ ...scaleForm, academic_year_id: v })} items={years} /></Field>
              <Field label="Name"><Input value={scaleForm.name} onChange={(e) => setScaleForm({ ...scaleForm, name: e.target.value })} placeholder="International percentage scale" /></Field>
              <Field label="Scale type"><Select value={scaleForm.scale_type} onValueChange={(v) => setScaleForm({ ...scaleForm, scale_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["percentage", "gpa", "points"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
              <Button disabled={busy || !scaleForm.academic_year_id || !scaleForm.name} onClick={() => void createAssessmentSetup("scale")}>Create scale</Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>Enrollment-linked report cards</CardTitle><CardDescription>Draft, review, approve, publish, or recall cards without exposing unpublished results.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {reportCards.length === 0 ? <p className="text-sm text-muted-foreground">No report cards have been generated.</p> : reportCards.map((card) => <div key={card.id} className="flex items-center justify-between rounded border p-3"><span>{card.overall_grade || "Ungraded"} · {card.percentage ?? "—"}%</span><Badge>{card.status}</Badge></div>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <Card><CardHeader><CardTitle>Invite a guardian</CardTitle><CardDescription>Invitation tokens expire after seven days and must match the guardian account email.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Field label="Student"><Choice value={guardianForm.student_id} onValueChange={(v) => setGuardianForm({ ...guardianForm, student_id: v })} items={students.map((s) => ({ ...s, name: `${s.full_name} (${s.student_id})` }))} /></Field>
              <Field label="Guardian email"><Input type="email" value={guardianForm.email} onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })} /></Field>
              <Field label="Relationship"><Select value={guardianForm.relationship_type} onValueChange={(v) => setGuardianForm({ ...guardianForm, relationship_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["father", "mother", "legal_guardian", "grandparent", "relative", "other"].map((v) => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field>
              <Button className="md:col-span-3" disabled={busy || !guardianForm.student_id || !guardianForm.email} onClick={() => void inviteGuardian()}><Link2 className="mr-2 h-4 w-4" />Create invitation</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="capitalize">{label}</Label>{children}</div>;
}

function Choice({ value, onValueChange, items }: { value: string; onValueChange: (value: string) => void; items: Row[] }) {
  return <Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name || item.full_name || item.id}</SelectItem>)}</SelectContent></Select>;
}
