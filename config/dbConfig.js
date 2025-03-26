import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // .env se database URL lega
  ssl: {
    rejectUnauthorized: false, // Neon.tech ya AWS ke liye zaroori hai
  },
});

const connectToDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL Database!");
    client.release();
  } catch (error) {
    console.error("Database connection error:", error.message);
  }
};

export { connectToDatabase, pool };
