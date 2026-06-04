/**
 * Streaming Markdown rendering performance test configuration
 * All configurable parameters are centrally managed
 */

export const TEXT_CATEGORIES = {
  short: { min: 0, max: 280, name: 'Short Text' },
  medium: { min: 280, max: 2000, name: 'Medium Text' },
  long: { min: 2000, max: 20000, name: 'Long Text' },
} as const;

export const BENCHMARK_CONFIG = {
  // Chunk rendering configuration
  CHUNK_SIZE: 6, // Number of characters rendered per chunk
  UPDATE_INTERVAL: 50, // Interval between chunks (ms)
  RUN_COUNT: 3, // Number of runs per test case - simplified to 3 times

  // Test text length configuration
  TEST_TEXT_LENGTHS: {
    short: 250, // Short text character count
    medium: 1500, // Medium text character count
    long: 8000, // Long text character count
  },

  // Timeout configuration
  TIMEOUT: 600_000, // Shortened timeout for individual test cases (ms)

  // Debug configuration
  DEBUG: {
    ENABLE_TRACING: true, // Disable performance tracing for speed
    ENABLE_SCREENSHOTS: false, // Disable screenshots
    ENABLE_SNAPSHOTS: false, // Disable snapshots
  },
} as const;

// Dynamically configure renderers based on CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
export const RENDERERS = isCI
  ? (['x-markdown'] as const) // Only test x-markdown renderer in CI
  : (['x-markdown', 'react-markdown', 'streamdown'] as const); // Test additional renderers in non-CI environments

// Test file path
export const TEST_FILE_PATH = 'test.md';
