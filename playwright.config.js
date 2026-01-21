// playwright.config.js
export default {
  testDir: './frontend/tests',
  testMatch: /.*e2e\.test\.js/,
  timeout: 30000,
  use: {
    headless: true,
    baseURL: 'https://movies.aperion.cc',
    ignoreHTTPSErrors: true,
  },
};
