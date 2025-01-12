const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Use PORT from environment variable or default to 5001
const PORT = process.env.PORT || 5001;

// Define Frontend URL as a variable
const FRONTEND_URL = 'https://website-frontend-alpha-one.vercel.app'; 

// CORS configuration
app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
}));

// Create an HTTP server and bind it to Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST'],
    },
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for incoming messages
    socket.on('sendMessage', (data) => {
        const { username, text } = data;
        const message = { username, text };
        // Broadcast the message to all connected clients
        io.emit('receiveMessage', message);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
