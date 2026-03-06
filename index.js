require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

/* ===============================
   DATABASE
================================ */

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
  : null;

function ensureDatabase(res) {
  if (!pool) {
    res.status(500).json({ error: 'Database not configured' });
    return false;
  }
  return true;
}

/* ===============================
   HELPERS
================================ */

async function calculateEndDate(routeCode, startDate) {

  const duration = await pool.query(
    `
    SELECT MAX(day_offset) AS max_day
    FROM routes
    WHERE UPPER(code)=UPPER($1)
    `,
    [routeCode]
  );

  if (!duration.rows[0].max_day) {
    throw new Error('Invalid route');
  }

  const maxDay = duration.rows[0].max_day;

  const endDateResult = await pool.query(
    `
    SELECT ($1::date + $2  * INTERVAL '1 day')::date AS end_date
    `,
    [startDate, maxDay]
  );

  return endDateResult.rows[0].end_date;
}

async function checkOverlap(email, startDate, endDate, excludeId = null) {

  let query = `
  SELECT 1
  FROM user_trips
  WHERE email = $1
  AND start_date < $3
  AND end_date > $2
  AND end_date <> $2
  `;

  const params = [email, startDate, endDate];

  if (excludeId) {
    query += ` AND id <> $4`;
    params.push(excludeId);
  }

  query += ` LIMIT 1`;

  const conflict = await pool.query(query, params);

  return conflict.rowCount > 0;
}

/* ===============================
   ROOT
================================ */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

/* ===============================
   ROUTES LIST
================================ */

app.get('/api/routes', async (_, res) => {
  if (!ensureDatabase(res)) return;

  try {

    const r = await pool.query(
      `SELECT DISTINCT code FROM routes ORDER BY code`
    );

    res.json(r.rows);

  } catch (err) {

    console.error('ROUTES ERROR:', err);
    res.status(500).json({ error: 'Failed to load routes' });

  }
});

/* ===============================
   CREATE TRIP
================================ */

app.post('/api/trips', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { email, name, routeCode, startDate } = req.body;

  if (!email || !name || !routeCode || !startDate) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {

    const endDate = await calculateEndDate(routeCode, startDate);

    const overlap = await checkOverlap(email, startDate, endDate);

    if (overlap) {
      return res.status(400).json({
        error: 'Trip overlaps an existing trip'
      });
    }

    await pool.query(
      `
      INSERT INTO user_trips
      (email,name,route_code,start_date,end_date)
      VALUES ($1,$2,UPPER($3),$4,$5)
      `,
      [email, name, routeCode, startDate, endDate]
    );

    res.json({ ok: true });

  } catch (err) {

    console.error('CREATE TRIP ERROR:', err);
    res.status(500).json({ error: err.message });

  }

});

/* ===============================
   USER TOURS
================================ */

app.get('/api/user-tours', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { email } = req.query;

  try {

    const result = await pool.query(
      `
      SELECT id, route_code, start_date, end_date, visible
      FROM user_trips
      WHERE email = $1
      ORDER BY start_date
      `,
      [email]
    );

    res.json(result.rows);

  } catch (err) {

    console.error('USER TOURS ERROR:', err);
    res.status(500).json({ error: 'Failed to load tours' });

  }

});

/* ===============================
   EDIT TRIP
================================ */

app.put('/api/user-tours/:id', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { id } = req.params;
  const { email, routeCode, startDate } = req.body;

  if (!email || !routeCode || !startDate) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {

    const endDate = await calculateEndDate(routeCode, startDate);

    const overlap = await checkOverlap(email, startDate, endDate, id);

    if (overlap) {
      return res.status(400).json({
        error: 'Trip overlaps an existing trip'
      });
    }

    const result = await pool.query(
      `
      UPDATE user_trips
      SET route_code = UPPER($1),
          start_date = $2,
          end_date = $3
      WHERE id = $4
      AND email = $5
      `,
      [routeCode, startDate, endDate, id, email]
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
   DELETE TRIP
================================ */

app.delete('/api/user-tours/:id', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { id } = req.params;
  const { email } = req.query;

  try {

    const result = await pool.query(
      `
      DELETE FROM user_trips
      WHERE id = $1
      AND email = $2
      `,
      [id, email]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Tour not found' });
    }

    res.json({ success: true });

  } catch (err) {

    console.error('DELETE ERROR:', err);
    res.status(500).json({ error: 'Delete failed' });

  }

});

/* ===============================
   TOUR VISIBILITY
================================ */

app.post('/api/tour/visibility', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { tripId, visible } = req.body;

  if (tripId === undefined || visible === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {

    const result = await pool.query(
      `
      UPDATE user_trips
      SET visible = $1
      WHERE id = $2
      `,
      [visible, tripId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Tour not found' });
    }

    res.json({ success: true });

  } catch (err) {

    console.error('VISIBILITY ERROR:', err);
    res.status(500).json({ error: 'Failed to update visibility' });

  }

});



/* ===============================
   MATCHES
================================ */

app.get('/api/matches/grouped', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { email, date } = req.query;

  if (!email || !date) {
    return res.status(400).json({
      error: 'Missing required query params'
    });
  }

  try {

    const result = await pool.query(
      `
      WITH my_trip AS (
        SELECT
          ut.route_code,
          ut.start_date,
          ($2::date - ut.start_date) AS trip_day
        FROM user_trips ut
        WHERE ut.email = $1
        LIMIT 1
      ),

      visibility_check AS (
        SELECT
          CASE
            WHEN mt.start_date IS NULL THEN 'hidden'
            WHEN mt.start_date > CURRENT_DATE + INTERVAL '10 days' THEN 'too_early'
            WHEN $2::date < CURRENT_DATE THEN 'past'
            ELSE 'ok'
          END AS reason
        FROM my_trip mt
      ),

      my_city AS (
        SELECT r.city
        FROM routes r
        JOIN my_trip mt
          ON r.code = mt.route_code
         AND r.day_offset = mt.trip_day
      ),

      others_on_date AS (
        SELECT ut.name, r.city
        FROM user_trips ut
        JOIN routes r
          ON r.code = ut.route_code
        JOIN my_trip mt
          ON r.code = mt.route_code
         AND r.day_offset = mt.trip_day
        WHERE ut.email <> $1
        AND ut.visible = TRUE
        AND $2::date BETWEEN ut.start_date AND ut.end_date
      )

      SELECT
        vc.reason,
        m.city,
        $2::date AS date,
        COALESCE(
          json_agg(jsonb_build_object('name', o.name))
          FILTER (WHERE o.name IS NOT NULL),
          '[]'
        ) AS people
      FROM visibility_check vc
      LEFT JOIN my_city m ON TRUE
      LEFT JOIN others_on_date o ON m.city = o.city
      GROUP BY vc.reason, m.city;
      `,
      [email, date]
    );

    res.json(result.rows);

  } catch (err) {

    console.error('MATCH ERROR:', err);
    res.status(500).json({ error: 'Match error' });

  }

});

/* ===============================
   PROFILE
================================ */

app.get('/api/profile', async (req, res) => {

  if (!ensureDatabase(res)) return;

  const { name } = req.query;

  try {

    const r = await pool.query(
      `SELECT name, phone FROM profiles WHERE name=$1`,
      [name]
    );

    if (!r.rowCount) return res.sendStatus(403);

    res.json(r.rows[0]);

  } catch (err) {

    console.error('PROFILE ERROR:', err);
    res.status(500).json({ error: 'Profile lookup failed' });

  }

});

/* ===============================
   SERVER
================================ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});