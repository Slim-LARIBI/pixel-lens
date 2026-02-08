"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginErrorPage() {
  const params = useSearchParams();
  const error = params.get("error") || "Unknown";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 text-center">
        <h1 className="text-2xl font-bold">Sign-in error</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An error occurred during sign in: <span className="font-mono">{error}</span>
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/login">Back to login</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}