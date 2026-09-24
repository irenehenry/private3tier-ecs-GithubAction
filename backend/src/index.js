const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Redis connection (Service Connect name: redis)
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// PostgreSQL connection (credentials from Secrets Manager)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false   // Required for RDS
  }
});
// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'backend' });
});

// Main API – Prefer Redis, fallback to RDS
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

    console.log('Cache MISS – Querying RDS');

    // 2. Query RDS
    const result = await pool.query('SELECT id, name, description, created_at FROM items ORDER BY id');
    const data = result.rows;

    // 3. Store in Redis (expire after 60 seconds for demo)
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});