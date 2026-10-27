import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

export const sql = neon(process.env.DATABASE_URL);
