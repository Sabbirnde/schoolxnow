import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { validateEnvironmentVariables, diagnoseConfiguration } from "@/lib/config-validator";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ConfigDebug = () => {
  const navigate = useNavigate();
  const report = validateEnvironmentVariables();
  const apiStatus = {
    isConfigured: Boolean(import.meta.env.VITE_API_URL),
    url: import.meta.env.VITE_API_URL || "Not set",
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
  };

  const handleRunDiagnostics = () => {
    diagnoseConfiguration();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Configuration Debug</h1>
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {report.valid ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Configuration Valid
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-destructive" />
                  Configuration Invalid
                </>
              )}
            </CardTitle>
            <CardDescription>PHP/MySQL backend environment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <Badge variant={report.valid ? "default" : "destructive"}>
                  {report.valid ? "Healthy" : "Issues Detected"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Errors:</span>
                <Badge variant={report.errors.length > 0 ? "destructive" : "outline"}>
                  {report.errors.length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {report.errors.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Errors Found</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {report.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {report.warnings.length > 0 && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warnings</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {report.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>PHP API Status</CardTitle>
            <CardDescription>Client initialization details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between border-b py-2">
                <span className="font-semibold">Configured:</span>
                <Badge variant={apiStatus.isConfigured ? "default" : "destructive"}>
                  {apiStatus.isConfigured ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b py-2">
                <span className="font-semibold">URL:</span>
                <span className="text-muted-foreground">{apiStatus.url}</span>
              </div>
              <div className="flex items-center justify-between border-b py-2">
                <span className="font-semibold">Mode:</span>
                <span className="text-muted-foreground">{apiStatus.mode}</span>
              </div>
              <div className="flex items-center justify-between border-b py-2">
                <span className="font-semibold">Backend:</span>
                <span className="text-muted-foreground">php</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold">Development:</span>
                <Badge variant={apiStatus.isDev ? "default" : "outline"}>
                  {apiStatus.isDev ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting Actions</CardTitle>
            <CardDescription>Tools to help diagnose configuration issues</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleRunDiagnostics} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Run Full Diagnostics
            </Button>

            {!report.valid && (
              <Alert>
                <AlertTitle>Quick Fix Steps:</AlertTitle>
                <AlertDescription>
                  <ol className="mt-2 list-inside list-decimal space-y-2">
                    <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
                    <li>Set <code>VITE_API_URL</code> to your PHP API URL.</li>
                    <li>Restart the development server.</li>
                    <li>Refresh this page.</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfigDebug;
