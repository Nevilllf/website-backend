const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Environment Variables
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://website-frontend-alpha-one.vercel.app';
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

// CORS Configuration
app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
}));
app.use(express.json());

// In-memory storage
const users = {}; // { username: { passwordHash: string } }
const chatRooms = {}; // { roomName: { messages: [], users: [] } }
const MAX_CHAT_ROOMS = 15;
const MAX_MESSAGES = 100;

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// User registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        return res.status(400).json({ message: 'Username can only contain letters and numbers.' });
    }
    if (users[username]) {
        return res.status(400).json({ message: 'Username already exists.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    users[username] = { passwordHash };
    res.json({ message: 'User registered successfully.' });
});

// User login endpoint
app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    if (!users[username]) {
        return res.status(400).json({ message: 'User does not exist.' });
    }

    const isPasswordValid = await bcrypt.compare(password, users[username].passwordHash);
    if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign({ username }, SECRET_KEY, {
        expiresIn: rememberMe ? '7d' : '1h',
    });

    res.json({ message: 'Login successful.', token });
});

// Endpoint to verify a token and auto-login
app.get('/verify-token', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        res.json({ username: decoded.username });
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
});

// Chat room creation endpoint
app.post('/create-room', verifyToken, (req, res) => {
    const { roomName } = req.body;

    if (!roomName || roomName.trim().length === 0) {
        return res.status(400).json({ message: 'Room name cannot be empty.' });
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(roomName)) {
        return res.status(400).json({ message: 'Room name can only contain letters, numbers, hyphens, and underscores.' });
    }

    if (Object.keys(chatRooms).length >= MAX_CHAT_ROOMS) {
        return res.status(400).json({ message: 'No space available for new chat rooms.' });
    }
    if (chatRooms[roomName]) {
        return res.status(400).json({ message: 'Chat room already exists.' });
    }

    chatRooms[roomName] = { messages: [], users: [] };
    res.json({ message: 'Chat room created successfully.', roomName });
});

// Get list of available chat rooms
app.get('/rooms', verifyToken, (req, res) => {
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
    console.log(`User connected: ${socket.id}`);

    socket.on('joinRoom', ({ roomName, username }) => {
        if (!chatRooms[roomName]) {
            return socket.emit('error', { message: 'Chat room does not exist.' });
        }
        socket.join(roomName);
        chatRooms[roomName].users.push(socket.id);
        socket.emit('chatHistory', chatRooms[roomName].messages);
    });

    socket.on('sendMessage', ({ roomName, username, text }) => {
        if (!chatRooms[roomName]) {
            return;
        }

        const message = { username, text, timestamp: new Date().toLocaleString() };
        chatRooms[roomName].messages.push(message);

        if (chatRooms[roomName].messages.length > MAX_MESSAGES) {
            chatRooms[roomName].messages.shift();
        }

        io.to(roomName).emit('receiveMessage', message);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        Object.keys(chatRooms).forEach((roomName) => {
            chatRooms[roomName].users = chatRooms[roomName].users.filter((id) => id !== socket.id);
        });
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
