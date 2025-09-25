import { describe, test, expect } from '@jest/globals';
import { FirecrawlAppV1, Firecrawl } from "../../index";

const TEST_API_KEY = process.env.TEST_API_KEY || "test-key";

describe('Timeout Propagation Tests', () => {
  test.concurrent('should propagate timeout in v1 scrapeUrl with short timeout', async () => {
    const app = new FirecrawlAppV1({ apiKey: TEST_API_KEY });
    const startTime = Date.now();
    
    try {
      await app.scrapeUrl("https://httpbin.org/delay/3", { timeout: 1000 });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10000); // Should timeout before 10 seconds
      expect(elapsed).toBeGreaterThan(50); // Should take at least 50ms
    }
  }, 15000);

  test.concurrent('should handle timeout value of 0 in v1', async () => {
    const app = new FirecrawlAppV1({ apiKey: TEST_API_KEY });
    const startTime = Date.now();
    
    try {
      await app.scrapeUrl("https://httpbin.org/delay/2", { timeout: 0 });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(8000); // Should timeout quickly
      expect(elapsed).toBeGreaterThan(50); // Should take at least 50ms
    }
  }, 10000);

  test.concurrent('should include waitFor time in timeout calculation', async () => {
    const app = new FirecrawlAppV1({ apiKey: TEST_API_KEY });
    const startTime = Date.now();
    
    try {
      await app.scrapeUrl("https://httpbin.org/delay/1", { 
        timeout: 1000,
        waitFor: 2000
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(12000); // Should include waitFor + timeout + buffer
      expect(elapsed).toBeGreaterThan(50); // Should take at least 50ms
    }
  }, 15000);

  test.concurrent('should include action wait times in timeout calculation', async () => {
    const app = new FirecrawlAppV1({ apiKey: TEST_API_KEY });
    const startTime = Date.now();
    
    try {
      await app.scrapeUrl("https://httpbin.org/delay/1", { 
        timeout: 1000,
        actions: [
          { type: "wait", milliseconds: 1000 },
          { type: "wait", selector: ".some-element" }
        ]
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(12000); // Should include action wait times + timeout + buffer
      expect(elapsed).toBeGreaterThan(50); // Should take at least 50ms
    }
  }, 15000);

  test.concurrent('should propagate timeout in v2 scrape', async () => {
    const app = new Firecrawl({ apiKey: TEST_API_KEY });
    const startTime = Date.now();
    
    try {
      await app.scrape("https://httpbin.org/delay/3", { timeout: 1000 });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10000); // Should timeout before 10 seconds
      expect(elapsed).toBeGreaterThan(50); // Should take at least 50ms
    }
  }, 15000);

  test.concurrent('should handle v2 extract timeout propagation', async () => {
    const app = new Firecrawl({ apiKey: TEST_API_KEY });
    const startTime = Date.now();
    
    try {
      await app.extract({
        urls: ["https://httpbin.org/delay/3"],
        prompt: "Extract title",
        scrapeOptions: { timeout: 1000 }
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10000); // Should timeout before 10 seconds
      expect(elapsed).toBeGreaterThan(50); // Should take at least 50ms
    }
  }, 15000);
});
