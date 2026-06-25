// index.js - Production Server Entry Point
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import registerSocketEvents from './socket/events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection pooling setup
console.log("MONGODB_URI =", process.env.MONGODB_URI);
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  try {
    mongoose.connection.on('error', err => {
      console.error('MongoDB runtime connection error:', err.message);
    });

    mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000
    })
      .then(() => console.log('Successfully connected to MongoDB.'))
      .catch(err => {
        console.log('Mongo unavailable - continue without DB');
        console.error('MongoDB connection error details:', err.message);
      });
  } catch (err) {
    console.log('Mongo unavailable - continue without DB');
    console.error('MongoDB setup error:', err.message);
  }
} else {
  console.warn('MONGODB_URI is not defined. Persistent match logging is disabled.');
}

const app = express();

// Security and compression middlewares
app.use(helmet({
  contentSecurityPolicy: false // Disabled for static file rendering comfort
}));
app.use(compression());

// Serve static assets from build
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// API Request rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a minute.' }
});
app.use(limiter);

// Dynamic CORS configurations
const clientOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  process.env.CLIENT_URL_PROD || 'https://YOURAPP.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: true,
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'ok',
    time: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Kachuful production server is running. Front-end build not found.');
    }
  });
});

const httpServer = createServer(app);

// Socket.IO Server configuration
const io = new Server(httpServer, {
  pingInterval: parseInt(process.env.PING_INTERVAL) || 30000,
  pingTimeout: parseInt(process.env.PING_TIMEOUT) || 5000,
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Bind sockets events
registerSocketEvents(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Kachuful server running on port ${PORT} in ${process.env.NODE_ENV} mode.`);
});

// Graceful Shutdown hooks
const gracefulShutdown = (signal) => {
  console.log(`[${signal}] shutdown signal received. Terminating process gracefully.`);
  httpServer.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close(false)
      .then(() => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      })
      .catch(err => {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
      });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
