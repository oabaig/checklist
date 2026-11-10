const { defineConfig } = require("@playwright/test");
const os = require("node:os");
const path = require("node:path");

const TEST_SERVER_PORT = 4399;
const TEST_DATA_FILE_PATH = path.join(os.tmpdir(), "checklist-app-test-data.json");

module.exports = defineConfig({
  testDir: "tests",
  // Tests share one server and data file, so they must run one at a time.
  workers: 1,
  use: {
    baseURL: `http://localhost:${TEST_SERVER_PORT}`,
  },
  webServer: {
    command: `rm -f ${TEST_DATA_FILE_PATH} && node server.js`,
    url: `http://localhost:${TEST_SERVER_PORT}`,
    env: {
      PORT: String(TEST_SERVER_PORT),
      CHECKLIST_DATA_FILE: TEST_DATA_FILE_PATH,
    },
    reuseExistingServer: false,
  },
});
