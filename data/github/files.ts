/**
 * GitHub File Contents Fetching
 *
 * This module provides functions to fetch file contents from GitHub repositories.
 */

import { GitHubAPI } from "./client.js";
import { Repo } from "./repos.js";

/**
 * GitHub API response for file contents.
 */
export interface FileContent {
  type: "file" | "dir" | "symlink" | "submodule";
  encoding?: string;
  size: number;
  name: string;
  path: string;
  content?: string; // Base64 encoded if encoding is "base64"
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string | null;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

/**
 * Fetches file contents from a GitHub repository.
 *
 * @param repo - Repository object with owner and name
 * @param filePath - Path to the file in the repository (e.g., "CODEOWNERS")
 * @param api - GitHub API client instance
 * @returns File content or null if file doesn't exist
 */
export async function fetchRepoFile(
  repo: Repo,
  filePath: string,
  api: GitHubAPI,
): Promise<string | null> {
  try {
    const file = await api.request<FileContent>({
      method: "GET",
      url: "/repos/{owner}/{repo}/contents/{path}",
      owner: repo.owner.login,
      repo: repo.name,
      path: filePath,
    });

    // If it's not a file, return null
    if (file.type !== "file" || !file.content) {
      return null;
    }

    // Decode base64 content
    if (file.encoding === "base64") {
      return Buffer.from(file.content, "base64").toString("utf-8");
    }

    // If content is already decoded (shouldn't happen with GitHub API, but handle it)
    return file.content;
  } catch (error: unknown) {
    // If 404, file doesn't exist
    const status = (error as { status?: number })?.status;
    if (status === 404) {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}
