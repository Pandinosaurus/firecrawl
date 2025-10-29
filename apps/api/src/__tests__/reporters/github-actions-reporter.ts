import { relative } from "path";

// Using any for Jest types to avoid dependency issues
type AggregatedResult = any;
type Test = any;
type TestResult = any;
type TestCaseResult = any;
type GlobalConfig = any;

/**
 * Custom Jest reporter for GitHub Actions that organizes test results
 * into collapsible groups by file for better CI log readability.
 */
export default class GitHubActionsReporter {
  private _globalConfig: GlobalConfig;
  private _options: any;
  private rootDir: string;
  private testCount = 0;
  private totalTestSuites = 0;

  constructor(
    globalConfig: GlobalConfig,
    reporterOptions: any,
    reporterContext: any,
  ) {
    this._globalConfig = globalConfig;
    this._options = reporterOptions || {};
    this.rootDir = reporterContext?.config?.rootDir || process.cwd();
  }

  onRunStart(results: AggregatedResult): void {
    this.totalTestSuites = results.numTotalTestSuites;
    console.log("\n" + "=".repeat(80));
    console.log("::group::🧪 Running Firecrawl Test Suite");
    console.log(
      `📦 Running ${results.numTotalTestSuites} test suites with ${results.numTotalTests} tests`,
    );
    console.log("::endgroup::");
    console.log("=".repeat(80) + "\n");
  }

  onTestResult(test: Test, testResult: TestResult): void {
    this.testCount++;
    const relativePath = relative(this.rootDir, testResult.testFilePath);
    const status = testResult.numFailingTests > 0 ? "❌" : "✅";
    const testCounts = `${testResult.numPassingTests} passed`;
    const failedCount =
      testResult.numFailingTests > 0
        ? `, ${testResult.numFailingTests} failed`
        : "";
    const pendingCount =
      testResult.numPendingTests > 0
        ? `, ${testResult.numPendingTests} skipped`
        : "";
    const duration = (
      (testResult.perfStats.end - testResult.perfStats.start) /
      1000
    ).toFixed(2);
    const progress = `[${this.testCount}/${this.totalTestSuites}]`;

    // Create collapsible group for each test file
    console.log(
      `::group::${status} ${progress} ${relativePath} - ${testCounts}${failedCount}${pendingCount} (${duration}s)`,
    );

    // Show test file details
    console.log(`\n📄 File: ${relativePath}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Results: ${testCounts}${failedCount}${pendingCount}\n`);

    // Log each test case
    console.log("Tests:");
    testResult.testResults.forEach((result: TestCaseResult, index: number) => {
      const testStatus =
        result.status === "passed"
          ? "✓"
          : result.status === "failed"
            ? "✗"
            : "⊙";
      const testDuration = result.duration ? ` (${result.duration}ms)` : "";
      const ancestorTitles =
        result.ancestorTitles.length > 0
          ? result.ancestorTitles.join(" › ") + " › "
          : "";
      console.log(
        `  ${testStatus} ${ancestorTitles}${result.title}${testDuration}`,
      );

      // Show failure messages
      if (result.status === "failed") {
        console.log("\n    ❌ Failure Details:");
        result.failureMessages.forEach(message => {
          message.split("\n").forEach(line => {
            console.log(`       ${line}`);
          });
        });
        console.log("");
      }
    });

    // Show console output if any
    if (testResult.console && testResult.console.length > 0) {
      console.log("\n📝 Console Output:");
      testResult.console.forEach(log => {
        const logType = log.type.toUpperCase();
        const timestamp = new Date(
          log.origin?.trim() ? parseInt(log.origin) : Date.now(),
        ).toISOString();
        log.message.split("\n").forEach(line => {
          if (line.trim()) {
            console.log(`  [${logType}] ${line}`);
          }
        });
      });
    }

    console.log("::endgroup::");
    console.log(""); // Add spacing between test suites
  }

  onRunComplete(contexts: Set<any>, results: AggregatedResult): void {
    console.log("\n" + "=".repeat(80));
    console.log("::group::📊 Final Test Summary");

    const totalTests = results.numTotalTests;
    const passedTests = results.numPassedTests;
    const failedTests = results.numFailedTests;
    const skippedTests = results.numPendingTests;
    const duration = ((results.endTime - results.startTime) / 1000).toFixed(2);
    const passRate =
      totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : "0.0";

    console.log("\n📦 Test Suites:");
    console.log(`   Total:  ${results.numTotalTestSuites}`);
    console.log(`   ✅ Passed: ${results.numPassedTestSuites}`);
    console.log(`   ❌ Failed: ${results.numFailedTestSuites}`);
    if (results.numPendingTestSuites > 0) {
      console.log(`   ⏭️  Pending: ${results.numPendingTestSuites}`);
    }

    console.log("\n🧪 Tests:");
    console.log(`   Total:  ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests} (${passRate}%)`);
    if (failedTests > 0) {
      console.log(`   ❌ Failed: ${failedTests}`);
    }
    if (skippedTests > 0) {
      console.log(`   ⏭️  Skipped: ${skippedTests}`);
    }

    console.log(`\n⏱️  Total Duration: ${duration}s`);

    if (results.numFailedTests > 0) {
      console.log(
        "\n⚠️  ❌ Some tests failed! Check the logs above for details.",
      );
    } else {
      console.log("\n🎉 ✅ All tests passed!");
    }

    console.log("::endgroup::");
    console.log("=".repeat(80) + "\n");
  }
}
