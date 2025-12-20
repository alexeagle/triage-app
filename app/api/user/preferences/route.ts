import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authConfig";
import { query } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

/**
 * GET /api/user/preferences
 * Returns the user's preferences
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
    prefer_known_customers: user.prefer_known_customers ?? false,
    prefer_recent_activity: user.prefer_recent_activity ?? true,
    prefer_waiting_on_me: user.prefer_waiting_on_me ?? true,
    prefer_quick_wins: user.prefer_quick_wins ?? true,
  });
}

/**
 * PATCH /api/user/preferences
 * Updates the user's preferences
 * Body: { starred_only?: boolean, prefer_known_customers?: boolean, prefer_recent_activity?: boolean, prefer_waiting_on_me?: boolean, prefer_quick_wins?: boolean }
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
    const {
      starred_only,
      prefer_known_customers,
      prefer_recent_activity,
      prefer_waiting_on_me,
      prefer_quick_wins,
    } = body;

    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof starred_only === "boolean") {
      updates.push(`starred_only = $${paramIndex}`);
      values.push(starred_only);
      paramIndex++;
    }

    if (typeof prefer_known_customers === "boolean") {
      updates.push(`prefer_known_customers = $${paramIndex}`);
      values.push(prefer_known_customers);
      paramIndex++;
    }

    if (typeof prefer_recent_activity === "boolean") {
      updates.push(`prefer_recent_activity = $${paramIndex}`);
      values.push(prefer_recent_activity);
      paramIndex++;
    }

    if (typeof prefer_waiting_on_me === "boolean") {
      updates.push(`prefer_waiting_on_me = $${paramIndex}`);
      values.push(prefer_waiting_on_me);
      paramIndex++;
    }

    if (typeof prefer_quick_wins === "boolean") {
      updates.push(`prefer_quick_wins = $${paramIndex}`);
      values.push(prefer_quick_wins);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "At least one preference must be provided" },
        { status: 400 },
      );
    }

    // Add github_id as the last parameter
    values.push(user.github_id);

    // Update the preferences in the database
    await query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE github_id = $${paramIndex}`,
      values,
    );

    // Revalidate all paths to ensure layout and pages re-fetch with new filter
    revalidatePath("/", "layout");

    // Return updated preferences (fetch fresh from DB to ensure consistency)
    const updatedUser = await getCurrentUser();
    if (!updatedUser) {
      return NextResponse.json(
        { error: "Failed to fetch updated preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      starred_only: updatedUser.starred_only ?? false,
      prefer_known_customers: updatedUser.prefer_known_customers ?? false,
      prefer_recent_activity: updatedUser.prefer_recent_activity ?? true,
      prefer_waiting_on_me: updatedUser.prefer_waiting_on_me ?? true,
      prefer_quick_wins: updatedUser.prefer_quick_wins ?? true,
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
