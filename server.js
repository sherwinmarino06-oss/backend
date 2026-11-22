const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

// Optional: lets you use a local .env file when testing on your own computer.
// On Render this does nothing (Render provides the env variables itself).
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed - that's fine
}

const app = express();
const PORT = process.env.PORT || 8080;

// ===== DATABASE (TiDB Cloud / any MySQL) =====
const isLocalDb = !process.env.DB_HOST || process.env.DB_HOST === 'localhost';

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || (isLocalDb ? 3306 : 4000),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'barbershop_db',
  // TiDB Cloud requires TLS. Skipped only when connecting to localhost.
  ssl: isLocalDb
    ? undefined
    : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 20000,
});

db.getConnection()
  .then((conn) => {
    console.log('Database Connected');
    conn.release();
  })
  .catch((err) => {
    console.log('Database error:', err.code, '-', err.message);
    if (err.errors) {
      err.errors.forEach((e) => console.log('  ->', e.code, e.address, e.port));
    }
  });

// ===== MIDDLEWARE =====
app.use(express.json());

// Set CORS_ORIGIN on Render to your Netlify URL (e.g. https://your-site.netlify.app)
// to restrict access. If not set, everything is allowed.
app.use(
  cors(
    process.env.CORS_ORIGIN
      ? { origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }
      : undefined
  )
);

// Simple health check (useful for Render and for testing in the browser)
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'barbershop-backend' });
});

// ===== RESERVATIONS (MySQL table: reservations) =====
// DB columns: id, client_name, barber, service, reservation_date, reservation_time, status
// React fields: id, clientName, barber, service, date, time, status

app.get('/api/reservations', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,
              client_name AS clientName,
              barber,
              service,
              DATE_FORMAT(reservation_date, '%Y-%m-%d') AS \`date\`,
              reservation_time AS \`time\`,
              status
       FROM reservations`
    );
    res.json(rows);
  } catch (err) {
    console.log('GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const { clientName, barber, service, date, time, status } = req.body;
    const finalStatus = status || 'Pending';

    const [result] = await db.query(
      `INSERT INTO reservations
         (client_name, barber, service, reservation_date, reservation_time, status)
       VALUES (?,?,?,?,?,?)`,
      [clientName, barber, service, date, time, finalStatus]
    );

    const newReservation = {
      id: result.insertId,
      clientName,
      barber,
      service,
      date,
      time,
      status: finalStatus,
    };
    console.log('Added:', newReservation);
    res.status(201).json(newReservation);
  } catch (err) {
    console.log('POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, barber, service, date, time, status } = req.body;

    const [result] = await db.query(
      `UPDATE reservations
       SET client_name = ?, barber = ?, service = ?,
           reservation_date = ?, reservation_time = ?,
           status = COALESCE(?, status)
       WHERE id = ?`,
      [clientName, barber, service, date, time, status ?? null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const updated = { id: Number(id), clientName, barber, service, date, time };
    if (status) updated.status = status;
    console.log('Edited:', updated);
    res.json(updated);
  } catch (err) {
    console.log('PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM reservations WHERE id = ?', [id]);
    console.log('Deleted id:', id);
    res.json({ message: 'Deleted', id: Number(id) });
  } catch (err) {
    console.log('DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== USER =====
// Every route now has try/catch and always sends a response,
// so requests no longer hang and the server won't crash on a DB error.

app.get('/api/user', async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM user');
    res.json(users);
  } catch (err) {
    console.log('GET user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user', async (req, res) => {
  try {
    const { name, role } = req.body;
    const [result] = await db.query(
      'INSERT INTO user (name, role) VALUES (?,?)',
      [name, role]
    );
    res.status(201).json({ user_id: result.insertId, name, role });
  } catch (err) {
    console.log('POST user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/:id', async (req, res) => {
  try {
    const { name, role } = req.body;
    const [result] = await db.query(
      'UPDATE user SET name = ?, role = ? WHERE user_id = ?',
      [name, role, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user_id: Number(req.params.id), name, role });
  } catch (err) {
    console.log('PUT user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM user WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'Deleted', user_id: Number(req.params.id) });
  } catch (err) {
    console.log('DELETE user error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});