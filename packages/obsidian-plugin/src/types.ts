declare module "obsidian" {
  interface McpToolsPluginSettings {
    version?: string;
    openaiApiKey?: string;
  }

  interface Plugin {
    loadData(): Promise<McpToolsPluginSettings>;
    saveData(data: McpToolsPluginSettings): Promise<void>;
  }
}

export {};
