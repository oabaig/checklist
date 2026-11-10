const { defineConfig } = require("@playwright/test");

const TEST_SERVER_PORT = 4399;

module.exports = defineConfig({
  testDir: "tests",
  use: {
    baseURL: `http://localhost:${TEST_SERVER_PORT}`,
  },
  webServer: {
    command: "node server.js",
    url: `http://localhost:${TEST_SERVER_PORT}`,
    env: {
      PORT: String(TEST_SERVER_PORT),
    },
    reuseExistingServer: false,
  },
});
