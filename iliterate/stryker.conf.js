/**
 * @type {import('@stryker-mutator/api/core').StrykerOptions}
 */
export default {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  mutate: [
    "src/lib/spaced-repetition.ts",
    "src/lib/quiz-generator.ts",
    "src/components/flashcards/**/*.tsx",
    "src/components/quiz/**/*.tsx",
    "src/hooks/**/*.ts"
  ],
  vitest: {
    configFile: "vitest.config.ts"
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 50
  }
};