import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { resolve } from "path";
import { logger } from "./logger";

// Default to HTTPS port, fallback to HTTP if specified
const USE_HTTP = process.env.OBSIDIAN_USE_HTTP === "true";
const PORT = USE_HTTP ? 27123 : 27124;
const PROTOCOL = USE_HTTP ? "http" : "https";
const HOST = process.env.OBSIDIAN_HOST || "127.0.0.1";
export const BASE_URL = `${PROTOCOL}://${HOST}:${PORT}`;

// Disable TLS certificate validation for local self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * Makes a request to the Obsidian Local REST API with the provided path and optional request options.
 * Automatically adds the required API key to the request headers.
 * Throws an `McpError` if the API response is not successful.
 *
 * @param path - The path to the Obsidian API endpoint.
 * @param init - Optional request options to pass to the `fetch` function.
 * @returns The response from the Obsidian API.
 */

export async function makeRequest<
  T extends
  | Type<{}, {}>
  | Type<null | undefined, {}>
  | Type<{} | null | undefined, {}>,
>(schema: T, path: string, init?: RequestInit): Promise<T["infer"]> {
  const API_KEY = process.env.OBSIDIAN_API_KEY;
  if (!API_KEY) {
    logger.error("OBSIDIAN_API_KEY environment variable is required", {
      env: process.env,
    });
    throw new Error("OBSIDIAN_API_KEY environment variable is required");
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "text/markdown",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    const message = `${init?.method ?? "GET"} ${path} ${response.status}: ${error}`;
    throw new McpError(ErrorCode.InternalError, message);
  }

  const isJSON = !!response.headers.get("Content-Type")?.includes("json");
  const data = isJSON ? await response.json() : await response.text();
  // 204 No Content responses should be validated as undefined
  const validated = response.status === 204 ? undefined : schema(data);
  if (validated instanceof type.errors) {
    const stackError = new Error();
    Error.captureStackTrace(stackError, makeRequest);
    logger.error("Invalid response from Obsidian API", {
      status: response.status,
      error: validated.summary,
      stack: stackError.stack,
      data,
    });
    throw new McpError(
      ErrorCode.InternalError,
      `${init?.method ?? "GET"} ${path} ${response.status}: ${validated.summary}`,
    );
  }

  return validated;
}

// Cache vault path to avoid repeated API calls
let cachedVaultPath: string | null = null;
let detectedManifestDir: string | null = null;

/**
 * Gets the vault path, either from environment variable or by auto-detecting
 * from the Obsidian API's manifest.dir field.
 */
export async function getVaultPath(): Promise<string | null> {
  if (cachedVaultPath) return cachedVaultPath;

  // Check environment variable first (preferred method)
  if (process.env.OBSIDIAN_VAULT_PATH) {
    cachedVaultPath = process.env.OBSIDIAN_VAULT_PATH;
    return cachedVaultPath;
  }

  // Auto-detect from API status
  const API_KEY = process.env.OBSIDIAN_API_KEY;
  if (!API_KEY) return null;

  try {
    const response = await fetch(`${BASE_URL}/`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await response.json();
    // manifest.dir should be like "/path/to/vault/.obsidian/plugins/local-rest-api"
    // Go up 3 directories to get vault root
    if (data.manifest?.dir) {
      detectedManifestDir = data.manifest.dir;
      // Only use if it looks like a valid absolute path
      if (data.manifest.dir.startsWith("/") && data.manifest.dir.includes(".obsidian")) {
        cachedVaultPath = resolve(data.manifest.dir, "../../..");
        return cachedVaultPath;
      }
    }
  } catch {
    // Fall through - will return null
  }

  return null;
}

export function getDetectedManifestDir(): string | null {
  return detectedManifestDir;
}
