const express = require('express');
const { postgraphile } = require('postgraphile');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Import Routes
const aiRoutes = require('./routes/ai');
const emailRoutes = require('./routes/email');
const uploadRoutes = require('./routes/upload');
const attendanceRoutes = require('./routes/attendance');

// Use Routes
app.use('/api/ai', aiRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/attendance', attendanceRoutes);

// Database Pool for Auth
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// PostGraphile Middleware
app.use(
  postgraphile(
    DATABASE_URL,
    'public', // Schema
    {
      watchPg: true,
      graphiql: true,
      enhanceGraphiql: true,
      showErrorStack: true,
      extendedErrors: ['hint', 'detail', 'errcode'],
      // jwtSecret: JWT_SECRET, // Disabled to prevent role switching issues
      // jwtPgTypeIdentifier: 'public.jwt_token',
      pgDefaultRole: 'postgres', // Use postgres for all operations
    }
  )
);

// Auth Routes
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Check user exists
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // 2. Verify password (using pgcrypto hash format)
    const verifyResult = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password_hash = crypt($2, password_hash)',
      [username, password]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Generate JWT
    const token = jwt.sign(
      {
        role: user.role,
        user_id: user.id
      },
      JWT_SECRET,
      {
        expiresIn: '1d',
        audience: 'postgraphile'
      }
    );

    res.json({ token, role: user.role, user: { id: user.id, full_name: user.full_name } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register Route (for demo purposes to create initial users)
app.post('/register', async (req, res) => {
  const { username, password, role, full_name } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM register_user($1, $2, $3, $4)',
      [username, password, role, full_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

const { initDb } = require('./db/init');

// ... (rest of imports)

// Initialize DB and Start Server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`GraphiQL available at http://localhost:${PORT}/graphiql`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
