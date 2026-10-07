import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  const staffCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff'`;
  console.log('staff columns:', staffCols.map(c => c.column_name));
  const attCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance'`;
  console.log('attendance columns:', attCols.map(c => c.column_name));
}

run().catch(console.error);
