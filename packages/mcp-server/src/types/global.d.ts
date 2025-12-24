declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      NODE_TLS_REJECT_UNAUTHORIZED: `${0 | 1}`;
      OBSIDIAN_API_KEY?: string;
      OBSIDIAN_USE_HTTP?: string;
      OBSIDIAN_VAULT_PATH?: string;
    }
  }
}

export {};
