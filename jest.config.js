/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // sanitize-html dùng htmlparser2 (ESM) gây lỗi Jest. Mock pass-through
    // — test validation logic Zod, không test bản thân sanitize-html.
    "^sanitize-html$": "<rootDir>/src/__mocks__/sanitize-html.js",
  },
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  // Integration test chạm Neon (remote pooler, giới hạn connection). Chạy tuần tự
  // để nhiều suite không mở PrismaClient song song làm cạn connection.
  maxWorkers: 1,
};

module.exports = config;
