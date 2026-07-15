const crypto = require('crypto');

const sessions = new Map();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function parseCookies(header = '') {
    return header.split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');
        if (separator === -1) return cookies;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);
        return cookies;
    }, {});
}

function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        user: {
            id: String(user.id || user.email),
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role
        },
        expiresAt: Date.now() + SESSION_DURATION_MS
    });
    return token;
}

function deleteSession(token) {
    if (token) sessions.delete(token);
}

function deleteUserSessions(userId) {
    for (const [token, session] of sessions.entries()) {
        if (String(session.user.id) === String(userId)) sessions.delete(token);
    }
}

function getSession(req) {
    const token = parseCookies(req.headers.cookie).minekeep_session;
    const session = token ? sessions.get(token) : null;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return { ...session, token };
}

function requireAuth(req, res, next) {
    const session = getSession(req);
    if (!session) {
        if (req.originalUrl.startsWith('/pages/')) return res.redirect('/pages/login.html?reason=unauthorized');
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    req.user = session.user;
    req.sessionToken = session.token;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        const session = getSession(req);
        const isPageRequest = req.originalUrl.startsWith('/pages/');
        if (!session) {
            if (isPageRequest) return res.redirect('/pages/login.html?reason=unauthorized');
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        if (!roles.includes(session.user.role)) {
            const dashboards = {
                admin: '/pages/admin.html',
                technician: '/pages/technicians.html',
                user: '/pages/operations.html'
            };
            if (isPageRequest) {
                const destination = dashboards[session.user.role] || '/pages/login.html';
                return res.redirect(`${destination}?reason=forbidden`);
            }
            return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
        }
        req.user = session.user;
        req.sessionToken = session.token;
        next();
    };
}

module.exports = { createSession, deleteSession, deleteUserSessions, getSession, requireAuth, requireRole };
