import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RowDataPacket } from 'mysql2/promise';
import { requireUser } from './auth.js';
import { execute, query, transaction } from './db.js';
import { ApiError, readJsonBody, sendData } from './http.js';

function adminSchool(user: Awaited<ReturnType<typeof requireUser>>) {
  if (!['school_admin', 'super_admin'].includes(user.role) || !user.school_id) {
    throw new ApiError(403, 'School billing administrator access is required');
  }
  return user.school_id;
}

function money(value: unknown, field: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(422, `${field} must be greater than zero`);
  return Math.round(amount * 100) / 100;
}

function currency(value: unknown) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new ApiError(422, 'currency must be a three-letter ISO code');
  return code;
}

function dateValue(value: unknown, field: string) {
  const result = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new ApiError(422, `${field} must use YYYY-MM-DD`);
  return result;
}

function generatedNumber(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function generateInvoices(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const schoolId = adminSchool(user);
  const body = readJsonBody(req);
  const planId = String(body.fee_plan_id || '');
  const enrollmentIds = Array.isArray(body.student_enrollment_ids)
    ? [...new Set(body.student_enrollment_ids.map(String).filter(Boolean))].slice(0, 500)
    : [];
  const issueDate = dateValue(body.issue_date, 'issue_date');
  const dueDate = dateValue(body.due_date, 'due_date');
  if (!planId || enrollmentIds.length === 0 || dueDate < issueDate) {
    throw new ApiError(422, 'fee_plan_id, valid dates, and student_enrollment_ids are required');
  }

  const created = await transaction(async (connection) => {
    const plans = await query<RowDataPacket[]>(
      `SELECT id, currency FROM fee_plans
       WHERE id = :id AND school_id = :school_id AND status = 'active' FOR UPDATE`,
      { id: planId, school_id: schoolId },
      connection,
    );
    if (!plans[0]) throw new ApiError(422, 'An active fee plan is required');
    const items = await query<RowDataPacket[]>(
      `SELECT fee_category_id, COALESCE(description, 'School fee') AS description, amount
       FROM fee_plan_items WHERE fee_plan_id = :plan_id AND school_id = :school_id AND is_optional = 0`,
      { plan_id: planId, school_id: schoolId },
      connection,
    );
    if (!items.length) throw new ApiError(422, 'The fee plan has no billable items');

    const placeholders = enrollmentIds.map((_, i) => `:enrollment_${i}`).join(', ');
    const params = Object.fromEntries(enrollmentIds.map((id, i) => [`enrollment_${i}`, id]));
    const enrollments = await query<RowDataPacket[]>(
      `SELECT id FROM student_enrollments
       WHERE school_id = :school_id AND status IN ('active', 'pending') AND id IN (${placeholders}) FOR UPDATE`,
      { school_id: schoolId, ...params },
      connection,
    );
    if (enrollments.length !== enrollmentIds.length) throw new ApiError(422, 'One or more enrollments are invalid');

    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const invoiceIds: string[] = [];
    for (const enrollment of enrollments) {
      const invoiceId = randomUUID();
      invoiceIds.push(invoiceId);
      await execute(
        `INSERT INTO student_invoices
         (id, school_id, student_enrollment_id, fee_plan_id, invoice_number, currency,
          issue_date, due_date, status, subtotal, total_amount, balance_amount, issued_by, issued_at)
         VALUES (:id, :school_id, :enrollment_id, :plan_id, :number, :currency,
          :issue_date, :due_date, 'issued', :subtotal, :subtotal, :subtotal, :user_id, UTC_TIMESTAMP())`,
        {
          id: invoiceId, school_id: schoolId, enrollment_id: enrollment.id, plan_id: planId,
          number: generatedNumber('INV'), currency: plans[0].currency, issue_date: issueDate,
          due_date: dueDate, subtotal, user_id: user.id,
        },
        connection,
      );
      for (const item of items) {
        await execute(
          `INSERT INTO student_invoice_items
           (id, school_id, student_invoice_id, fee_category_id, description, quantity, unit_amount, line_total)
           VALUES (:id, :school_id, :invoice_id, :category_id, :description, 1, :amount, :amount)`,
          {
            id: randomUUID(), school_id: schoolId, invoice_id: invoiceId,
            category_id: item.fee_category_id, description: item.description, amount: item.amount,
          },
          connection,
        );
      }
    }
    return invoiceIds;
  });
  return sendData(res, { created: created.length, invoice_ids: created }, 201);
}

async function recordPayment(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const schoolId = adminSchool(user);
  const body = readJsonBody(req);
  const invoiceId = String(body.student_invoice_id || '');
  const amount = money(body.amount, 'amount');
  const code = currency(body.currency);
  const method = String(body.payment_method || '');
  if (!invoiceId || !['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'online', 'other'].includes(method)) {
    throw new ApiError(422, 'student_invoice_id and a valid payment_method are required');
  }

  const result = await transaction(async (connection) => {
    const invoices = await query<RowDataPacket[]>(
      `SELECT id, currency, balance_amount, status FROM student_invoices
       WHERE id = :id AND school_id = :school_id FOR UPDATE`,
      { id: invoiceId, school_id: schoolId },
      connection,
    );
    const invoice = invoices[0];
    if (!invoice || ['paid', 'void'].includes(invoice.status)) throw new ApiError(409, 'Invoice cannot receive a payment');
    if (invoice.currency !== code) throw new ApiError(422, 'Payment currency must match the invoice');
    if (amount > Number(invoice.balance_amount)) throw new ApiError(422, 'Payment exceeds the outstanding balance');

    const paymentId = randomUUID();
    const receiptNumber = generatedNumber('RCT');
    await execute(
      `INSERT INTO payments
       (id, school_id, receipt_number, amount, currency, payment_method, status, paid_at,
        external_reference, notes, recorded_by)
       VALUES (:id, :school_id, :receipt, :amount, :currency, :method, 'completed', UTC_TIMESTAMP(),
        :reference, :notes, :user_id)`,
      {
        id: paymentId, school_id: schoolId, receipt: receiptNumber, amount, currency: code,
        method, reference: body.external_reference || null, notes: body.notes || null, user_id: user.id,
      },
      connection,
    );
    await execute(
      `INSERT INTO payment_allocations (id, school_id, payment_id, student_invoice_id, amount)
       VALUES (:id, :school_id, :payment_id, :invoice_id, :amount)`,
      { id: randomUUID(), school_id: schoolId, payment_id: paymentId, invoice_id: invoiceId, amount },
      connection,
    );
    await execute(
      `UPDATE student_invoices
       SET paid_amount = paid_amount + :amount,
           balance_amount = balance_amount - :amount,
           status = CASE WHEN balance_amount - :amount = 0 THEN 'paid' ELSE 'partially_paid' END
       WHERE id = :invoice_id AND school_id = :school_id`,
      { amount, invoice_id: invoiceId, school_id: schoolId },
      connection,
    );
    return { payment_id: paymentId, receipt_number: receiptNumber, allocated_amount: amount };
  });
  return sendData(res, result, 201);
}

async function addAdjustment(req: VercelRequest, res: VercelResponse, invoiceId: string) {
  const user = await requireUser(req);
  const schoolId = adminSchool(user);
  const body = readJsonBody(req);
  const amount = money(body.amount, 'amount');
  const type = String(body.adjustment_type || '');
  const reason = String(body.reason || '').trim();
  if (!['discount', 'charge', 'waiver', 'credit'].includes(type) || !reason) {
    throw new ApiError(422, 'A valid adjustment_type and reason are required');
  }

  const adjustmentId = await transaction(async (connection) => {
    const rows = await query<RowDataPacket[]>(
      `SELECT total_amount, paid_amount, status FROM student_invoices
       WHERE id = :id AND school_id = :school_id FOR UPDATE`,
      { id: invoiceId, school_id: schoolId },
      connection,
    );
    const invoice = rows[0];
    if (!invoice || ['paid', 'void'].includes(invoice.status)) throw new ApiError(409, 'Invoice cannot be adjusted');
    const signed = type === 'charge' ? amount : -amount;
    const total = Math.round((Number(invoice.total_amount) + signed) * 100) / 100;
    if (total < Number(invoice.paid_amount)) throw new ApiError(422, 'Adjustment cannot reduce total below payments received');
    const id = randomUUID();
    await execute(
      `INSERT INTO invoice_adjustments
       (id, school_id, student_invoice_id, adjustment_type, amount, reason, approved_by)
       VALUES (:id, :school_id, :invoice_id, :type, :amount, :reason, :user_id)`,
      { id, school_id: schoolId, invoice_id: invoiceId, type, amount, reason, user_id: user.id },
      connection,
    );
    await execute(
      `UPDATE student_invoices
       SET adjustment_total = adjustment_total + :signed,
           discount_total = discount_total + :discount,
           total_amount = :total, balance_amount = :total - paid_amount
       WHERE id = :invoice_id AND school_id = :school_id`,
      {
        signed, discount: type === 'discount' || type === 'waiver' || type === 'credit' ? amount : 0,
        total, invoice_id: invoiceId, school_id: schoolId,
      },
      connection,
    );
    return id;
  });
  return sendData(res, { adjustment_id: adjustmentId }, 201);
}

export async function handleBilling(req: VercelRequest, res: VercelResponse, segments: string[]) {
  if (req.method === 'POST' && segments[1] === 'invoices' && segments[2] === 'generate') {
    return generateInvoices(req, res);
  }
  if (req.method === 'POST' && segments[1] === 'payments') return recordPayment(req, res);
  if (req.method === 'POST' && segments[1] === 'invoices' && segments[2] && segments[3] === 'adjustments') {
    return addAdjustment(req, res, segments[2]);
  }
  throw new ApiError(404, 'Billing operation not found');
}
