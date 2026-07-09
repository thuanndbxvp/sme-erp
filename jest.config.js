/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  // Integration test chạm Neon (remote pooler, giới hạn connection). Chạy tuần tự
  // để nhiều suite không mở PrismaClient song song làm cạn connection.
  maxWorkers: 1,
};

module.exports = config;
