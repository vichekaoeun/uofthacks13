const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./database');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');

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

// Routes
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} and connected to the database`);
  });
});

