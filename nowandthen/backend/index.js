const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./database');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Now and Then API' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Expose runtime config (useful for client to read API host)
app.get('/config', (req, res) => {
  const host = process.env.API_HOST || 'localhost';
  const apiBase = `http://${host}:${PORT}/api`;
  res.json({ apiBase });
});

// Routes
app.use('/api/users', userRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} and connected to the database`);
  });
});

