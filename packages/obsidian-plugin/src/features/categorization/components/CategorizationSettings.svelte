<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { onDestroy, onMount } from "svelte";

  export let plugin: McpToolsPlugin;

  let apiKey = "";
  let saved = false;
  let savedTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    const settings = await plugin.loadData();
    apiKey = settings?.openaiApiKey ?? "";
  });

  onDestroy(() => {
    if (savedTimeout) {
      clearTimeout(savedTimeout);
    }
  });

  async function saveApiKey() {
    const settings = (await plugin.loadData()) ?? {};
    settings.openaiApiKey = apiKey;
    await plugin.saveData(settings);
    saved = true;
    if (savedTimeout) clearTimeout(savedTimeout);
    savedTimeout = setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="categorization-settings">
  <h3>Note Categorization</h3>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">OpenAI API Key</div>
      <div class="setting-item-description">
        Required for AI-powered note categorization. Get your key from
        <a href="https://platform.openai.com/api-keys" target="_blank">
          OpenAI's website
        </a>.
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="password"
        bind:value={apiKey}
        placeholder="sk-..."
        on:change={saveApiKey}
      />
      {#if saved}
        <span class="saved-indicator">Saved!</span>
      {/if}
    </div>
  </div>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Usage</div>
      <div class="setting-item-description">
        Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>V</kbd> to categorize the
        active note. You can also use the command palette.
      </div>
    </div>
  </div>
</div>

<style>
  .categorization-settings {
    margin-top: 2em;
    padding-top: 1em;
    border-top: 1px solid var(--background-modifier-border);
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1em 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .setting-item-info {
    flex: 1;
    margin-right: 1em;
  }

  .setting-item-name {
    font-weight: 600;
  }

  .setting-item-description {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-top: 0.25em;
  }

  .setting-item-control {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .setting-item-control input {
    width: 250px;
  }

  .saved-indicator {
    color: var(--text-success);
    font-size: 0.9em;
  }
</style>
