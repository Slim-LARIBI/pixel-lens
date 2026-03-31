import { getCurrentUser, getUserWorkspaces } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function ScansListPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const workspaces = await getUserWorkspaces(user.id);
  const workspace = workspaces[0];

  if (!workspace) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">All Scans</h1>
          <p className="text-muted-foreground">View and manage your scan history</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No workspace found. Run your first scan to get started.
            </p>
            <Link href="/app/scan">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Run First Scan
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scans = await db.scan.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Scans</h1>
          <p className="text-muted-foreground">View and manage your scan history</p>
        </div>
        <Link href="/app/scan">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Scan
          </Button>
        </Link>
      </div>

      {scans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">No scans yet. Run your first scan to get started!</p>
            <Link href="/app/scan">
              <Button>Run First Scan</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scans.map((scan) => (
            <Link key={scan.id} href={`/app/scans/${scan.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-medium">{scan.url}</p>
                      <Badge variant="outline" className="text-xs">
                        {scan.profile}
                      </Badge>
                    </div>
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
                        <p className="text-3xl font-bold">{scan.overallScore}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
