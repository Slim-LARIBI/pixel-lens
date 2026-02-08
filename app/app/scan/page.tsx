"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ScanPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If your app has a current workspace endpoint, keep it.
      // If it fails, runtime API can DEV-fallback.
      let workspaceId: string | undefined;

      try {
        const wsRes = await fetch("/api/workspaces/current");
        if (wsRes.ok) {
          const ws = await wsRes.json();
          workspaceId = ws?.id;
        }
      } catch {}

      const res = await fetch("/api/scans/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          ...(workspaceId ? { workspaceId } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Runtime scan failed");
      }

      toast({
        title: "Runtime scan started",
        description: "Scan completed. Opening report…",
      });

      if (!data?.id) {
        throw new Error("No scan id returned");
      }

      router.push(`/app/scans/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Run New Scan</h1>
        <p className="text-muted-foreground">Runtime audit (Playwright) — GA4/GTM/Meta signals</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>Enter your website URL to run a runtime tracking audit</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                This will open your site in a headless browser and capture tracking signals.
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running runtime scan...
                </>
              ) : (
                "Start Runtime Scan"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What we capture (Phase 2)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="font-medium">✓</span>
            <span>GTM container detection + dataLayer events</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium">✓</span>
            <span>GA4 collect requests + Measurement ID</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium">✓</span>
            <span>Meta Pixel network signals (basic)</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium">✓</span>
            <span>Consent hints (best-effort, next: auto-click)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}