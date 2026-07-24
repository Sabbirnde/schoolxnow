import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { phpApi } from "@/integrations/php-api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Row = Record<string, any> & { id: string };
const today = new Date().toISOString().slice(0, 10);

export function BillingManagement() {
  const [categories, setCategories] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [planItems, setPlanItems] = useState<Row[]>([]);
  const [years, setYears] = useState<Row[]>([]);
  const [enrollments, setEnrollments] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([]);
  const [categoryForm, setCategoryForm] = useState({ code: "", name: "" });
  const [planForm, setPlanForm] = useState({ academic_year_id: "", name: "", currency: "USD", billing_frequency: "one_time" });
  const [itemForm, setItemForm] = useState({ fee_plan_id: "", fee_category_id: "", description: "", amount: "" });
  const [invoiceForm, setInvoiceForm] = useState({ fee_plan_id: "", issue_date: today, due_date: today });
  const [paymentForm, setPaymentForm] = useState({ student_invoice_id: "", amount: "", currency: "USD", payment_method: "cash", external_reference: "" });
  const [adjustmentForm, setAdjustmentForm] = useState({ student_invoice_id: "", adjustment_type: "discount", amount: "", reason: "" });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await Promise.all([
        phpApi.table<Row>("fee_categories").list({ select: "id,code,name,is_active", sort: "name", order: "asc" }),
        phpApi.table<Row>("fee_plans").list({ select: "id,academic_year_id,class_id,name,currency,billing_frequency,status", sort: "created_at", order: "desc" }),
        phpApi.table<Row>("fee_plan_items").list({ select: "id,fee_plan_id,fee_category_id,description,amount,is_optional", sort: "created_at", order: "desc" }),
        phpApi.table<Row>("academic_years").list({ select: "id,name,status,start_date,end_date", sort: "start_date", order: "desc" }),
        phpApi.table<Row>("student_enrollments").list({ select: "id,student_id,class_id,status", status: "active", limit: 200 }),
        phpApi.table<Row>("students").list({ select: "id,full_name,student_id,status", status: "active", sort: "full_name", order: "asc", limit: 200 }),
        phpApi.table<Row>("student_invoices").list({ select: "id,student_enrollment_id,invoice_number,currency,issue_date,due_date,status,total_amount,paid_amount,balance_amount", sort: "created_at", order: "desc", limit: 200 }),
        phpApi.table<Row>("payments").list({ select: "id,receipt_number,amount,currency,payment_method,status,paid_at", sort: "paid_at", order: "desc", limit: 100 }),
      ]);
      setCategories(data[0]); setPlans(data[1]); setPlanItems(data[2]); setYears(data[3]);
      setEnrollments(data[4]); setStudents(data[5]); setInvoices(data[6]); setPayments(data[7]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load billing data");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const money = (value: unknown, code = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(value || 0));
  const outstanding = useMemo(() => invoices.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0), [invoices]);
  const collected = useMemo(() => payments.filter((row) => row.status === "completed").reduce((sum, row) => sum + Number(row.amount || 0), 0), [payments]);
  const studentByEnrollment = (enrollmentId: string) => {
    const enrollment = enrollments.find((row) => row.id === enrollmentId);
    return students.find((row) => row.id === enrollment?.student_id)?.full_name || enrollmentId.slice(0, 8);
  };

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await action(); toast.success(success); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Billing operation failed"); }
    finally { setBusy(false); }
  }

  const createCategory = () => perform(
    () => phpApi.table<Row>("fee_categories").create({ ...categoryForm, code: categoryForm.code.toUpperCase(), is_active: 1 }),
    "Fee category created",
  );
  const createPlan = () => perform(
    () => phpApi.table<Row>("fee_plans").create({ ...planForm, currency: planForm.currency.toUpperCase(), status: "active" }),
    "Fee plan activated",
  );
  const createItem = () => perform(
    () => phpApi.table<Row>("fee_plan_items").create({ ...itemForm, amount: Number(itemForm.amount), due_offset_days: 0, is_optional: 0 }),
    "Fee item added",
  );
  const generateInvoices = () => perform(
    () => phpApi.billing.generateInvoices({ ...invoiceForm, student_enrollment_ids: selectedEnrollments }),
    `${selectedEnrollments.length} invoices generated`,
  );
  const recordPayment = () => perform(
    () => phpApi.billing.recordPayment({ ...paymentForm, amount: Number(paymentForm.amount), currency: paymentForm.currency.toUpperCase() }),
    "Payment recorded and receipt generated",
  );
  const addAdjustment = () => perform(
    () => phpApi.billing.addAdjustment(adjustmentForm.student_invoice_id, { ...adjustmentForm, amount: Number(adjustmentForm.amount) }),
    "Invoice adjustment applied",
  );

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight">Fees, Billing & Payments</h1>
          <p className="text-muted-foreground">Configure fee plans, issue invoices, collect payments, and track balances.</p></div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Invoices" value={String(invoices.length)} icon={FileText} />
        <Metric title="Outstanding" value={money(outstanding, invoices[0]?.currency || "USD")} icon={Banknote} />
        <Metric title="Collected" value={money(collected, payments[0]?.currency || "USD")} icon={CreditCard} />
      </div>

      <Tabs defaultValue="setup">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="setup">Fee setup</TabsTrigger><TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="setup" className="grid gap-4 lg:grid-cols-3">
          <FormCard title="Fee category" description="Reusable tuition, transport, meal, or activity codes">
            <Field label="Code"><Input value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} placeholder="TUITION" /></Field>
            <Field label="Name"><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Tuition fee" /></Field>
            <Button disabled={busy || !categoryForm.code || !categoryForm.name} onClick={() => void createCategory()}>Create category</Button>
          </FormCard>
          <FormCard title="Fee plan" description="Year-specific pricing in an ISO currency">
            <Field label="Academic year"><Choice value={planForm.academic_year_id} onChange={(value) => setPlanForm({ ...planForm, academic_year_id: value })} rows={years} /></Field>
            <Field label="Plan name"><Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Grade 6 annual fees" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Currency"><Input maxLength={3} value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })} /></Field>
              <Field label="Frequency"><Choice value={planForm.billing_frequency} onChange={(value) => setPlanForm({ ...planForm, billing_frequency: value })} options={["one_time", "monthly", "termly", "quarterly", "annual"]} /></Field></div>
            <Button disabled={busy || !planForm.academic_year_id || !planForm.name} onClick={() => void createPlan()}>Activate plan</Button>
          </FormCard>
          <FormCard title="Plan item" description="Attach a billable category and amount">
            <Field label="Fee plan"><Choice value={itemForm.fee_plan_id} onChange={(value) => setItemForm({ ...itemForm, fee_plan_id: value })} rows={plans} /></Field>
            <Field label="Category"><Choice value={itemForm.fee_category_id} onChange={(value) => setItemForm({ ...itemForm, fee_category_id: value })} rows={categories} /></Field>
            <Field label="Description"><Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></Field>
            <Field label="Amount"><Input type="number" min="0.01" step="0.01" value={itemForm.amount} onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })} /></Field>
            <Button disabled={busy || !itemForm.fee_plan_id || !itemForm.fee_category_id || !itemForm.amount} onClick={() => void createItem()}>Add item</Button>
          </FormCard>
        </TabsContent>
        <TabsContent value="invoices" className="grid gap-4 lg:grid-cols-2">
          <FormCard title="Bulk invoice generation" description="Issue the selected plan to active student enrollments">
            <Field label="Fee plan"><Choice value={invoiceForm.fee_plan_id} onChange={(value) => setInvoiceForm({ ...invoiceForm, fee_plan_id: value })} rows={plans.filter((row) => row.status === "active")} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Issue date"><Input type="date" value={invoiceForm.issue_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, issue_date: e.target.value })} /></Field>
              <Field label="Due date"><Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} /></Field></div>
            <div className="max-h-64 space-y-1 overflow-auto rounded border p-2">{enrollments.map((row) =>
              <label key={row.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted">
                <input type="checkbox" checked={selectedEnrollments.includes(row.id)} onChange={() => setSelectedEnrollments((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
                <span>{studentByEnrollment(row.id)}</span>
              </label>)}</div>
            <Button disabled={busy || !invoiceForm.fee_plan_id || !selectedEnrollments.length} onClick={() => void generateInvoices()}>Generate {selectedEnrollments.length || ""} invoices</Button>
          </FormCard>
          <FormCard title="Invoice adjustment" description="Apply an approved discount, waiver, credit, or charge">
            <Field label="Invoice"><InvoiceChoice value={adjustmentForm.student_invoice_id} onChange={(value) => setAdjustmentForm({ ...adjustmentForm, student_invoice_id: value })} rows={invoices} /></Field>
            <Field label="Type"><Choice value={adjustmentForm.adjustment_type} onChange={(value) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: value })} options={["discount", "waiver", "credit", "charge"]} /></Field>
            <Field label="Amount"><Input type="number" min="0.01" step="0.01" value={adjustmentForm.amount} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })} /></Field>
            <Field label="Reason"><Input value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })} /></Field>
            <Button disabled={busy || !adjustmentForm.student_invoice_id || !adjustmentForm.amount || !adjustmentForm.reason} onClick={() => void addAdjustment()}>Apply adjustment</Button>
          </FormCard>
        </TabsContent>
        <TabsContent value="payments">
          <FormCard title="Record payment" description="Payments are allocated atomically and receive a unique receipt">
            <Field label="Invoice"><InvoiceChoice value={paymentForm.student_invoice_id} onChange={(value) => { const invoice = invoices.find((row) => row.id === value); setPaymentForm({ ...paymentForm, student_invoice_id: value, currency: invoice?.currency || "USD" }); }} rows={invoices.filter((row) => !["paid", "void"].includes(row.status))} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Amount"><Input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></Field>
              <Field label="Currency"><Input disabled value={paymentForm.currency} /></Field></div>
            <Field label="Method"><Choice value={paymentForm.payment_method} onChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })} options={["cash", "bank_transfer", "card", "mobile_money", "cheque", "online", "other"]} /></Field>
            <Field label="Reference"><Input value={paymentForm.external_reference} onChange={(e) => setPaymentForm({ ...paymentForm, external_reference: e.target.value })} /></Field>
            <Button disabled={busy || !paymentForm.student_invoice_id || !paymentForm.amount} onClick={() => void recordPayment()}>Record payment</Button>
          </FormCard>
        </TabsContent>
        <TabsContent value="ledger"><Card><CardHeader><CardTitle>Invoice ledger</CardTitle><CardDescription>Current balances and collection status</CardDescription></CardHeader>
          <CardContent className="space-y-2">{invoices.length ? invoices.map((row) => <div key={row.id} className="grid gap-2 rounded border p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
            <div><div className="font-medium">{row.invoice_number}</div><div className="text-sm text-muted-foreground">{studentByEnrollment(row.student_enrollment_id)} · due {row.due_date}</div></div>
            <Badge variant={row.status === "paid" ? "default" : "secondary"}>{String(row.status).replaceAll("_", " ")}</Badge>
            <div className="text-right"><div className="font-semibold">{money(row.balance_amount, row.currency)} due</div><div className="text-xs text-muted-foreground">{money(row.paid_amount, row.currency)} paid</div></div>
          </div>) : <p className="text-sm text-muted-foreground">No invoices have been issued.</p>}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}
function FormCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-3">{children}</CardContent></Card>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
function Choice({ value, onChange, rows, options }: { value: string; onChange: (value: string) => void; rows?: Row[]; options?: string[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>
    {(rows || []).map((row) => <SelectItem key={row.id} value={row.id}>{row.name || row.code}</SelectItem>)}
    {(options || []).map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}
  </SelectContent></Select>;
}
function InvoiceChoice({ value, onChange, rows }: { value: string; onChange: (value: string) => void; rows: Row[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger><SelectContent>
    {rows.map((row) => <SelectItem key={row.id} value={row.id}>{row.invoice_number} · {row.currency} {row.balance_amount}</SelectItem>)}
  </SelectContent></Select>;
}
