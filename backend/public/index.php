<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

use SchoolXNow\Api\AuthController;
use SchoolXNow\Api\AcademicController;
use SchoolXNow\Api\BillingController;
use SchoolXNow\Api\TableController;
use SchoolXNow\Api\UploadController;
use SchoolXNow\Core\Response;
use SchoolXNow\Core\Router;
use SchoolXNow\Core\Database;

$router = new Router();

$router->get('/health', function (): void {
    try {
        $value = Database::connection()->query('SELECT 1')->fetchColumn();
        Response::json([
            'ok' => (int) $value === 1,
            'service' => 'schoolxnow-php-api',
            'checks' => ['database' => 'ok'],
            'time' => gmdate('c'),
        ]);
    } catch (Throwable) {
        Response::json([
            'ok' => false,
            'service' => 'schoolxnow-php-api',
            'checks' => ['database' => 'unavailable'],
            'time' => gmdate('c'),
        ], 503);
    }
});

$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/register-school', [AuthController::class, 'registerSchool']);
$router->get('/public/schools', [AuthController::class, 'publicSchools']);
$router->get('/auth/me', [AuthController::class, 'me']);
$router->post('/auth/teacher-application', [AuthController::class, 'submitTeacherApplication']);
$router->patch('/auth/profile', [AuthController::class, 'updateProfile']);
$router->post('/auth/change-password', [AuthController::class, 'changePassword']);
$router->post('/auth/request-password-reset', [AuthController::class, 'requestPasswordReset']);
$router->post('/auth/reset-password', [AuthController::class, 'resetPassword']);
$router->post('/auth/teacher-portal-link', [AuthController::class, 'createTeacherPortalLink']);
$router->post('/auth/teacher-portal-login', [AuthController::class, 'loginWithTeacherPortalToken']);
$router->post('/auth/logout', [AuthController::class, 'logout']);

$router->get('/bootstrap/status', [AuthController::class, 'bootstrapStatus']);
$router->post('/bootstrap/create-super-admin', [AuthController::class, 'createSuperAdmin']);

$router->post('/academic/bulk-enroll', [AcademicController::class, 'bulkEnroll']);
$router->post('/academic/promote', [AcademicController::class, 'promote']);
$router->post('/academic/admissions/{id}/accept', [AcademicController::class, 'acceptAdmission']);
$router->post('/academic/guardian-invitations', [AcademicController::class, 'inviteGuardian']);
$router->post('/academic/accept-guardian-invitation', [AcademicController::class, 'acceptGuardianInvitation']);
$router->post('/billing/invoices/generate', [BillingController::class, 'generateInvoices']);
$router->post('/billing/invoices/{id}/adjustments', [BillingController::class, 'addAdjustment']);
$router->post('/billing/payments', [BillingController::class, 'recordPayment']);

$router->get('/tables/{table}', [TableController::class, 'index']);
$router->get('/tables/{table}/count', [TableController::class, 'count']);
$router->post('/tables/{table}', [TableController::class, 'store']);
$router->get('/tables/{table}/{id}', [TableController::class, 'show']);
$router->patch('/tables/{table}/{id}', [TableController::class, 'update']);
$router->delete('/tables/{table}/{id}', [TableController::class, 'destroy']);

$router->post('/uploads/{bucket}', [UploadController::class, 'store']);

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
