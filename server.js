const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); //import mysql
const app = express();
const PORT = process.env.PORT || 8080;
 
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'barbershop_db'
})
 
db.getConnection()
    .then((conn) => {
        console.log('Database Connected');
        conn.release();
    })
    .catch((err) => console.log('Database error:', err.message));
 
app.use(express.json()); 
app.use(cors());       
 
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
      status: finalStatus
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
 
// ===== USER (unchanged) =====
app.get('/api/user', async (req, res) => {
    const [user] = await db.query('SELECT * FROM user');
    res.json(user);
})
 
app.post('/api/user', async (req, res) => {
    await db.query('INSERT INTO user (name, role) VALUES (?,?) ', [req.body.name,req.body.role]);
})
 
app.delete('/api/user/:id', async (req, res) => {
    await db.query('DELETE FROM user WHERE user_id = ?', req.params.id);
})
 
app.put('/api/user/:id', async (req, res) => {
    await db.query('UPDATE user SET name = ?, role = ? WHERE user_id = ?', [req.body.name, req.body.role, req.params.id]);
})
 
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});