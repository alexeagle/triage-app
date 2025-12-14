import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authConfig";
import { query } from "../../../../lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

interface LLMResponse {
  summary: {
    core_issue: string;
    current_state: string;
    last_meaningful_update_days_ago: number;
    involved_users: {
      maintainers: string[];
      contributors: string[];
    };
  };
  signals: {
    needs_info: boolean;
    likely_stale: boolean;
    blocked: boolean;
  };
  suggested_next_steps: Array<{
    type: "ask_for_repro" | "add_label" | "request_review" | "close_stale";
    confidence: number;
  }>;
}

/**
 * Calls OpenAI API to generate a summary for a work item
 */
async function callLLM(
  systemPrompt: string,
  schema: unknown,
  workItemContext: unknown,
): Promise<{
  response: LLMResponse;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const userPrompt = `Work item context:
${JSON.stringify(workItemContext, null, 2)}

JSON Schema:
${JSON.stringify(schema, null, 2)}

Return only valid JSON matching the schema.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  const parsed = JSON.parse(content) as LLMResponse;
  return {
    response: parsed,
    usage: data.usage,
  };
}

/**
 * Validates the LLM response against the schema
 */
function validateResponse(response: unknown): response is LLMResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }

  const r = response as Record<string, unknown>;

  // Check required top-level fields
  if (!r.summary || !r.signals || !r.suggested_next_steps) {
    return false;
  }

  // Validate summary
  const summary = r.summary as Record<string, unknown>;
  if (
    typeof summary.core_issue !== "string" ||
    typeof summary.current_state !== "string" ||
    typeof summary.last_meaningful_update_days_ago !== "number" ||
    !summary.involved_users
  ) {
    return false;
  }

  const involvedUsers = summary.involved_users as Record<string, unknown>;
  if (
    !Array.isArray(involvedUsers.maintainers) ||
    !Array.isArray(involvedUsers.contributors)
  ) {
    return false;
  }
  if (
    !involvedUsers.maintainers.every((u) => typeof u === "string") ||
    !involvedUsers.contributors.every((u) => typeof u === "string")
  ) {
    return false;
  }

  // Validate signals
  const signals = r.signals as Record<string, unknown>;
  if (
    typeof signals.needs_info !== "boolean" ||
    typeof signals.likely_stale !== "boolean" ||
    typeof signals.blocked !== "boolean"
  ) {
    return false;
  }

  // Validate suggested_next_steps
  if (!Array.isArray(r.suggested_next_steps)) {
    return false;
  }
  const validTypes = [
    "ask_for_repro",
    "add_label",
    "request_review",
    "close_stale",
  ];
  for (const step of r.suggested_next_steps) {
    if (typeof step !== "object" || step === null) {
      return false;
    }
    const s = step as Record<string, unknown>;
    if (
      typeof s.type !== "string" ||
      !validTypes.includes(s.type) ||
      typeof s.confidence !== "number" ||
      s.confidence < 0 ||
      s.confidence > 1
    ) {
      return false;
    }
  }

  return true;
}

/**
 * POST /api/ai/next-work-item-summary
 * Generates an AI summary for a work item
 * Body: { workItemId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workItemId } = body;

    if (typeof workItemId !== "string" || workItemId.trim() === "") {
      return NextResponse.json(
        { error: "workItemId must be a non-empty string" },
        { status: 400 },
      );
    }

    const workItemGithubId = parseInt(workItemId, 10);
    if (isNaN(workItemGithubId)) {
      return NextResponse.json(
        { error: "workItemId must be a valid number" },
        { status: 400 },
      );
    }

    // Try to find as an issue first
    const issueResult = await query<{
      github_id: number;
      title: string;
      body: string | null;
      labels: unknown;
    }>(
      `SELECT github_id, title, body, labels
       FROM issues
       WHERE github_id = $1`,
      [workItemGithubId],
    );

    let workItemType: "issue" | "pull_request";
    let title: string;
    let workItemBody: string | null;
    let labels: unknown;

    if (issueResult.length > 0) {
      workItemType = "issue";
      title = issueResult[0].title;
      workItemBody = issueResult[0].body;
      labels = issueResult[0].labels;
    } else {
      // Try to find as a PR
      const prResult = await query<{
        github_id: number;
        title: string;
        body: string | null;
        labels: unknown;
      }>(
        `SELECT github_id, title, body, labels
         FROM pull_requests
         WHERE github_id = $1`,
        [workItemGithubId],
      );

      if (prResult.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      workItemType = "pull_request";
      title = prResult[0].title;
      workItemBody = prResult[0].body;
      labels = prResult[0].labels;
    }

    // Parse labels to get label names
    const labelsArray = Array.isArray(labels) ? labels : [];
    const labelNames = labelsArray
      .map((label: unknown) => {
        if (typeof label === "object" && label !== null && "name" in label) {
          return String(label.name);
        }
        return null;
      })
      .filter((name): name is string => name !== null);

    // Get last 10 comments
    const commentsResult = await query<{
      author_login: string;
      body: string | null;
      created_at: string;
    }>(
      `SELECT ic.author_login, ic.body, ic.created_at
       FROM issue_comments ic
       WHERE ic.issue_github_id = $1
       ORDER BY ic.created_at DESC
       LIMIT 10`,
      [workItemGithubId],
    );

    // Get unique participants with their maintainer status and last comment time
    const participantsResult = await query<{
      github_login: string;
      is_maintainer: boolean | null;
      last_commented_at: string;
      type: string | null;
    }>(
      `SELECT DISTINCT
         ic.author_login as github_login,
         gu.is_maintainer,
         MAX(ic.created_at) as last_commented_at,
         gu.type
       FROM issue_comments ic
       LEFT JOIN github_users gu ON ic.author_login = gu.login
       WHERE ic.issue_github_id = $1
       GROUP BY ic.author_login, gu.is_maintainer, gu.type
       ORDER BY MAX(ic.created_at) DESC`,
      [workItemGithubId],
    );

    // Filter participants: exclude bots unless they are maintainers
    const participants = participantsResult
      .filter((p) => {
        const isBot =
          p.type === "Bot" || p.github_login.toLowerCase().includes("bot");
        return !isBot || p.is_maintainer === true;
      })
      .map((p) => ({
        github_login: p.github_login,
        is_maintainer: p.is_maintainer === true,
        last_commented_at: p.last_commented_at,
      }));

    // Get comment authors' maintainer status for comments
    const commentAuthors = Array.from(
      new Set(commentsResult.map((c) => c.author_login)),
    );
    const authorMaintainerStatus =
      commentAuthors.length > 0
        ? await query<{
            login: string;
            is_maintainer: boolean | null;
            type: string | null;
          }>(
            `SELECT login, is_maintainer, type
               FROM github_users
               WHERE login = ANY($1)`,
            [commentAuthors],
          )
        : [];

    const maintainerMap = new Map(
      authorMaintainerStatus.map((a) => [a.login, a.is_maintainer === true]),
    );
    const botMap = new Map(
      authorMaintainerStatus.map((a) => [
        a.login,
        a.type === "Bot" || a.login.toLowerCase().includes("bot"),
      ]),
    );

    // Build comments array, excluding bots unless they're maintainers
    // Also exclude comments with null or empty bodies (they have no content)
    const comments = commentsResult
      .reverse() // Reverse to get chronological order (oldest first)
      .filter((c) => {
        const isBot = botMap.get(c.author_login) ?? false;
        const isMaintainer = maintainerMap.get(c.author_login) ?? false;
        // Include if not a bot, or if bot is a maintainer
        // Also exclude comments with no content
        return (!isBot || isMaintainer) && c.body && c.body.trim().length > 0;
      })
      .map((c) => ({
        author_github_login: c.author_login,
        author_is_maintainer: maintainerMap.get(c.author_login) ?? false,
        body: c.body, // Comment content/text
        created_at: c.created_at,
      }));

    const workItemContext = {
      type: workItemType,
      title,
      body: workItemBody,
      labels: labelNames,
      participants,
      comments,
    };

    // Load prompt and schema files
    const promptPath = join(
      process.cwd(),
      "prompts",
      "next_task_summary.prompt.txt",
    );
    const schemaPath = join(
      process.cwd(),
      "prompts",
      "next_task_summary.schema.json",
    );

    const [systemPrompt, schemaJson] = await Promise.all([
      readFile(promptPath, "utf-8"),
      readFile(schemaPath, "utf-8"),
    ]);

    const schema = JSON.parse(schemaJson);

    // Call LLM with timing
    const startTime = Date.now();
    console.log("LLM call started", { workItemId });

    let llmResult;
    try {
      llmResult = await callLLM(systemPrompt, schema, workItemContext);
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error("LLM call failed", { latency_ms: latency, error });
      return NextResponse.json(
        { error: "Failed to generate AI summary" },
        { status: 500 },
      );
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    // Validate response
    if (!validateResponse(llmResult.response)) {
      console.error("Invalid LLM response", {
        latency_ms: latency,
        response: llmResult.response,
      });
      return NextResponse.json(
        { error: "Invalid AI response" },
        { status: 502 },
      );
    }

    // Log completion with timing and token usage
    console.log("LLM call completed", {
      latency_ms: latency,
      usage: llmResult.usage,
    });

    return NextResponse.json(llmResult.response);
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
