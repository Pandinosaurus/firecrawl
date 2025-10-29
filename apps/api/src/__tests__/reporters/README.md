# GitHub Actions Reporter

This custom Jest reporter organizes test output into collapsible groups when running in CI environments, making it much easier to navigate through logs in GitHub Actions.

## Features

- **Collapsible Test Files**: Each test file appears as a collapsible group in GitHub Actions logs
- **Progress Tracking**: Shows test suite progress (e.g., `[5/35]` for test suite 5 out of 35)
- **Clear Status Indicators**: Visual indicators (✅/❌) for pass/fail status
- **Detailed Test Information**: Shows individual test names, durations, and nested describe blocks
- **Console Output Capture**: Displays console logs from tests in an organized format
- **Comprehensive Summary**: Final summary with pass rates and total duration

## Usage

The reporter is automatically enabled when running tests in CI environments (when `CI=true`).

### In CI (GitHub Actions)

```bash
pnpm test:snips  # Reporter automatically enabled
```

### Locally (Default Reporter)

```bash
pnpm test:snips  # Uses default Jest reporter
```

## Example Output

In GitHub Actions, logs will appear like this:

```
================================================================================
::group::🧪 Running Firecrawl Test Suite
📦 Running 35 test suites with 127 tests
::endgroup::
================================================================================

::group::✅ [1/35] src/__tests__/snips/v2/scrape.test.ts - 8 passed (2.45s)

📄 File: src/__tests__/snips/v2/scrape.test.ts
⏱️  Duration: 2.45s
📊 Results: 8 passed

Tests:
  ✓ Scrape › should successfully scrape a webpage (345ms)
  ✓ Scrape › should handle 404 errors gracefully (123ms)
  ✓ Scrape › should extract metadata correctly (234ms)
  ...

📝 Console Output:
  [LOG] Starting scrape request
  [LOG] Successfully scraped https://example.com

::endgroup::

::group::❌ [2/35] src/__tests__/snips/v2/crawl.test.ts - 6 passed, 1 failed (3.21s)

📄 File: src/__tests__/snips/v2/crawl.test.ts
⏱️  Duration: 3.21s
📊 Results: 6 passed, 1 failed

Tests:
  ✓ Crawl › should crawl multiple pages (456ms)
  ✗ Crawl › should respect max depth (234ms)

    ❌ Failure Details:
       Expected depth to be 3, but got 4
       at Object.<anonymous> (/path/to/test.ts:45:23)

::endgroup::

...

================================================================================
::group::📊 Final Test Summary

📦 Test Suites:
   Total:  35
   ✅ Passed: 34
   ❌ Failed: 1

🧪 Tests:
   Total:  127
   ✅ Passed: 126 (99.2%)
   ❌ Failed: 1

⏱️  Total Duration: 45.67s

⚠️  ❌ Some tests failed! Check the logs above for details.

::endgroup::
================================================================================
```

## Benefits

1. **Easy Navigation**: Click to expand/collapse specific test files
2. **Quick Debugging**: Failed tests are clearly marked with ❌
3. **Better Context**: See exactly which tests are running and their output
4. **Time Tracking**: Monitor test performance with duration metrics
5. **Clean Logs**: Default reporter still used locally for development

## Implementation

The reporter is configured in `jest.config.ts` to automatically activate in CI environments:

```typescript
reporters: process.env.CI
  ? ["default", "<rootDir>/src/__tests__/reporters/github-actions-reporter.ts"]
  : ["default"],
```

## GitHub Actions Groups

The reporter uses GitHub Actions workflow commands to create collapsible log sections:

- `::group::<title>` - Starts a new collapsible section
- `::endgroup::` - Ends the current section

These commands are only interpreted by GitHub Actions and appear as regular text in other environments.
