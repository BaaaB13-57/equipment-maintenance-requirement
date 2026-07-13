const mongoose = require("mongoose");
const User = require("../models/User");

const fallbackUsers = [
    { name: "Admin User", email: "admin@minekeeper.com", username: "admin", password: "demo123", role: "admin", department: "Management", status: "Active" },
    { name: "User Account", email: "user@minekeeper.com", username: "user", password: "demo123", role: "user", department: "Operations", status: "Active" },
    { name: "Technician Account", email: "technician@minekeeper.com", username: "technician", password: "demo123", role: "technician", department: "Maintenance", status: "Active" }
];

const dashboardByRole = {
    admin: "/pages/admin.html",
    user: "/pages/operations.html",
    technician: "/pages/technicians.html"
};

const isDbReady = () => mongoose.connection.readyState === 1;

const publicUser = (user) => {
    const plain = user.toObject ? user.toObject() : user;
    return {
        id: plain._id || plain.email,
        name: plain.name,
        email: plain.email,
        username: plain.username,
        role: plain.role,
        department: plain.department,
        phone: plain.phone || "",
        status: plain.status || "Active",
        dashboard: dashboardByRole[plain.role] || dashboardByRole.user
    };
};

const getAllUsers = async (req, res) => {
    const users = isDbReady() ? await User.find().sort({ role: 1, name: 1 }) : fallbackUsers;
    res.json({ success: true, users: users.map(publicUser) });
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const loginId = email.trim().toLowerCase();
    const user = isDbReady()
        ? await User.findOne({
            $or: [{ email: loginId }, { username: loginId }],
            password,
            status: "Active"
        })
        : fallbackUsers.find(account =>
            (account.email === loginId || account.username === loginId) &&
            account.password === password &&
            account.status === "Active"
        );

    if (user) {
        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: publicUser(user)
        });
    }

    return res.status(401).json({
        success: false,
        message: "Invalid email or password"
    });
};

const registerUser = async (req, res) => {
    const { name, email, username, password, role, department, phone } = req.body;
    if (!name || !email || !username || !password) {
        return res.status(400).json({ success: false, message: "Name, email, username, and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (cleanUsername.includes("@")) {
        return res.status(400).json({ success: false, message: "Username should be a simple name, not an email address" });
    }

    const createdUser = {
        name: name.trim(),
        email: cleanEmail,
        username: cleanUsername,
        password,
        role: role || "user",
        department: department || "Operations",
        phone: phone || "",
        status: "Active"
    };

    if (!isDbReady()) {
        const existingUser = fallbackUsers.find(user =>
            user.email === cleanEmail ||
            user.username === cleanUsername ||
            user.email === cleanUsername ||
            user.username === cleanEmail
        );
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Email or username already exists" });
        }
        fallbackUsers.push(createdUser);
        return res.status(201).json({ success: true, message: "User registered successfully", user: publicUser(createdUser) });
    }

    try {
        const existingUser = await User.findOne({
            $or: [
                { email: cleanEmail },
                { username: cleanUsername },
                { email: cleanUsername },
                { username: cleanEmail }
            ]
        });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Email or username already exists" });
        }

        const savedUser = await User.create(createdUser);
        res.status(201).json({ success: true, message: "User registered successfully", user: publicUser(savedUser) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "Email or username already exists" });
        }
        throw error;
    }
};

const updateUser = async (req, res) => {
    if (!isDbReady()) {
        const user = fallbackUsers.find(account => account.email === req.params.id || account.username === req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        Object.assign(user, req.body);
        return res.json({ success: true, message: "User updated successfully", user: publicUser(user) });
    }

    const user = await User.findOneAndUpdate(
        { $or: [{ email: req.params.id }, { username: req.params.id }] },
        { $set: req.body },
        { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User updated successfully", user: publicUser(user) });
};

module.exports = {
    getAllUsers,
    registerUser,
    loginUser,
    updateUser
};
