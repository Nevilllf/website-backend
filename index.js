const express = require('express');
const cors = require('cors');
const app = express();

// Use PORT from environment variable or default to 5001
const PORT = process.env.PORT || 5001;

// CORS configuration
app.use(cors({
    origin: 'https://website-frontend-alpha-one.vercel.app', 
    methods: ['GET', 'POST'], // Specify allowed HTTP methods
}));

// Sample API endpoint
app.get('/api/message', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
