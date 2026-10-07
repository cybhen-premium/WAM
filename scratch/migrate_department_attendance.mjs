import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Checking and applying columns...");

  // 1. staff.department_id
  await sql`
    ALTER TABLE staff 
    ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES department(id) ON DELETE SET NULL
  `;
  console.log("staff.department_id added or already exists.");

  // 2. attendance.department_id, attendance.status, attendance.notes
  await sql`
    ALTER TABLE attendance 
    ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES department(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present',
    ADD COLUMN IF NOT EXISTS notes text
  `;
  console.log("attendance columns added or already exist.");

  // 3. Unique index on (member_id, service_date) in attendance
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS attendance_member_date_uq 
    ON attendance (member_id, service_date)
  `;
  console.log("attendance_member_date_uq created.");

  // 4. church.absence_template
  await sql`
    ALTER TABLE church 
    ADD COLUMN IF NOT EXISTS absence_template text NOT NULL DEFAULT 'Hello [Name], we missed you at church today! We prayed for you and look forward to seeing you next Sunday. Have a blessed week!'
  `;
  console.log("church.absence_template added or already exists.");

  console.log("Migration complete!");
}

run().catch(console.error);
