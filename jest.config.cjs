/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test/unit", "<rootDir>/test/integration"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/app/$1",
    "^@test/(.*)$": "<rootDir>/test/$1",
  },
  passWithNoTests: true,
};
