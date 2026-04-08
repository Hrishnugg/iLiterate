/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  mutate: [
    "src/lib/spaced-repetition.ts",
    "src/lib/level-system.ts",
  ],
  reporters: ["clear-text", "html"],
  htmlReporter: {
    fileName: "reports/mutation/mutation-report.html",
  },
  coverageAnalysis: "perTest",
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  concurrency: 4,
  timeoutMS: 30000,
};
