require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

//  FRONTEND ESTÁTICO
app.use(express.static(path.join(__dirname, 'frontend')));

/* ===============================
   DATABASE
================================ */

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const hasDatabaseUrl = Boolean(connectionString);

const pool = hasDatabaseUrl
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
  : null;

// DEFINE ensureDatabase HERE
function ensureDatabase(res) {
  if (!pool) {
    res.status(500).json({ error: 'Database not configured' });
    return false;
  }
  return true;
}

/* ===============================
   ROOT → FRONTEND
================================ */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

/* ===============================
   ROUTES
================================ */
app.get('/api/routes', async (_, res) => {
  if (!ensureDatabase(res)) return;
  const r = await pool.query(
    `SELECT DISTINCT code FROM routes ORDER BY code`
  );
  res.json(r.rows);
});

/* ===============================
   CREATE TOUR
================================ */
app.post('/api/trips', async (req, res) => {
if (!ensureDatabase(res)) return;
  const { email, name, routeCode, startDate } = req.body;
  if (!email || !name || !routeCode || !startDate) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const duration = await pool.query(
    `SELECT MAX(day_offset) max_day FROM routes WHERE UPPER(code)=UPPER($1)`,
    [routeCode]
  );

  if (!duration.rows[0].max_day) {
    return res.status(400).json({ error: 'Invalid route' });
  }

  await pool.query(
    `INSERT INTO user_trips (email,name,route_code,start_date)
     VALUES ($1,$2,UPPER($3),$4)`,
    [email, name, routeCode, startDate]
  );

  res.json({ ok: true });
});

/* ===============================
   USER TOURS
================================ */
app.get('/api/user-tours', async (req, res) => {
    if (!ensureDatabase(res)) return;
  const { email } = req.query;

  const r = await pool.query(
    `
    SELECT ut.id, ut.route_code, ut.start_date,
           MAX(ut.start_date + r.day_offset) end_date
    FROM user_trips ut
    JOIN routes r ON UPPER(r.code)=UPPER(ut.route_code)
    WHERE ut.email=$1
    GROUP BY ut.id
    ORDER BY ut.start_date
    `,
    [email]
  );

  res.json(r.rows);
});

/*===================================
EDIT SAVE
==============================*/
app.put('/api/user-tours/:id', async (req, res) => {
  if (!ensureDatabase(res)) return;

  const { id } = req.params;
  const { email, routeCode, startDate } = req.body;

  if (!email || !routeCode || !startDate) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const result = await pool.query(
      `
      UPDATE user_trips
      SET route_code = UPPER($1),
          start_date = $2
      WHERE id = $3
        AND email = $4
      `,
      [routeCode, startDate, id, email]
    );

    if (!result.rowCount) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error('UPDATE ERROR:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});


/* ===============================
   MATCHES (REAL)
================================ */
app.get('/api/matches/grouped', async (req, res) => {
  if (!ensureDatabase(res)) return;

  const { email, date } = req.query;

  if (!email || !date) {
    return res.status(400).json({
      error: 'Missing required query params: email and date'
    });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      error: 'Invalid date format. Use YYYY-MM-DD'
    });
  }

  try {
    const result = await pool.query(
      `
      WITH my_city AS (
        SELECT r.city
        FROM user_trips ut
        JOIN routes r
          ON UPPER(r.code) = UPPER(ut.route_code)
        WHERE ut.email = $1
          AND r.day_offset = ($2::date - ut.start_date)
      ),
      others_on_date AS (
        SELECT
          ut.email,
          ut.name,
          r.city
        FROM user_trips ut
        JOIN routes r
          ON UPPER(r.code) = UPPER(ut.route_code)
        WHERE ut.email <> $1
          AND r.day_offset = ($2::date - ut.start_date)
      )
      SELECT
        o.city,
        $2::date AS date,
        json_agg(
          jsonb_build_object(
            'name', o.name
          )
        ) AS people
      FROM others_on_date o
      JOIN my_city m
        ON m.city = o.city
      GROUP BY o.city
      `,
      [email, date]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('MATCH ERROR:', err);

    const message =
      err.code === 'ECONNREFUSED'
        ? 'Database connection refused'
        : 'Match error';

    res.status(500).json({ error: message });
  }
});

/* ===============================
   PROFILE (NUEVO)
================================ */
app.get('/api/profile', async (req, res) => {
  if (!ensureDatabase(res)) return;

  const { name } = req.query;

  const r = await pool.query(
    `SELECT name, phone FROM profiles WHERE name=$1`,
    [name]
  );

  if (!r.rowCount) return res.sendStatus(403);
  res.json(r.rows[0]);
});

/* ===============================
   SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);
