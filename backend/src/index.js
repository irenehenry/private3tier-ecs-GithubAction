const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// PostgreSQL connection with SSL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

// ==========================================
// Auto-create table + sample data on startup
// ==========================================
async function initializeDatabase() {
  try {
    console.log('Checking database table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if table is empty
    const result = await pool.query('SELECT COUNT(*) FROM items');
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
      console.log('Inserting sample data...');
      await pool.query(`
        INSERT INTO items (name, description) VALUES
        ('Sample Item 1', 'This is the first item from RDS'),
        ('Sample Item 2', 'This data will be cached in Redis'),
        ('Sample Item 3', 'Private 3-tier ECS Fargate application');
      `);
      console.log('Sample data inserted successfully');
    } else {
      console.log(`Table already has ${count} records`);
    }

  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'backend' });
});

// Main API
app.get('/api/data', async (req, res) => {
  const cacheKey = 'items:all';

  try {
    // 1. Try Redis first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log('Cache HIT from Redis');
      return res.json({
        source: 'redis',
        data: JSON.parse(cached)
      });
    }

    console.log('Cache MISS - Querying RDS');

    // 2. Query RDS
    const result = await pool.query('SELECT id, name, description, created_at FROM items ORDER BY id');
    const data = result.rows;

    // 3. Store in Redis (60 seconds)
    await redis.set(cacheKey, JSON.stringify(data), 'EX', 60);

    res.json({
      source: 'rds',
      data: data
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Start server after initializing database
initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
  });
});