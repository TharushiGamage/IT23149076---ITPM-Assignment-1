const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  testMatch: ["**/*.spec.js"],
  reporter: "html",
  use: { headless: true },
});