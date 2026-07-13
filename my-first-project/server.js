const express = require("express");
const app = express();
const connectDB = require("./database/connection");
const mongoose = require("mongoose");
const path = require('path');

// Import Routes
const equipmentRoutes = require("./routes/equipmentRoutes");
const requestRoutes = require("./routes/requestRoutes");
const userRoutes = require("./routes/userRoutes");

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
    }
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use Routes
app.use("/equipment", equipmentRoutes);
app.use("/requests", requestRoutes);
app.use("/users", userRoutes);

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
        message: connected ? "Database connected" : "Database not connected"
    });
});

// Start Server`
const startServer = async () => {
    await connectDB();

    app.listen(3000, () => {
        console.log("Server is running on http://localhost:3000");
    });
};

startServer();
