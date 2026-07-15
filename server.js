const express = require("express");
const app = express();
const connectDB = require("./database/connection");
const mongoose = require("mongoose");
const path = require('path');
const { requireAuth, requireRole } = require('./middleware/auth');

// Import Routes
const equipmentRoutes = require("./routes/equipmentRoutes");
const requestRoutes = require("./routes/requestRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require('./routes/notificationRoutes');

const PORT = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Server-protected dashboard pages
app.get('/pages/admin.html', requireRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'admin.html'));
});
app.get('/pages/technicians.html', requireRole('technician'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'technicians.html'));
});
app.get('/pages/operations.html', requireRole('user'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'operations.html'));
});
app.get('/pages/profile.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'profile.html'));
});

// Serve public frontend assets and login page
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
    }
}));

// Use Routes
app.use("/equipment", requireAuth, equipmentRoutes);
app.use("/requests", requireAuth, requestRoutes);
app.use("/users", userRoutes);
app.use('/notifications', notificationRoutes);

// Home Route
app.get("/", (req, res) => {
    res.redirect("/pages/login.html");
});

app.get("/database/status", (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.json({
        success: true,
        connected,
        database: mongoose.connection.name || "equipment",
        accountDatabase: 'MongoDB',
        accountsConnected: connected,
        message: connected ? "Database connected" : "Database not connected"
    });
});

app.get('/health', (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? 'ok' : 'unavailable',
        database: databaseReady ? 'connected' : 'disconnected'
    });
});

// Start Server
const startServer = async () => {
    const connected = await connectDB();
    if (!connected && process.env.NODE_ENV === 'production') {
        console.error('Server stopped because the production database is unavailable.');
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    const shutdown = signal => {
        console.log(`${signal} received. Closing server.`);
        server.close(async () => {
            await mongoose.connection.close().catch(() => {});
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
