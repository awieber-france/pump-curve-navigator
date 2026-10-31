const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'calibrations.json');

app.use(cors());
app.use(express.json());

const readData = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading data file:', err);
    return [];
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing data file:', err);
  }
};

app.get('/api/calibrations', (req, res) => {
  const data = readData();
  res.json(data);
});

app.get('/api/calibrations/:id', (req, res) => {
  const data = readData();
  const item = data.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Calibration profile not found' });
  res.json(item);
});

app.post('/api/calibrations', (req, res) => {
  const { name, origin, flowRef, headRef } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const data = readData();
  const newItem = {
    id: Date.now().toString(),
    name,
    origin,
    flowRef,
    headRef,
    createdAt: new Date().toISOString()
  };
  data.push(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

app.delete('/api/calibrations/:id', (req, res) => {
  const data = readData();
  const filtered = data.filter(i => i.id !== req.params.id);
  writeData(filtered);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
