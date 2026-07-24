<?php

declare(strict_types=1);

namespace SchoolXNow\Api;

use PDO;
use SchoolXNow\Core\Database;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;
use SchoolXNow\Security\Auth;

final class BillingController
{
    public function generateInvoices(): void
    {
        [$user, $schoolId] = $this->admin();
        $body = Request::json();
        $planId = trim((string) ($body['fee_plan_id'] ?? ''));
        $enrollmentIds = $this->ids($body['student_enrollment_ids'] ?? []);
        $issueDate = $this->date($body['issue_date'] ?? null, 'issue_date');
        $dueDate = $this->date($body['due_date'] ?? null, 'due_date');
        if (!$planId || !$enrollmentIds || $dueDate < $issueDate) {
            Response::json(['error' => ['message' => 'fee_plan_id, valid dates, and student_enrollment_ids are required']], 422);
        }

        $db = Database::connection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare("SELECT id, currency FROM fee_plans WHERE id = ? AND school_id = ? AND status = 'active' FOR UPDATE");
            $stmt->execute([$planId, $schoolId]);
            $plan = $stmt->fetch();
            if (!$plan) {
                Response::json(['error' => ['message' => 'An active fee plan is required']], 422);
            }
            $stmt = $db->prepare(
                "SELECT fee_category_id, COALESCE(description, 'School fee') AS description, amount
                 FROM fee_plan_items WHERE fee_plan_id = ? AND school_id = ? AND is_optional = 0"
            );
            $stmt->execute([$planId, $schoolId]);
            $items = $stmt->fetchAll();
            if (!$items) {
                Response::json(['error' => ['message' => 'The fee plan has no billable items']], 422);
            }
            $placeholders = implode(', ', array_fill(0, count($enrollmentIds), '?'));
            $stmt = $db->prepare(
                "SELECT id FROM student_enrollments WHERE school_id = ?
                 AND status IN ('active','pending') AND id IN ({$placeholders}) FOR UPDATE"
            );
            $stmt->execute([$schoolId, ...$enrollmentIds]);
            $enrollments = $stmt->fetchAll();
            if (count($enrollments) !== count($enrollmentIds)) {
                Response::json(['error' => ['message' => 'One or more enrollments are invalid']], 422);
            }
            $subtotal = array_reduce($items, fn (float $sum, array $item): float => $sum + (float) $item['amount'], 0.0);
            $ids = [];
            foreach ($enrollments as $enrollment) {
                $invoiceId = self::uuid();
                $ids[] = $invoiceId;
                $db->prepare(
                    "INSERT INTO student_invoices
                     (id, school_id, student_enrollment_id, fee_plan_id, invoice_number, currency,
                      issue_date, due_date, status, subtotal, total_amount, balance_amount, issued_by, issued_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, UTC_TIMESTAMP())"
                )->execute([
                    $invoiceId, $schoolId, $enrollment['id'], $planId, self::number('INV'),
                    $plan['currency'], $issueDate, $dueDate, $subtotal, $subtotal, $subtotal, $user['id'],
                ]);
                $insertItem = $db->prepare(
                    "INSERT INTO student_invoice_items
                     (id, school_id, student_invoice_id, fee_category_id, description, quantity, unit_amount, line_total)
                     VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
                );
                foreach ($items as $item) {
                    $insertItem->execute([
                        self::uuid(), $schoolId, $invoiceId, $item['fee_category_id'],
                        $item['description'], $item['amount'], $item['amount'],
                    ]);
                }
            }
            $db->commit();
            Response::json(['data' => ['created' => count($ids), 'invoice_ids' => $ids]], 201);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    public function recordPayment(): void
    {
        [$user, $schoolId] = $this->admin();
        $body = Request::json();
        $invoiceId = trim((string) ($body['student_invoice_id'] ?? ''));
        $amount = $this->money($body['amount'] ?? null, 'amount');
        $currency = strtoupper(trim((string) ($body['currency'] ?? '')));
        $method = trim((string) ($body['payment_method'] ?? ''));
        if (!$invoiceId || !preg_match('/^[A-Z]{3}$/', $currency)
            || !in_array($method, ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'online', 'other'], true)) {
            Response::json(['error' => ['message' => 'student_invoice_id, currency, and a valid payment_method are required']], 422);
        }
        $db = Database::connection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT currency, balance_amount, status FROM student_invoices WHERE id = ? AND school_id = ? FOR UPDATE');
            $stmt->execute([$invoiceId, $schoolId]);
            $invoice = $stmt->fetch();
            if (!$invoice || in_array($invoice['status'], ['paid', 'void'], true)) {
                Response::json(['error' => ['message' => 'Invoice cannot receive a payment']], 409);
            }
            if ($invoice['currency'] !== $currency || $amount > (float) $invoice['balance_amount']) {
                Response::json(['error' => ['message' => $invoice['currency'] !== $currency
                    ? 'Payment currency must match the invoice' : 'Payment exceeds the outstanding balance']], 422);
            }
            $paymentId = self::uuid();
            $receipt = self::number('RCT');
            $db->prepare(
                "INSERT INTO payments
                 (id, school_id, receipt_number, amount, currency, payment_method, status, paid_at,
                  external_reference, notes, recorded_by)
                 VALUES (?, ?, ?, ?, ?, ?, 'completed', UTC_TIMESTAMP(), ?, ?, ?)"
            )->execute([
                $paymentId, $schoolId, $receipt, $amount, $currency, $method,
                $body['external_reference'] ?? null, $body['notes'] ?? null, $user['id'],
            ]);
            $db->prepare(
                'INSERT INTO payment_allocations (id, school_id, payment_id, student_invoice_id, amount) VALUES (?, ?, ?, ?, ?)'
            )->execute([self::uuid(), $schoolId, $paymentId, $invoiceId, $amount]);
            $db->prepare(
                "UPDATE student_invoices SET paid_amount = paid_amount + ?,
                 balance_amount = balance_amount - ?,
                 status = CASE WHEN balance_amount - ? = 0 THEN 'paid' ELSE 'partially_paid' END
                 WHERE id = ? AND school_id = ?"
            )->execute([$amount, $amount, $amount, $invoiceId, $schoolId]);
            $db->commit();
            Response::json(['data' => [
                'payment_id' => $paymentId, 'receipt_number' => $receipt, 'allocated_amount' => $amount,
            ]], 201);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    public function addAdjustment(string $invoiceId): void
    {
        [$user, $schoolId] = $this->admin();
        $body = Request::json();
        $amount = $this->money($body['amount'] ?? null, 'amount');
        $type = trim((string) ($body['adjustment_type'] ?? ''));
        $reason = trim((string) ($body['reason'] ?? ''));
        if (!in_array($type, ['discount', 'charge', 'waiver', 'credit'], true) || !$reason) {
            Response::json(['error' => ['message' => 'A valid adjustment_type and reason are required']], 422);
        }
        $db = Database::connection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT total_amount, paid_amount, status FROM student_invoices WHERE id = ? AND school_id = ? FOR UPDATE');
            $stmt->execute([$invoiceId, $schoolId]);
            $invoice = $stmt->fetch();
            if (!$invoice || in_array($invoice['status'], ['paid', 'void'], true)) {
                Response::json(['error' => ['message' => 'Invoice cannot be adjusted']], 409);
            }
            $signed = $type === 'charge' ? $amount : -$amount;
            $total = round((float) $invoice['total_amount'] + $signed, 2);
            if ($total < (float) $invoice['paid_amount']) {
                Response::json(['error' => ['message' => 'Adjustment cannot reduce total below payments received']], 422);
            }
            $id = self::uuid();
            $db->prepare(
                'INSERT INTO invoice_adjustments
                 (id, school_id, student_invoice_id, adjustment_type, amount, reason, approved_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$id, $schoolId, $invoiceId, $type, $amount, $reason, $user['id']]);
            $discount = in_array($type, ['discount', 'waiver', 'credit'], true) ? $amount : 0;
            $db->prepare(
                'UPDATE student_invoices SET adjustment_total = adjustment_total + ?,
                 discount_total = discount_total + ?, total_amount = ?, balance_amount = ? - paid_amount
                 WHERE id = ? AND school_id = ?'
            )->execute([$signed, $discount, $total, $total, $invoiceId, $schoolId]);
            $db->commit();
            Response::json(['data' => ['adjustment_id' => $id]], 201);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    private function admin(): array
    {
        $user = Auth::user();
        if (!in_array($user['role'], ['school_admin', 'super_admin'], true) || !$user['school_id']) {
            Response::json(['error' => ['message' => 'School billing administrator access is required']], 403);
        }
        return [$user, (string) $user['school_id']];
    }

    private function ids(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        return array_slice(array_values(array_unique(array_filter(array_map(
            fn ($id): string => trim((string) $id), $value
        )))), 0, 500);
    }

    private function date(mixed $value, string $field): string
    {
        $date = trim((string) $value);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            Response::json(['error' => ['message' => "{$field} must use YYYY-MM-DD"]], 422);
        }
        return $date;
    }

    private function money(mixed $value, string $field): float
    {
        $amount = round((float) $value, 2);
        if (!is_numeric($value) || $amount <= 0) {
            Response::json(['error' => ['message' => "{$field} must be greater than zero"]], 422);
        }
        return $amount;
    }

    private static function number(string $prefix): string
    {
        return $prefix . '-' . gmdate('Ymd') . '-' . strtoupper(substr(str_replace('-', '', self::uuid()), 0, 8));
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
