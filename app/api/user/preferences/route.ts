import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authConfig";
import { query } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

/**
 * GET /api/user/preferences
 * Returns the user's preferences (currently just starred_only)
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    starred_only: user.starred_only ?? false,
  });
}

/**
 * PATCH /api/user/preferences
 * Updates the user's preferences
 * Body: { starred_only: boolean }
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { starred_only } = body;

    if (typeof starred_only !== "boolean") {
      return NextResponse.json(
        { error: "starred_only must be a boolean" },
        { status: 400 },
      );
    }

    // Update the preference in the database
    await query(
      `UPDATE users
       SET starred_only = $1
       WHERE github_id = $2`,
      [starred_only, user.github_id],
    );

    // Revalidate all paths to ensure layout and pages re-fetch with new filter
    revalidatePath("/", "layout");

    return NextResponse.json({
      starred_only,
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
