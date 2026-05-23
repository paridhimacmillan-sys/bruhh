// Neon serverless PostgreSQL client
// Set DATABASE_URL in your .env.local to your Neon connection string:
// DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
export default sql;
