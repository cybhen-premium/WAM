import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);
async function run() {
  const m = await sql`SELECT count(*) FROM member`;
  const d = await sql`SELECT count(*) FROM department`;
  const t = await sql`SELECT count(*) FROM tithe`;
  const tr = await sql`SELECT count(*) FROM transaction`;
  const s = await sql`SELECT count(*) FROM staff`;
  const a = await sql`SELECT count(*) FROM attendance`;
  const al = await sql`SELECT count(*) FROM audit_log`;
  const sl = await sql`SELECT count(*) FROM sms_log`;
  console.log({
    member: m[0].count,
    department: d[0].count,
    tithe: t[0].count,
    transaction: tr[0].count,
    staff: s[0].count,
    attendance: a[0].count,
    audit_log: al[0].count,
    sms_log: sl[0].count
  });
}
run();
