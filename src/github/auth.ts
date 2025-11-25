/**
 * GitHub App Authentication Helpers
 *
 * This module provides authentication functions for GitHub App integration.
 *
 * Environment variables:
 * - APP_ID: GitHub App ID
 * - PRIVATE_KEY: GitHub App private key (PEM format)
 * - INSTALLATION_ID: GitHub App installation ID
 */

import { App } from "@octokit/app";
import { createSign } from "crypto";

let appInstance: App | null = null;

function getApp(): App {
  if (!appInstance) {
    const appId = process.env.APP_ID;
    const privateKey = process.env.PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error(
        "APP_ID and PRIVATE_KEY environment variables are required",
      );
    }

    appInstance = new App({
      appId,
      privateKey,
    });
  }

  return appInstance;
}

/**
 * Authenticates as a GitHub App and returns a JWT token.
 * The JWT can be used to authenticate as the app itself.
 */
export async function githubAppAuth(): Promise<string> {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "APP_ID and PRIVATE_KEY environment variables are required",
    );
  }

  // Generate JWT token for GitHub App authentication
  // JWT format: header.payload.signature
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iat: now - 60, // Issued at (allow 60s clock skew)
    exp: now + 600, // Expires in 10 minutes (GitHub max)
    iss: parseInt(appId, 10), // Issuer is the app ID
  };

  // Encode header and payload as base64url
  const encodeBase64Url = (obj: unknown): string => {
    return Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const encodedHeader = encodeBase64Url(header);
  const encodedPayload = encodeBase64Url(payload);

  // Sign the token
  const sign = createSign("RSA-SHA256");
  sign.write(`${encodedHeader}.${encodedPayload}`);
  sign.end();

  const signature = sign
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Authenticates as a GitHub App installation and returns an installation access token.
 * This token is used for making API calls on behalf of the installation.
 */
export async function githubInstallationAuth(): Promise<string> {
  const app = getApp();
  const installationId = parseInt(process.env.INSTALLATION_ID || "0", 10);

  if (!installationId) {
    throw new Error("INSTALLATION_ID environment variable is required");
  }

  // @octokit/app's getInstallationOctokit returns an authenticated Octokit instance
  // We can get the token from the Octokit instance's auth() method
  const octokit = await app.getInstallationOctokit(installationId);

  // Get the authentication token from the Octokit instance
  const auth = await octokit.auth({ type: "installation" });

  // The auth result contains a token property
  const authResult = auth as { token?: string };

  if (!authResult || !authResult.token) {
    throw new Error("Failed to get installation token from Octokit instance");
  }

  return authResult.token;
}
