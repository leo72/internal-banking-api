export default {
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/generated/**", "!src/server.ts"],
  coverageDirectory: "coverage",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
          },
          target: "es2023",
        },
        module: {
          type: "es6",
        },
      },
    ],
  },
};
