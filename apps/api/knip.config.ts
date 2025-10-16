import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["src/services/worker/**/*.ts", "src/services/**/*-worker.ts"],
      project: ["src/**/*.ts"],
    },
  },
  // TODO: remove search index file / dependency once implemented
  ignore: ["native/**", "src/services/search-index-db.ts"],
  ignoreDependencies: ["openai", "@pinecone-database/pinecone"],
};

export default config;
