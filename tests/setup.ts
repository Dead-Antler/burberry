/**
 * Global test setup
 * Runs before all tests via bunfig.toml preload
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_FILE_NAME = ':memory:';
process.env.AUTH_SECRET = 'test-secret-for-testing-only-32chars!';
