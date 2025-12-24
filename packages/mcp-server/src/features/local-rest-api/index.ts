import { makeRequest, getVaultPath, getDetectedManifestDir, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type } from "arktype";
import { stat } from "fs/promises";
import { join } from "path";
import { LocalRestAPI } from "shared";

export function registerLocalRestApiTools(tools: ToolRegistry, server: Server) {
  // GET Status
  tools.register(
    type({
      name: '"get_server_info"',
      arguments: "Record<string, unknown>",
    }).describe(
      "Returns basic details about the Obsidian Local REST API and authentication status. This is the only API request that does not require authentication.",
    ),
    async () => {
      const data = await makeRequest(LocalRestAPI.ApiStatusResponse, "/");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Active File
  tools.register(
    type({
      name: '"get_active_file"',
      arguments: {
        format: type('"markdown" | "json"').optional(),
      },
    }).describe(
      "Returns the content of the currently active file in Obsidian. Can return either markdown content or a JSON representation including parsed tags and frontmatter.",
    ),
    async ({ arguments: args }) => {
      const format =
        args?.format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";
      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson.or("string"),
        "/active/",
        {
          headers: { Accept: format },
        },
      );
      const content =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return { content: [{ type: "text", text: content }] };
    },
  );

  // PUT Active File
  tools.register(
    type({
      name: '"update_active_file"',
      arguments: {
        content: "string",
      },
    }).describe("Update the content of the active file open in Obsidian."),
    async ({ arguments: args }) => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "PUT",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "File updated successfully" }],
      };
    },
  );

  // POST Active File
  tools.register(
    type({
      name: '"append_to_active_file"',
      arguments: {
        content: "string",
      },
    }).describe("Append content to the end of the currently-open note."),
    async ({ arguments: args }) => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "POST",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Active File
  tools.register(
    type({
      name: '"patch_active_file"',
      arguments: LocalRestAPI.ApiPatchParameters,
    }).describe(
      "Insert or modify content in the currently-open note relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      const headers: Record<string, string> = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: args.target,
        "Create-Target-If-Missing": "true",
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = args.targetDelimiter;
      }
      if (args.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
      }
      if (args.contentType) {
        headers["Content-Type"] = args.contentType;
      }

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        "/active/",
        {
          method: "PATCH",
          headers,
          body: args.content,
        },
      );
      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Active File
  tools.register(
    type({
      name: '"delete_active_file"',
      arguments: "Record<string, unknown>",
    }).describe("Delete the currently-active file in Obsidian."),
    async () => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "DELETE",
      });
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );

  // POST Open File in Obsidian UI
  tools.register(
    type({
      name: '"show_file_in_obsidian"',
      arguments: {
        filename: "string",
        "newLeaf?": "boolean",
      },
    }).describe(
      "Open a document in the Obsidian UI. Creates a new document if it doesn't exist. Returns a confirmation if the file was opened successfully.",
    ),
    async ({ arguments: args }) => {
      const query = args.newLeaf ? "?newLeaf=true" : "";

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/open/${encodeURIComponent(args.filename)}${query}`,
        {
          method: "POST",
        },
      );

      return {
        content: [{ type: "text", text: "File opened successfully" }],
      };
    },
  );

  // POST Search via Dataview or JsonLogic
  tools.register(
    type({
      name: '"search_vault"',
      arguments: {
        queryType: '"dataview" | "jsonlogic"',
        query: "string",
      },
    }).describe(
      "Search for documents matching a specified query using either Dataview DQL or JsonLogic.",
    ),
    async ({ arguments: args }) => {
      const contentType =
        args.queryType === "dataview"
          ? "application/vnd.olrapi.dataview.dql+txt"
          : "application/vnd.olrapi.jsonlogic+json";

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: args.query,
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // POST Simple Search
  tools.register(
    type({
      name: '"search_vault_simple"',
      arguments: {
        query: "string",
        "contextLength?": "number",
        "limit?": "number",
      },
    }).describe("Search for documents matching a text query. Returns file paths only."),
    async ({ arguments: args }) => {
      const query = new URLSearchParams({
        query: args.query,
        ...(args.contextLength
          ? {
              contextLength: String(args.contextLength),
            }
          : {}),
      });

      const data = await makeRequest(
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?${query}`,
        {
          method: "POST",
        },
      );

      const results = args.limit ? data.slice(0, args.limit) : data;
      const filePaths = results.map((r: { filename: string }) => r.filename);

      return {
        content: [{ type: "text", text: JSON.stringify(filePaths, null, 2) }],
      };
    },
  );

  // GET Vault Files or Directories List
  function encodePathSegments(path: string): string {
    return path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  }

  async function listFilesRecursively(dir: string): Promise<string[]> {
    const encodedDir = dir ? encodePathSegments(dir) + "/" : "";
    const { files } = await makeRequest(
      LocalRestAPI.ApiVaultDirectoryResponse,
      `/vault/${encodedDir}`,
    );

    const results: string[] = [];
    for (const file of files) {
      const fullPath = dir ? `${dir}/${file}` : file;
      if (file.endsWith("/")) {
        const subFiles = await listFilesRecursively(fullPath.slice(0, -1));
        results.push(...subFiles);
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  function matchesPattern(filename: string, pattern: string): boolean {
    const regex = new RegExp(
      "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(filename.split("/").pop() || "");
  }

  interface FileWithMeta {
    filename: string;
    mtime: number;
    ctime: number;
    size: number;
  }

  // Lenient type for file stats - only validates what we need
  const FileStatResponse = type({
    stat: {
      ctime: "number",
      mtime: "number",
      size: "number",
    },
    "+": "delete",  // Ignore all other fields (frontmatter, content, etc.)
  });

  // Process items in batches to avoid overwhelming the API
  async function batchProcess<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    batchSize: number = 50
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  async function getFileMetadata(filename: string): Promise<FileWithMeta> {
    // Try direct file system access first (much faster)
    const vaultPath = await getVaultPath();
    if (vaultPath) {
      try {
        const fullPath = join(vaultPath, filename);
        const stats = await stat(fullPath);
        return {
          filename,
          mtime: stats.mtimeMs,
          ctime: stats.ctimeMs,
          size: stats.size,
        };
      } catch {
        // Fall through to API fallback
      }
    }

    // Fallback to REST API
    try {
      const data = await makeRequest(
        FileStatResponse,
        `/vault/${encodePathSegments(filename)}`,
        {
          headers: { Accept: "application/vnd.olrapi.note+json" },
        },
      );
      return {
        filename,
        mtime: data.stat.mtime,
        ctime: data.stat.ctime,
        size: data.stat.size,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { filename, mtime: 0, ctime: 0, size: 0, error: errMsg } as FileWithMeta;
    }
  }

  tools.register(
    type({
      name: '"list_vault_files"',
      arguments: {
        "directory?": "string",
        "recursive?": "boolean",
        "pattern?": "string",
        "sortBy?": '"mtime" | "ctime" | "size" | "name"',
        "sortOrder?": '"asc" | "desc"',
        "limit?": "number",
      },
    }).describe(
      "List files in the vault. Use recursive=true for subdirectories, pattern for glob filtering, sortBy/sortOrder for sorting (mtime, ctime, size, name), and limit to cap results.",
    ),
    async ({ arguments: args }) => {
      let files: string[];

      if (args.recursive) {
        files = await listFilesRecursively(args.directory || "");
      } else {
        const encodedDir = args.directory ? encodePathSegments(args.directory) + "/" : "";
        const data = await makeRequest(
          LocalRestAPI.ApiVaultDirectoryResponse,
          `/vault/${encodedDir}`,
        );
        files = data.files
          .filter((f: string) => !f.endsWith("/"))
          .map((f: string) => args.directory ? `${args.directory}/${f}` : f);
      }

      if (args.pattern) {
        files = files.filter((f: string) => matchesPattern(f, args.pattern!));
      }

      if (args.sortBy) {
        const filesWithMeta = await batchProcess(
          files,
          (f: string) => getFileMetadata(f),
          50
        );

        const sortOrder = args.sortOrder || "desc";
        filesWithMeta.sort((a, b) => {
          let cmp: number;
          if (args.sortBy === "name") {
            cmp = a.filename.localeCompare(b.filename);
          } else {
            cmp = (a[args.sortBy as "mtime" | "ctime" | "size"] || 0) -
                  (b[args.sortBy as "mtime" | "ctime" | "size"] || 0);
          }
          return sortOrder === "desc" ? -cmp : cmp;
        });

        files = filesWithMeta.map((f: FileWithMeta) => f.filename);
      }

      if (args.limit) {
        files = files.slice(0, args.limit);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
      };
    },
  );

  // GET Recent Files
  tools.register(
    type({
      name: '"get_recent_files"',
      arguments: {
        "limit?": "number",
        "excludeFolders?": "string[]",
        "includeFolders?": "string[]",
        "pattern?": "string | string[]",
        "debug?": "boolean",
      },
    }).describe(
      "Get the most recent files across the vault (sorted by max of ctime/mtime). Returns path, mtime, ctime (ISO 8601), and size. Default limit is 20. Pattern can be a single glob or array of globs.",
    ),
    async ({ arguments: args }) => {
      const limit = args.limit || 20;

      // Get all files recursively
      let files: string[];
      if (args.includeFolders && args.includeFolders.length > 0) {
        const allFiles: string[] = [];
        for (const folder of args.includeFolders) {
          try {
            const folderFiles = await listFilesRecursively(folder);
            allFiles.push(...folderFiles);
          } catch {
            // Folder doesn't exist, skip it gracefully
          }
        }
        files = allFiles;
      } else {
        files = await listFilesRecursively("");
      }

      // Exclude folders
      if (args.excludeFolders) {
        files = files.filter((f: string) =>
          !args.excludeFolders!.some((folder: string) =>
            f.startsWith(folder + "/") || f === folder
          )
        );
      }

      // Apply pattern filter (supports single pattern or array of patterns)
      if (args.pattern) {
        const patterns = Array.isArray(args.pattern) ? args.pattern : [args.pattern];
        files = files.filter((f: string) =>
          patterns.some((p: string) => matchesPattern(f, p))
        );
      }

      // Debug: show enumerated files before metadata fetch
      if (args.debug) {
        const startTime = Date.now();
        const detectedVaultPath = await getVaultPath();

        const debugInfo = {
          vaultPath: detectedVaultPath,
          manifestDir: getDetectedManifestDir(),
          usingDirectFS: !!detectedVaultPath,
          totalFilesEnumerated: files.length,
          sampleFiles: files.slice(0, 20),
        };

        // Fetch metadata and sort by most recent time (max of ctime/mtime)
        const metadataStartTime = Date.now();
        const filesWithMeta = await batchProcess(
          files,
          (f: string) => getFileMetadata(f),
          50
        );
        const metadataTime = Date.now() - metadataStartTime;

        // Find files with zero timestamps (failed metadata)
        const failedFiles = filesWithMeta.filter(f => f.mtime === 0 && f.ctime === 0);

        filesWithMeta.sort((a, b) => {
          const aRecent = Math.max(a.mtime, a.ctime);
          const bRecent = Math.max(b.mtime, b.ctime);
          return bRecent - aRecent;
        });

        const results = filesWithMeta.slice(0, limit).map((f) => ({
          path: f.filename,
          mtime: f.mtime,
          ctime: f.ctime,
          size: f.size,
        }));

        const totalTime = Date.now() - startTime;

        return {
          content: [{ type: "text", text: JSON.stringify({
            timing: {
              totalMs: totalTime,
              metadataFetchMs: metadataTime,
              filesPerSecond: Math.round(files.length / (metadataTime / 1000)),
            },
            ...debugInfo,
            failedMetadataCount: failedFiles.length,
            failedFilesWithErrors: failedFiles.slice(0, 5).map(f => ({
              file: f.filename,
              error: (f as any).error
            })),
            results,
          }, null, 2) }],
        };
      }

      // Fetch metadata and sort by most recent time (max of ctime/mtime)
      const filesWithMeta = await batchProcess(
        files,
        (f: string) => getFileMetadata(f),
        50
      );
      filesWithMeta.sort((a, b) => {
        const aRecent = Math.max(a.mtime, a.ctime);
        const bRecent = Math.max(b.mtime, b.ctime);
        return bRecent - aRecent;
      });

      // Take top N and format response
      const results = filesWithMeta.slice(0, limit).map((f) => ({
        path: f.filename,
        mtime: new Date(f.mtime).toISOString(),
        ctime: new Date(f.ctime).toISOString(),
        size: f.size,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // GET Vault File Content
  tools.register(
    type({
      name: '"get_vault_file"',
      arguments: {
        filename: "string",
        "format?": '"markdown" | "json"',
      },
    }).describe("Get the content of a file from your vault."),
    async ({ arguments: args }) => {
      const isJson = args.format === "json";
      const format = isJson
        ? "application/vnd.olrapi.note+json"
        : "text/markdown";
      const data = await makeRequest(
        isJson ? LocalRestAPI.ApiNoteJson : LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          headers: { Accept: format },
        },
      );
      return {
        content: [
          {
            type: "text",
            text:
              typeof data === "string" ? data : JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // GET Multiple Vault Files Content
  tools.register(
    type({
      name: '"get_vault_files"',
      arguments: {
        filenames: "string[]",
      },
    }).describe(
      "Get the content of multiple files from your vault in a single request. Returns an array of objects with filename and content.",
    ),
    async ({ arguments: args }) => {
      const results = await Promise.all(
        args.filenames.map(async (filename: string) => {
          try {
            const content = await makeRequest(
              LocalRestAPI.ApiContentResponse,
              `/vault/${encodeURIComponent(filename)}`,
              {
                headers: { Accept: "text/markdown" },
              },
            );
            return { filename, content };
          } catch (error) {
            return {
              filename,
              error: error instanceof Error ? error.message : "Failed to read file",
            };
          }
        }),
      );
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // PUT Vault File Content
  tools.register(
    type({
      name: '"create_vault_file"',
      arguments: {
        filename: "string",
        content: "string",
      },
    }).describe("Create a new file in your vault or update an existing one."),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "PUT",
          body: args.content,
        },
      );
      return {
        content: [{ type: "text", text: "File created successfully" }],
      };
    },
  );

  // POST Vault File Content
  tools.register(
    type({
      name: '"append_to_vault_file"',
      arguments: {
        filename: "string",
        content: "string",
      },
    }).describe("Append content to a new or existing file."),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "POST",
          body: args.content,
        },
      );
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Vault File Content
  tools.register(
    type({
      name: '"patch_vault_file"',
      arguments: type({
        filename: "string",
      }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in a file relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      const headers: HeadersInit = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: args.target,
        "Create-Target-If-Missing": "true",
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = args.targetDelimiter;
      }
      if (args.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
      }
      if (args.contentType) {
        headers["Content-Type"] = args.contentType;
      }

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "PATCH",
          headers,
          body: args.content,
        },
      );

      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Vault File Content
  tools.register(
    type({
      name: '"delete_vault_file"',
      arguments: {
        filename: "string",
      },
    }).describe("Delete a file from your vault."),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "DELETE",
        },
      );
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );
}
