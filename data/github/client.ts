/**
 * GitHub REST API Client
 *
 * This module provides a wrapper around the GitHub REST API with:
 * - Automatic retry logic for transient failures
 * - Rate limit handling and backoff
 * - Automatic token injection (supports both PAT and installation tokens)
 *
 * Authentication priority:
 * 1. GITHUB_TOKEN or GITHUB_PAT environment variable (Personal Access Token)
 * 2. GitHub App installation token (via APP_ID, PRIVATE_KEY, INSTALLATION_ID)
 */

import { request } from "@octokit/request";
import { githubInstallationAuth } from "./auth.js";

interface RequestOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export class GitHubAPI {
  private installationToken: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Gets a valid authentication token.
   * If GITHUB_TOKEN or GITHUB_PAT is set, uses that (Personal Access Token).
   * Otherwise, falls back to GitHub App installation token.
   */
  private async getToken(): Promise<string> {
    // Check for Personal Access Token first (for when installation is rate-limited)
    const pat = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
    if (pat) {
      return pat;
    }

    // Fall back to installation token
    const now = Date.now();
    // Refresh token if expired or expiring soon (within 5 minutes)
    if (!this.installationToken || this.tokenExpiresAt < now + 5 * 60 * 1000) {
      this.installationToken = await githubInstallationAuth();
      // Installation tokens typically expire in 1 hour
      this.tokenExpiresAt = now + 60 * 60 * 1000;
    }
    return this.installationToken;
  }

  /**
   * Makes a request to the GitHub API with automatic retries and rate limit handling.
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const token = await this.getToken();
        const response = await request({
          ...options,
          headers: {
            ...options.headers,
            authorization: `token ${token}`,
            // Use custom Accept header if provided, otherwise default to v3
            accept: options.headers?.accept || "application/vnd.github.v3+json",
          },
        });

        return response.data as T;
      } catch (error: unknown) {
        if (attempt === maxRetries) {
          throw error;
        }

        // @octokit/request errors have status and response.headers
        const status = (error as { status?: number })?.status;
        const response = (
          error as {
            response?: { headers?: Record<string, string | string[]> };
          }
        )?.response;
        const headers = response?.headers;

        // Handle rate limiting (429)
        if (status === 429) {
          const resetTime = headers?.["x-ratelimit-reset"];
          const resetTimeStr = Array.isArray(resetTime)
            ? resetTime[0]
            : resetTime;
          if (resetTimeStr) {
            const resetTimestamp = parseInt(String(resetTimeStr), 10) * 1000;
            const now = Date.now();
            const sleepDuration = Math.max(0, resetTimestamp - now) + 1000; // Add 1s buffer

            console.warn(
              `Rate limit hit. Sleeping until ${new Date(resetTimestamp).toISOString()} (${Math.ceil(sleepDuration / 1000)}s)`,
            );
            await this.sleep(sleepDuration);
            continue;
          }
        }

        // Handle server errors (5xx) with exponential backoff
        if (status && status >= 500) {
          const backoffDelay = Math.min(
            baseDelay * Math.pow(2, attempt - 1),
            30000,
          ); // Max 30s
          console.warn(
            `Server error ${status}. Retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})`,
          );
          await this.sleep(backoffDelay);
          continue;
        }

        // For other errors, don't retry
        throw error;
      }
    }

    throw new Error("Max retries exceeded");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
