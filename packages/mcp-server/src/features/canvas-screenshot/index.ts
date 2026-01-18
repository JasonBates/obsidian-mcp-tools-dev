import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI } from "shared";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export function registerCanvasScreenshotTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"screenshot_canvas"',
      arguments: {
        filename: type("string").describe(
          "Path to the .canvas file in the vault (e.g., 'folder/mycanvas.canvas')",
        ),
        "timeout?": type("number").describe(
          "Wait time for canvas to render in ms (default: 1000). Increase for complex canvases.",
        ),
      },
    }).describe(
      "Capture a screenshot of an Obsidian canvas file. Saves the PNG to a temp file and returns the file path. Use the Read tool to view the image. The canvas will be automatically opened if not already visible, and zoomed to fit all content.",
    ),
    async ({ arguments: args }) => {
      const response = await makeRequest(
        LocalRestAPI.ApiCanvasScreenshotResponse,
        "/canvas/screenshot",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: args.filename, timeout: args.timeout }),
        },
      );

      // Save the PNG to a temp file for easy access
      const tempDir = os.tmpdir();

      // Clean up old canvas screenshots (older than 1 hour)
      try {
        const files = fs.readdirSync(tempDir).filter(f => f.startsWith("canvas_screenshot_"));
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        for (const file of files) {
          const filePath = path.join(tempDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < oneHourAgo) {
              fs.unlinkSync(filePath);
            }
          } catch {
            // Ignore errors for individual files
          }
        }
      } catch {
        // Ignore cleanup errors
      }

      const sanitizedName = args.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const tempPath = path.join(tempDir, `canvas_screenshot_${sanitizedName}.png`);
      const imageBuffer = Buffer.from(response.image, "base64");
      fs.writeFileSync(tempPath, imageBuffer);

      return {
        content: [
          {
            type: "text",
            text: `Screenshot saved to: ${tempPath}`,
          },
        ],
      };
    },
  );
}
