import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { WH_HOTELS_DIR: "test/fixtures/hotels", WH_OUTPUT_DIR: "test/.output", ANTHROPIC_API_KEY: "" },
    testTimeout: 30000,
  },
});
