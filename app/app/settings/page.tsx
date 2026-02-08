import { getCurrentUser, getUserWorkspaces } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const workspaces = await getUserWorkspaces(user.id);
  const workspace = workspaces[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace settings</p>
      </div>

      {/* Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Your workspace information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Name</p>
            <p className="text-2xl font-bold">{workspace.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Slug</p>
            <p className="text-muted-foreground">{workspace.slug}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Plan</p>
            <Badge className="mt-1">{workspace.plan}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Email</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Name</p>
            <p className="text-muted-foreground">{user.name || "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Upgrade your plan to unlock more scans and features.
          </p>
          <Link href="/app/settings/billing">
            <Button>Manage Billing</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
