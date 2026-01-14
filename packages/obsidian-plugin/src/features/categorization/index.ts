import { Notice, TFile } from "obsidian";
import type McpToolsPlugin from "../../main";
import { logger } from "../../shared/logger";
import { CATEGORIZATION_SYSTEM_PROMPT, getCategorizeUserPrompt, extractConnectedSection } from "shared";

export { default as FeatureSettings } from "./components/CategorizationSettings.svelte";

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0]?.message?.content?.trim() ?? "";
}

async function updateConnectedSection(
  plugin: McpToolsPlugin,
  file: TFile,
  connectedContent: string,
): Promise<void> {
  const content = await plugin.app.vault.read(file);

  // Find the ## Connected section
  const connectedRegex = /## Connected\s*\n([\s\S]*?)(?=\n##|\n---|\Z|$)/;
  const match = content.match(connectedRegex);

  let newContent: string;
  if (match) {
    // Replace existing Connected section content
    newContent = content.replace(
      connectedRegex,
      `## Connected\n\n${connectedContent}\n`,
    );
  } else {
    // Add Connected section at the end
    newContent = content.trimEnd() + `\n\n## Connected\n\n${connectedContent}\n`;
  }

  await plugin.app.vault.modify(file, newContent);
}

export async function categorizeCurrentNote(
  plugin: McpToolsPlugin,
): Promise<void> {
  // Get API key from settings
  const settings = await plugin.loadData();
  const apiKey = settings?.openaiApiKey;

  if (!apiKey) {
    new Notice(
      "OpenAI API key not configured. Please add it in MCP Tools settings.",
    );
    return;
  }

  // Get active file
  const file = plugin.app.workspace.getActiveFile();
  if (!file) {
    new Notice("No active file to categorize.");
    return;
  }

  if (file.extension !== "md") {
    new Notice("Can only categorize markdown files.");
    return;
  }

  try {
    new Notice(`Categorizing ${file.basename}...`);

    // Read file content
    const content = await plugin.app.vault.read(file);

    // Call OpenAI
    const gptResponse = await callOpenAI(
      apiKey,
      CATEGORIZATION_SYSTEM_PROMPT,
      getCategorizeUserPrompt(file.path, content),
    );

    if (!gptResponse) {
      new Notice("OpenAI returned empty response.");
      return;
    }

    // Extract just the Connected section from GPT's full file response
    const connectedContent = extractConnectedSection(gptResponse);

    if (!connectedContent) {
      new Notice("Could not extract Connected section from GPT response.");
      logger.error("Extraction failed", { gptResponse: gptResponse.substring(0, 500) });
      return;
    }

    // Update the file
    await updateConnectedSection(plugin, file, connectedContent);

    new Notice(`Categorized ${file.basename} successfully!`);
    logger.info("Categorized note", { file: file.path, connectedContent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    new Notice(`Failed to categorize: ${message}`);
    logger.error("Categorization failed", { error: message, file: file.path });
  }
}

export async function setup(plugin: McpToolsPlugin): Promise<void> {
  // Register the command
  plugin.addCommand({
    id: "categorize-current-note",
    name: "Categorize current note with MoCs",
    hotkeys: [{ modifiers: ["Ctrl", "Alt"], key: "v" }],
    callback: () => categorizeCurrentNote(plugin),
  });

  logger.info("Categorization feature loaded");
}
