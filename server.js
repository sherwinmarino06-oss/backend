const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json()); 
app.use(cors());       

let reservations = [
  {
    id: 1,
    clientName: 'Sherwin',
    barber: 'Jeff',
    service: 'Haircut',
    date: '2026-09-12',
    time: '7:30 PM'
  },
  {
    id: 2,
    clientName: 'Arlan',
    barber: 'Heart',
    service: 'Shave',
    date: '2026-09-13',
    time: '3:00 PM'
  }
];
let nextId = 3;

app.get('/api/reservations', (req, res) => {
  res.json(reservations); 
});

app.post('/api/reservations', (req, res) => {
  const newReservation = { id: nextId++, ...req.body };
  reservations.push(newReservation);
  res.status(201).json(newReservation);
});

app.put('/api/reservations/:id', (req, res) => {
  const { id } = req.params;

  const editID = reservations.findIndex((r) => r.id === Number(id));

  reservations[editID] = {
    id: Number(id),
    clientName: req.body.clientName,
    barber: req.body.barber,
    service: req.body.service,
    date: req.body.date,
    time: req.body.time
  };

  res.json(reservations[editID]);
  console.log(reservations[editID]);
});


app.delete('/api/reservations/:id', (req, res) => {
  const { id } = req.params;
  reservations = reservations.filter((r) => r.id !== Number(id));
  res.json({ message: 'Deleted', id: Number(id) });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});