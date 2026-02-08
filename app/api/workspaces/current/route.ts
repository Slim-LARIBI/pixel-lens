import { NextResponse } from "next/server";
import { requireAuth, getUserWorkspaces } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireAuth();
    const workspaces = await getUserWorkspaces(user.id);

    if (workspaces.length === 0) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    return NextResponse.json(workspaces[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
