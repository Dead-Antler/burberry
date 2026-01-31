/**
 * Next.js Instrumentation Hook
 * Runs before the server starts - perfect for database migrations
 * Ensures database schema is always up-to-date before handling requests
 */
export async function register() {
  // Only run on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('./app/lib/migrate');

    try {
      await runMigrations();
    } catch (error) {
      console.error('Failed to run migrations on startup');
      // Fail fast - don't start the app if migrations fail
      process.exit(1);
    }
  }
}
