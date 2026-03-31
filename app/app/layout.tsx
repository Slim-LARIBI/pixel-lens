import { redirect } from "next/navigation";
import { getCurrentUser, getUserWorkspaces } from "@/lib/session";
import Link from "next/link";
import { LayoutDashboard, Search, Settings, LogOut, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";

async function AppLayoutServer({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(user.id);

  if (workspaces.length === 0) {
    redirect("/onboarding");
  }

  const currentWorkspace = workspaces[0];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/50">
        <div className="flex h-full flex-col">
          <div className="border-b p-6">
            <Link href="/app" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary" />
              <span className="text-xl font-bold">PixelLens</span>
            </Link>
          </div>

          <div className="border-b p-4">
            <div className="rounded-lg bg-background p-3">
              <p className="text-sm font-medium">{currentWorkspace.name}</p>
              <p className="text-xs text-muted-foreground">{currentWorkspace.plan} Plan</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            <Link href="/app/dashboard">
              <Button variant="ghost" className="w-full justify-start">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>

            <Link href="/app/scan">
              <Button variant="ghost" className="w-full justify-start">
                <Search className="mr-2 h-4 w-4" />
                Run Scan
              </Button>
            </Link>

            <Link href="/app/scans">
              <Button variant="ghost" className="w-full justify-start">
                <Search className="mr-2 h-4 w-4" />
                All Scans
              </Button>
            </Link>

            <Link href="/app/stack-scan">
              <Button variant="ghost" className="w-full justify-start">
                <Boxes className="mr-2 h-4 w-4" />
                Detect Tech Stack
              </Button>
            </Link>

            <Link href="/app/settings">
              <Button variant="ghost" className="w-full justify-start">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </nav>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <form action="/api/auth/signout" method="post" className="mt-2">
              <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}

export default AppLayoutServer;