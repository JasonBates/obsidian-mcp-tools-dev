import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI, CATEGORIZATION_SYSTEM_PROMPT, getCategorizeUserPrompt, extractConnectedSection } from "shared";
import OpenAI from "openai";

function encodePathSegments(path: string): string {
  return path.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

export function registerLlmCategorizationTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"categorize_note"',
      arguments: {
        filename: type("string").describe(
          "The vault path to the note to categorize (e.g., '070 Note Base/MyNote.md')"
        ),
        "model?": type("string").describe(
          "OpenAI model to use (default: gpt-4o)"
        ),
      },
    }).describe(
      `Analyze a note's content using GPT-4o and populate its ## Connected section with appropriate MoC links.

This tool:
1. Reads the note content
2. Sends it to OpenAI for analysis
3. Updates the ## Connected section with Component/Dynamic/School links

Requires OPENAI_API_KEY environment variable to be set.`
    ),
    async ({ arguments: args }) => {
      // Check for API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "OPENAI_API_KEY environment variable not set",
            }, null, 2),
          }],
        };
      }

      // Step 1: Read note content
      const noteContent = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodePathSegments(args.filename)}`,
        {
          headers: { Accept: "text/markdown" },
        },
      );

      // Step 2: Call OpenAI
      const openai = new OpenAI({ apiKey });
      const model = args.model ?? "gpt-4o";

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: CATEGORIZATION_SYSTEM_PROMPT },
          { role: "user", content: getCategorizeUserPrompt(args.filename, noteContent) },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const gptResponse = response.choices[0]?.message?.content?.trim() ?? "";

      if (!gptResponse) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "OpenAI returned empty response",
            }, null, 2),
          }],
        };
      }

      // Extract just the Connected section from GPT's full file response
      const connectedContent = extractConnectedSection(gptResponse);

      if (!connectedContent) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Could not extract Connected section from GPT response",
              gptResponse: gptResponse.substring(0, 500),
            }, null, 2),
          }],
        };
      }

      // Step 3: Update the Connected section
      // Use regex replacement like the plugin does - more reliable than PATCH API
      const connectedRegex = /## Connected\s*\n([\s\S]*?)(?=\n##|\n---|\Z|$)/;
      const match = noteContent.match(connectedRegex);

      let newContent: string;
      if (match) {
        // Replace existing Connected section content
        newContent = noteContent.replace(
          connectedRegex,
          `## Connected\n\n${connectedContent}\n`,
        );
      } else {
        // Add Connected section at the end
        newContent = noteContent.trimEnd() + `\n\n## Connected\n\n${connectedContent}\n`;
      }

      // Write the updated content back
      await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodePathSegments(args.filename)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "text/markdown",
          },
          body: newContent,
        },
      );

      // Step 4: Return result
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            filename: args.filename,
            model,
            connectedSection: connectedContent,
          }, null, 2),
        }],
      };
    },
  );
}
