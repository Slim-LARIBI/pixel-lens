import { getCurrentUser, getUserWorkspaces } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getWorkspaceUsage } from "@/lib/services/workspace";
import { getPlanLimits } from "@/lib/plans";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const workspaces = await getUserWorkspaces(user.id);
  const workspace = workspaces[0];

  const usage = await getWorkspaceUsage(workspace.id);
  const limits = getPlanLimits(workspace.plan);

  const recentScans = await db.scan.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const totalScans = await db.scan.count({
    where: { workspaceId: workspace.id },
  });

  const avgScore =
    recentScans.length > 0
      ? Math.round(
          recentScans
            .filter((s) => s.overallScore !== null)
            .reduce((sum, s) => sum + (s.overallScore || 0), 0) / recentScans.filter((s) => s.overallScore !== null).length
        )
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name || user.email}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalScans}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage.scansCount} / {limits.scansPerMonth}
            </div>
            <Progress value={(usage.scansCount / limits.scansPerMonth) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore}/100</div>
            <p className="text-xs text-muted-foreground">Last 5 scans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspace.plan}</div>
            <Link href="/app/settings/billing">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                Manage plan
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with your next scan</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/app/scan">
            <Button>Run New Scan</Button>
          </Link>
          <Link href="/app/scans">
            <Button variant="outline">View All Scans</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Scans */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>Your latest scan results</CardDescription>
        </CardHeader>
        <CardContent>
          {recentScans.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No scans yet. Run your first scan to get started!</p>
              <Link href="/app/scan" className="mt-4 inline-block">
                <Button>Run First Scan</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentScans.map((scan) => (
                <Link key={scan.id} href={`/app/scans/${scan.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium">{scan.url}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(scan.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={
                          scan.status === "DONE"
                            ? "success"
                            : scan.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {scan.status}
                      </Badge>
                      {scan.overallScore !== null && (
                        <div className="text-right">
                          <p className="text-2xl font-bold">{scan.overallScore}</p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
