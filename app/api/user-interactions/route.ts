/**
 * User Interactions API
 *
 * Returns detailed interaction information for a user from a specific company.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authConfig";
import { getUserInteractionDetails } from "../../../lib/queriesUserInteractions";

/**
 * GET /api/user-interactions?userGithubId=123&companyName=Example%20Corp
 * Gets interaction details for a user from a specific company
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const userGithubId = searchParams.get("userGithubId");
  const companyName = searchParams.get("companyName");

  if (!userGithubId || !companyName) {
    return NextResponse.json(
      { error: "userGithubId and companyName parameters are required" },
      { status: 400 },
    );
  }

  try {
    const interactions = await getUserInteractionDetails(
      parseInt(userGithubId, 10),
      companyName,
    );

    return NextResponse.json({ interactions });
  } catch (error) {
    console.error("Error fetching user interactions:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 },
    );
  }
}
