import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authConfig";
import { getCurrentUser } from "../../../lib/auth";
import { getNextWorkItem, type WorkItemPreferences } from "../../../lib/nextWorkItem";

/**
 * GET /api/next-work-item
 * Returns the next work item recommendation, excluding snoozed items.
 *
 * Query params:
 *   snoozedItems - JSON stringified array of { type: 'issue'|'pr', id: number }
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Parse snoozed items from query parameter
    const snoozedItemsParam = request.nextUrl.searchParams.get("snoozedItems");
    let snoozedItems: Array<{ type: "issue" | "pr"; id: number }> = [];

    if (snoozedItemsParam) {
      try {
        snoozedItems = JSON.parse(snoozedItemsParam);
      } catch (error) {
        console.warn("Invalid snoozedItems parameter:", error);
      }
    }

    // Get user preferences for ranking
    const preferences: WorkItemPreferences = {
      prefer_known_customers: user.prefer_known_customers ?? false,
      prefer_recent_activity: user.prefer_recent_activity ?? true,
      prefer_waiting_on_me: user.prefer_waiting_on_me ?? true,
      prefer_quick_wins: user.prefer_quick_wins ?? true,
    };

    // Include scoring details for troubleshooting when user is "alexeagle" or "jbedard"
    const includeScoring = user.login === "alexeagle" || user.login === "jbedard";

    const nextWorkItem = await getNextWorkItem(
      user.github_id,
      preferences,
      snoozedItems,
      includeScoring,
    );

    return NextResponse.json({
      item: nextWorkItem,
    });
  } catch (error) {
    console.error("Error fetching next work item:", error);
    return NextResponse.json(
      { error: "Failed to fetch next work item" },
      { status: 500 },
    );
  }
}
