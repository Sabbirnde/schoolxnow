import { useState } from "react";
import { Link2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { phpApi } from "@/integrations/php-api/client";

export default function GuardianInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") || "");
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      await phpApi.academic.acceptGuardianInvitation(token);
      toast.success("Student access linked to your guardian account");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept invitation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <BrandLogo className="h-12 w-auto" />
          <div>
            <CardTitle>Link guardian access</CardTitle>
            <CardDescription>Sign in with the invited guardian email, then accept the secure invitation.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="guardian-token">Invitation token</Label>
            <Input id="guardian-token" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
          </div>
          <Button className="w-full" disabled={busy || token.length < 20} onClick={() => void accept()}>
            <Link2 className="mr-2 h-4 w-4" />{busy ? "Linking…" : "Accept invitation"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
