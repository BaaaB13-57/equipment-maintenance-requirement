const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { createSession, deleteSession, deleteUserSessions, getSession } = require('../middleware/auth');

const dashboardByRole = {
    admin: '/pages/admin.html',
    user: '/pages/operations.html',
    technician: '/pages/technicians.html'
};

const isDbReady = () => mongoose.connection.readyState === 1;

const publicUser = user => {
    const plain = user.toObject ? user.toObject() : user;
    return {
        id: plain._id || plain.email,
        name: plain.name,
        email: plain.email,
        username: plain.username,
        role: plain.role,
        department: plain.department,
        phone: plain.phone || '',
        status: plain.status || 'Active',
        dashboard: dashboardByRole[plain.role] || dashboardByRole.user
    };
};

function requireDatabase(res) {
    if (isDbReady()) return true;
    res.status(503).json({ success: false, message: 'The MongoDB account database is unavailable' });
    return false;
}

const getAllUsers = async (req, res) => {
    if (!requireDatabase(res)) return;
    const users = await User.find().sort({ role: 1, name: 1 });
    res.json({ success: true, users: users.map(publicUser) });
};

const loginUser = async (req, res) => {
    if (!requireDatabase(res)) return;
    const loginId = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!loginId || !password) {
        return res.status(400).json({ success: false, message: 'Username/email and password are required' });
    }

    const user = await User.findOne({
        $or: [{ email: loginId }, { username: loginId }],
        status: 'Active'
    });
    const storedPassword = user?.password || '';
    const isHashed = storedPassword.startsWith('$2');
    const passwordMatches = user && (isHashed
        ? await bcrypt.compare(password, storedPassword)
        : password === storedPassword);

    if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
    }

    if (!isHashed) {
        user.password = await bcrypt.hash(password, 12);
        await user.save();
    }

    // Attach legacy records to the immutable MongoDB account ID on first login.
    if (user.role === 'user') {
        await MaintenanceRequest.updateMany(
            { requesterEmail: user.email, requesterId: { $exists: false } },
            { $set: { requesterId: user._id } }
        );
    } else if (user.role === 'technician') {
        await MaintenanceRequest.updateMany(
            {
                assignedTechnicianId: { $exists: false },
                assignedTo: { $in: [user.name, user.email, user.username] }
            },
            { $set: { assignedTechnicianId: user._id } }
        );
    }

    const safeUser = publicUser(user);
    const sessionToken = createSession(safeUser);
    res.cookie('minekeep_session', sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/'
    });
    res.json({ success: true, message: 'Login successful', user: safeUser });
};

const registerUser = async (req, res) => {
    if (!requireDatabase(res)) return;
    const { name, email, username, password, role, department, phone } = req.body;
    if (!name || !email || !username || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, username, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const allowedRoles = ['admin', 'technician', 'user'];
    if (cleanUsername.includes('@') || !allowedRoles.includes(role || 'user')) {
        return res.status(400).json({ success: false, message: 'Enter a valid role and simple username' });
    }

    const existingUser = await User.findOne({ $or: [{ email: cleanEmail }, { username: cleanUsername }] });
    if (existingUser) return res.status(409).json({ success: false, message: 'Email or username already exists' });

    try {
        const user = await User.create({
            name: name.trim(),
            email: cleanEmail,
            username: cleanUsername,
            password: await bcrypt.hash(password, 12),
            role: role || 'user',
            department: department || 'Operations',
            phone: phone || '',
            status: 'Active'
        });
        res.status(201).json({ success: true, message: 'Account created by administrator', user: publicUser(user) });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email or username already exists' });
        throw error;
    }
};

const updateUser = async (req, res) => {
    if (!requireDatabase(res)) return;
    const allowedFields = ['name', 'email', 'username', 'role', 'department', 'phone', 'status'];
    const update = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) update[field] = req.body[field];
    }
    if (req.body.password) update.password = await bcrypt.hash(req.body.password, 12);
    if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'No valid changes supplied' });

    const user = await User.findOneAndUpdate(
        { $or: [{ email: req.params.id }, { username: req.params.id }] },
        { $set: update },
        { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.status === 'Inactive') deleteUserSessions(user._id);
    res.json({ success: true, message: 'User updated successfully', user: publicUser(user) });
};

const deleteUser = async (req, res) => {
    if (!requireDatabase(res)) return;
    const user = await User.findOne({ $or: [{ email: req.params.id }, { username: req.params.id }] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (String(user._id) === String(req.user.id)) {
        return res.status(400).json({ success: false, message: 'You cannot delete your own administrator account' });
    }
    await user.deleteOne();
    deleteUserSessions(user._id);
    res.json({ success: true, message: 'User deleted successfully' });
};

const logoutUser = (req, res) => {
    const session = getSession(req);
    if (session) deleteSession(session.token);
    res.clearCookie('minekeep_session', { httpOnly: true, sameSite: 'lax', path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
};

const getCurrentSession = (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ success: false, message: 'Authentication required' });
    res.json({ success: true, user: session.user });
};

module.exports = { getAllUsers, registerUser, loginUser, updateUser, deleteUser, logoutUser, getCurrentSession };
