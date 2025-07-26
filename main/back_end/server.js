import { createClient } from '@supabase/supabase-js'
import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import fetch from 'node-fetch'

const app = express()
const port = process.env.PORT || 3000

// create Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Root endpoint for basic testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'HCI Backend Server is running',
    endpoints: {
      health: '/health',
      signup: '/signup',
      login: '/login',
      rooms: '/rooms',
      reviews: '/reviews'
    },
    timestamp: new Date().toISOString()
  })
})

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
}

// POST /signup route
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body

  const { data, error } = await supabase
    .from('login') // make sure this matches your table name
    .insert([{ name, email, password }])

  if (error) {
    console.error(error)
    return res.status(500).json({ message: 'Signup failed' })
  }

  res.json({ message: 'Signup successful' })
})

// POST /login route
app.post('/login', async (req, res) => {
  const { name, email, password } = req.body

  const { data, error } = await supabase
    .from('login')
    .select('*')
    .eq('email', email)
    .eq('name', name)
    .eq('password', password) // NOTE: in real life, hash this

  if (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error checking credentials' })
  }

  if (data.length === 0) {
    return res.status(401).json({ message: 'Invalid login credentials' })
  }

  res.json({ message: 'Login successful' })
})

// POST /rooms route
app.post('/rooms', async (req, res) => {
  const { type, address, rate, lease, occupants, size, status, image_urls, move_in_date, amenities, rules } = req.body;

  const coords = await geocodeAddress(address);
  const { data, error } = await supabase
    .from('rooms')
    .insert([{
      type, address, rate, lease, occupants, size, status, image_urls, move_in_date, amenities, rules,
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null
    }]);

  if (error) {
    console.error(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ message: 'Room save failed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ message: 'Room saved successfully' });
});

// GET /rooms route
app.get('/rooms', async (req, res) => {
  const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
  if (error) {
    return res.status(500).json({ message: 'Failed to fetch rooms' });
  }
  res.json(data);
});

// GET /rooms/:id route
app.get('/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single();
  if (error) {
    return res.status(500).json({ message: 'Failed to fetch room' });
  }
  res.json(data);
});

// PUT /rooms/:id route
app.put('/rooms/:id', async (req, res) => {
  const { type, address, rate, lease, occupants, size, status, image_urls, move_in_date, amenities, rules } = req.body;

  // Geocode the address
  const coords = await geocodeAddress(address);

  const { data, error } = await supabase
    .from('rooms')
    .update({
      type, address, rate, lease, occupants, size, status, image_urls, move_in_date, amenities, rules,
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null
    })
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});


// POST /reviews - Add a review for a room
app.post('/reviews', async (req, res) => {
  const { room_id, name, comment } = req.body;
  if (!room_id || !name || !comment) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('reviews')
    .insert([{ room_id, name, comment }]);
  if (error) {
    return res.status(500).json({ message: 'Failed to save review' });
  }
  res.json({ message: 'Review saved successfully', data });
});

// GET /reviews/:room_id - Get all reviews for a room
app.get('/reviews/:room_id', async (req, res) => {
  const { room_id } = req.params;
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('room_id', room_id)
    .order('created_at', { ascending: false });
  if (error) {
    return res.status(500).json({ message: 'Failed to fetch reviews' });
  }
  res.json(data);
});

// PUT /reviews/:id - Update a review
app.put('/reviews/:id', async (req, res) => {
  const { id } = req.params;
  const { name, comment } = req.body;
  if (!name || !comment) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('reviews')
    .update({ name, comment })
    .eq('id', id)
    .select();
  if (error) {
    return res.status(500).json({ message: 'Failed to update review' });
  }
  res.json({ message: 'Review updated successfully', data });
});


// start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`Health check available at http://localhost:${port}/health`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Supabase URL configured: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`)
})
