import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` compares src/api/db/schema.ts with the migrations in drizzle/ and writes
// a new migration for what changed. The API applies new migrations when it starts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/api/db/schema.ts',
  out: './drizzle',
});
