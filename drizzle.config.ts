import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './app/lib/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE_NAME!,
  },
});
