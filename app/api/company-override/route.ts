/**
 * Company Override API
 *
 * Handles setting and clearing company overrides for GitHub users.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authConfig";
import { isCurrentUserEngineeringMember } from "../../../lib/auth";
import {
  upsertCompanyOverride,
  deleteCompanyOverride,
} from "../../../data/db/companyOverrides";
import { query } from "../../../data/db/index";

/**
 * GET /api/company-override?githubUserId=123
 * Gets the current override for a GitHub user
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Require aspect-build membership
  const isMember = await isCurrentUserEngineeringMember();
  if (!isMember) {
    return NextResponse.json(
      { error: "Forbidden: aspect-build membership required" },
      { status: 403 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const githubUserId = searchParams.get("githubUserId");

  if (!githubUserId) {
    return NextResponse.json(
      { error: "githubUserId parameter is required" },
      { status: 400 },
    );
  }

  try {
    // First, get the user and available sources
    const userResult = await query(
      `SELECT 
        gu.github_id,
        ghm.company as github_company,
        crmm.company_name as commonroom_company
       FROM github_users gu
       LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
       LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
       WHERE gu.github_id = $1`,
      [parseInt(githubUserId, 10)],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Try to get override if it exists (table might not exist yet)
    let override = null;
    try {
      const overrideResult = await query(
        `SELECT github_user_id, override_company_name, override_source, updated_at
         FROM company_overrides
         WHERE github_user_id = $1`,
        [parseInt(githubUserId, 10)],
      );

      if (overrideResult.rows.length > 0) {
        override = overrideResult.rows[0];
      }
    } catch (overrideError) {
      // Table doesn't exist yet - that's okay, just return null override
      console.warn(
        "company_overrides table may not exist yet:",
        overrideError instanceof Error
          ? overrideError.message
          : String(overrideError),
      );
    }

    return NextResponse.json({
      override: override
        ? {
            github_user_id: override.github_user_id,
            override_company_name: override.override_company_name,
            override_source: override.override_source,
            updated_at: override.updated_at,
          }
        : null,
      availableSources: {
        github: user.github_company,
        commonroom: user.commonroom_company,
      },
    });
  } catch (error) {
    console.error("Error fetching company override:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
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

/**
 * POST /api/company-override
 * Sets or updates a company override
 * Body: { githubUserId: number, overrideCompanyName?: string, overrideSource?: 'manual' | 'github' | 'commonroom' }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Require aspect-build membership
  const isMember = await isCurrentUserEngineeringMember();
  if (!isMember) {
    return NextResponse.json(
      { error: "Forbidden: aspect-build membership required" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { githubUserId, overrideCompanyName, overrideSource } = body;

    if (!githubUserId) {
      return NextResponse.json(
        { error: "githubUserId is required" },
        { status: 400 },
      );
    }

    if (
      overrideSource &&
      !["manual", "github", "commonroom"].includes(overrideSource)
    ) {
      return NextResponse.json(
        { error: "Invalid overrideSource" },
        { status: 400 },
      );
    }

    await upsertCompanyOverride({
      github_user_id: parseInt(githubUserId, 10),
      override_company_name: overrideCompanyName || null,
      override_source: overrideSource || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting company override:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/company-override?githubUserId=123
 * Clears a company override
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Require aspect-build membership
  const isMember = await isCurrentUserEngineeringMember();
  if (!isMember) {
    return NextResponse.json(
      { error: "Forbidden: aspect-build membership required" },
      { status: 403 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const githubUserId = searchParams.get("githubUserId");

  if (!githubUserId) {
    return NextResponse.json(
      { error: "githubUserId parameter is required" },
      { status: 400 },
    );
  }

  try {
    await deleteCompanyOverride(parseInt(githubUserId, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting company override:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
