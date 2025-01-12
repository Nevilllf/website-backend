const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();

// Use PORT from environment variable or default to 5001
const PORT = process.env.PORT || 5001;

// Define Frontend URL as a variable
const FRONTEND_URL = 'https://website-frontend-alpha-one.vercel.app'; // Replace with your actual frontend URL

// CORS configuration
app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
}));
app.use(express.json());

// In-memory storage
const users = {}; // { username: { passwordHash: string } }
const chatRooms = {}; // { roomName: { messages: [] } }
const roomCreationTimestamps = {}; // { socketId: timestamp }
const MAX_CHAT_ROOMS = 15; // Limit on the number of chat rooms
const MAX_MESSAGES = 100; // Limit on messages stored per room
const ROOM_CREATION_LIMIT_MS = 60000; // Time limit for creating rooms (e.g., 1 minute)

// User registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    // Validate username and password
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        return res.status(400).json({ message: 'Username can only contain letters and numbers.' });
    }
    if (users[username]) {
        return res.status(400).json({ message: 'Username already exists.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    // Hash the password and save the user
    const passwordHash = await bcrypt.hash(password, 10);
    users[username] = { passwordHash };
    res.json({ message: 'User registered successfully.' });
});

// Chat room creation endpoint
app.post('/create-room', (req, res) => {
    const { roomName } = req.body;
    const socketId = req.headers['x-socket-id'];

    // Validate room name
    if (!roomName || roomName.trim().length === 0) {
        return res.status(400).json({ message: 'Room name cannot be empty.' });
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(roomName)) {
        return res.status(400).json({ message: 'Room name can only contain letters, numbers, hyphens, and underscores.' });
    }

    // Check room creation rate limit
    if (roomCreationTimestamps[socketId] && Date.now() - roomCreationTimestamps[socketId] < ROOM_CREATION_LIMIT_MS) {
        return res.status(429).json({ message: 'Please wait before creating another room.' });
    }

    roomCreationTimestamps[socketId] = Date.now();

    // Check for room limit and existing room
    if (Object.keys(chatRooms).length >= MAX_CHAT_ROOMS) {
        return res.status(400).json({ message: 'No space available for new chat rooms.' });
    }
    if (chatRooms[roomName]) {
        return res.status(400).json({ message: 'Chat room already exists.' });
    }

    chatRooms[roomName] = { messages: [] };
    res.json({ message: 'Chat room created successfully.', roomName });
});

// Get list of available chat rooms
app.get('/rooms', (req, res) => {
    res.json(Object.keys(chatRooms));
});

// WebSocket setup
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a chat room
    socket.on('joinRoom', (roomName) => {
        if (!chatRooms[roomName]) {
            return socket.emit('error', { message: 'Chat room does not exist.' });
        }
        socket.join(roomName);
        socket.emit('chatHistory', chatRooms[roomName].messages);
    });

    // Handle incoming messages
    socket.on('sendMessage', ({ roomName, username, text }) => {
        if (!chatRooms[roomName]) {
            return;
        }

        const message = { username, text, timestamp: new Date().toLocaleString() };
        chatRooms[roomName].messages.push(message);

        // Keep only the most recent MAX_MESSAGES
        if (chatRooms[roomName].messages.length > MAX_MESSAGES) {
            chatRooms[roomName].messages.shift();
        }

        io.to(roomName).emit('receiveMessage', message);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
