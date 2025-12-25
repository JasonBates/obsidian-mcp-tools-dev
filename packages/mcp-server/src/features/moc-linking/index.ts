import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

const DEFAULT_CATEGORIES = {
  Domain: "030 MoC - Domains",
  Links: "040 MoC - Links",
  School: "050 MoC - Schools",
  Emergent: "060 MoC - Emergent",
} as const;

interface MocResult {
  category: string;
  mocs: string[];
}

function formatConnectedSection(mocResults: MocResult[]): string {
  const categoryOrder = ["Domain", "Links", "School", "Emergent"];

  const lines = categoryOrder.map((category) => {
    const result = mocResults.find((r) => r.category === category);
    const links = result?.mocs.map((moc) => `[[${moc}]]`).join(" | ") ?? "";
    return `${category}: ${links}`;
  });

  return lines.join("\n");
}

function encodePathSegments(path: string): string {
  return path.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

export function registerMocLinkingTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"link_to_mocs"',
      arguments: {
        filename: type("string").describe(
          "The vault path to the note to process (e.g., 'Notes/MyNote.md')"
        ),
        "maxPerCategory?": type("number>0").describe(
          "Maximum MoC links per category (default: 3)"
        ),
        "minScore?": type("number").describe(
          "Minimum similarity score threshold (0-1). Results below this are excluded. Default: 0.7"
        ),
        "categories?": type({
          "Domain?": "string",
          "Links?": "string",
          "School?": "string",
          "Emergent?": "string",
        }).describe("Override default MoC category folder paths"),
      },
    }).describe(
      `Analyze a note and populate its ## Connected section with semantically relevant MoC links organized by category (Domain, Links, School, Emergent).

After running this tool, Claude should:
1. Read the target note and review the generated Connected section
2. Remove any links that are tangential or don't pass the test: "Would someone exploring this MoC benefit from finding this note, and vice versa?"
3. Consider if any obvious MoC connections are missing based on note content
4. Update the Connected section if changes are needed

Use minScore 0.7 to cast a wide net, then apply judgment to refine.`
    ),
    async ({ arguments: args }) => {
      // Step 1: Read note content
      const noteContent = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodePathSegments(args.filename)}`,
        {
          headers: { Accept: "text/markdown" },
        },
      );

      // Step 2: Merge categories with defaults
      const categories = { ...DEFAULT_CATEGORIES, ...args.categories };
      const maxPerCategory = args.maxPerCategory ?? 3;
      const minScore = args.minScore ?? 0.7;

      // Step 3: Search each category for relevant MoCs
      const mocResults: MocResult[] = [];

      for (const [categoryName, folderPath] of Object.entries(categories)) {
        try {
          const searchResponse = await makeRequest(
            LocalRestAPI.ApiSmartSearchResponse,
            `/search/smart`,
            {
              method: "POST",
              body: JSON.stringify({
                query: noteContent,
                filter: {
                  folders: [folderPath],
                  limit: maxPerCategory,
                },
              }),
            },
          );

          // Extract MoC names from paths
          // Results may include heading anchors like "File.md#Heading#{1}"
          // We want just the base filename without extension or anchors
          // Filter by minimum score threshold to exclude tangential matches
          const mocs = searchResponse.results
            .filter((result) => result.score >= minScore)
            .slice(0, maxPerCategory)
            .map((result) => {
              const filename = result.path.split("/").pop() ?? "";
              // Remove .md extension and any heading anchors (#...)
              return filename.replace(/\.md(#.*)?$/, "").replace(/#.*$/, "");
            })
            .filter((name, index, arr) => name.length > 0 && arr.indexOf(name) === index);

          if (mocs.length > 0) {
            mocResults.push({ category: categoryName, mocs });
          }
        } catch {
          // Category folder may not exist or have no matches, continue
        }
      }

      // Step 4: Format connected section
      const connectedContent = formatConnectedSection(mocResults);

      // Step 5: Patch the file to update/create ## Connected section
      await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodePathSegments(args.filename)}`,
        {
          method: "PATCH",
          headers: {
            Operation: "replace",
            "Target-Type": "heading",
            Target: "Connected",
            "Create-Target-If-Missing": "true",
          },
          body: connectedContent,
        },
      );

      // Step 6: Return response
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                filename: args.filename,
                categoriesUpdated: mocResults.map((r) => r.category),
                linksAdded: mocResults.reduce((sum, r) => sum + r.mocs.length, 0),
                connectedSection: connectedContent,
              },
              null,
              2
            ),
          },
        ],
      };
    },
  );
}
