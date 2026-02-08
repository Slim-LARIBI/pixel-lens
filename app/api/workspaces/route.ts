import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { createWorkspace } from "@/lib/services/workspace";
import { workspaceSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate
    const validated = workspaceSchema.parse(body);

    // Create workspace
    const workspace = await createWorkspace(user.id, validated.name, validated.slug);

    return NextResponse.json(workspace);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
