/**
 * Module Access Denied Component
 * Displayed when a user attempts to access a restricted module
 */

import { AlertCircle, Lock, Home, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AccessDeniedProps {
  moduleId: string;
  moduleName?: string;
  reason?: string;
  onBackToDashboard?: () => void;
}

/**
 * Displays an error message when user lacks permission for a module
 */
export function AccessDeniedFallback({
  moduleId,
  moduleName,
  reason,
  onBackToDashboard,
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md border-red-200 bg-red-50/50">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-red-100">
              <Lock className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-900">Access Restricted</CardTitle>
          </div>
          <CardDescription className="text-red-700">
            You don't have permission to access this module
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 p-4 rounded-lg bg-white border border-red-100">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-red-900">Module</p>
                <p className="text-sm text-red-700">
                  {moduleName || moduleId}
                </p>
              </div>
            </div>
            {reason && (
              <div className="flex gap-2 pt-3 border-t border-red-100">
                <HelpCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-red-900">Reason</p>
                  <p className="text-sm text-red-700">{reason}</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            This module is not available for your user role. If you believe
            this is incorrect, please contact your administrator.
          </p>

          <Button
            onClick={onBackToDashboard}
            className="w-full"
            variant="outline"
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Lightweight inline access denied message
 */
export function AccessDeniedInline({
  moduleId,
  moduleName,
  reason,
}: Omit<AccessDeniedProps, "onBackToDashboard">) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-6">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <Lock className="h-6 w-6 text-red-600" />
        </div>
        <div className="space-y-2 flex-grow">
          <h3 className="font-semibold text-red-900">Access Restricted</h3>
          <p className="text-sm text-red-700">
            You don't have permission to access the {moduleName || moduleId}{" "}
            module.
          </p>
          {reason && (
            <p className="text-xs text-red-600 mt-2">
              <span className="font-medium">Reason:</span> {reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton/empty state for loading modules
 */
export function ModuleLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-muted rounded-lg animate-pulse w-1/3" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 bg-muted rounded-lg animate-pulse" />
        <div className="h-20 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
