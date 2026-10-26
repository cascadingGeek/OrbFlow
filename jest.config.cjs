/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test/unit", "<rootDir>/test/integration"],
  passWithNoTests: true,
};
