module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/getPerformanceDetails.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleDirectories: ["node_modules"],
};
