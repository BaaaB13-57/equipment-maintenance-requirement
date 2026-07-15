const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const MaintenanceRequest = require('../models/MaintenanceRequest');

const visibleTypesByRole = {
    user: ['request_submitted', 'request_updated', 'repair_completed', 'request_rejected', 'new_message'],
    admin: ['new_request', 'repair_updated', 'technician_repair_completed'],
    technician: ['work_assigned']
};
const userFilter = user => ({
    userId: new mongoose.Types.ObjectId(user.id),
    type: { $in: visibleTypesByRole[user.role] || [] }
});

async function ensureTechnicianAssignmentNotifications(user) {
    if (user.role !== 'technician') return;
    const identities = [user.id, user.email, user.username, user.name].filter(Boolean);
    const assignments = await MaintenanceRequest.find({
        $or: [
            ...(mongoose.isValidObjectId(user.id) ? [{ assignedTechnicianId: user.id }] : []),
            { assignedTo: { $in: identities } }
        ]
    }).select('_id requestId equipment').lean();
    if (!assignments.length) return;

    const existing = await Notification.find({
        userId: user.id,
        type: 'work_assigned',
        requestId: { $in: assignments.map(item => item.requestId) }
    }).distinct('requestId');
    const existingIds = new Set(existing);
    const missing = assignments.filter(item => !existingIds.has(item.requestId));
    if (!missing.length) return;

    await Notification.insertMany(missing.map(item => ({
        userId: user.id,
        maintenanceRequestId: item._id,
        requestId: item.requestId,
        type: 'work_assigned',
        title: 'New Maintenance Assignment',
        message: `Admin assigned ${item.requestId} for ${item.equipment} to you.`
    })));
}

async function ensureAdminNotifications(user) {
    if (user.role !== 'admin') return;
    const requests = await MaintenanceRequest.find()
        .select('_id requestId equipment requesterName assignedTo status').lean();
    if (!requests.length) return;

    const existing = await Notification.find({
        userId: user.id,
        type: { $in: ['new_request', 'repair_updated', 'technician_repair_completed'] },
        requestId: { $in: requests.map(item => item.requestId) }
    }).select('requestId type').lean();
    const existingKeys = new Set(existing.map(item => `${item.type}:${item.requestId}`));
    const expected = requests.flatMap(item => {
        const entries = [{ item, type: 'new_request', key: `new_request:${item.requestId}` }];
        if (['assigned', 'inspection', 'in-progress', 'testing'].includes(item.status)) {
            entries.push({ item, type: 'repair_updated', key: `repair_updated:${item.requestId}` });
        }
        if (item.status === 'completed') {
            entries.push({ item, type: 'technician_repair_completed', key: `technician_repair_completed:${item.requestId}` });
        }
        return entries;
    });
    const missing = expected.filter(entry => !existingKeys.has(entry.key));
    if (!missing.length) return;

    await Notification.insertMany(missing.map(({ item, type }) => ({
        userId: user.id,
        maintenanceRequestId: item._id,
        requestId: item.requestId,
        type,
        title: type === 'new_request' ? 'New Maintenance Request' : type === 'technician_repair_completed' ? 'Repair Completed' : 'Repair Updated',
        message: type === 'new_request'
            ? `${item.requesterName || 'A user'} submitted ${item.requestId} for ${item.equipment}.`
            : type === 'technician_repair_completed'
                ? `${item.assignedTo || 'A technician'} completed ${item.requestId} for ${item.equipment}.`
                : `${item.assignedTo || 'A technician'} is working on ${item.requestId} for ${item.equipment}.`
    })));
}

async function ensureUserNotifications(user) {
    if (user.role !== 'user') return;
    const identities = [user.email].filter(Boolean);
    const ownedRequests = await MaintenanceRequest.find({
        $or: [
            ...(mongoose.isValidObjectId(user.id) ? [{ requesterId: user.id }] : []),
            { requesterEmail: { $in: identities } }
        ]
    }).select('_id requestId equipment status rejectionReason').lean();
    const requests = ownedRequests.filter(item => ['completed', 'rejected'].includes(item.status));
    if (!requests.length) return;

    const existing = await Notification.find({
        userId: user.id,
        type: { $in: ['repair_completed', 'request_rejected'] },
        requestId: { $in: requests.map(item => item.requestId) }
    }).select('requestId type').lean();
    const existingKeys = new Set(existing.map(item => `${item.type}:${item.requestId}`));
    const missing = requests.map(item => {
        const type = item.status === 'completed' ? 'repair_completed' : 'request_rejected';
        return { item, type, key: `${type}:${item.requestId}` };
    }).filter(entry => !existingKeys.has(entry.key));
    if (!missing.length) return;

    await Notification.insertMany(missing.map(({ item, type }) => ({
        userId: user.id,
        maintenanceRequestId: item._id,
        requestId: item.requestId,
        type,
        title: type === 'repair_completed' ? 'Repair Completed' : 'Request Rejected',
        message: type === 'repair_completed'
            ? `Your equipment repair has been completed for ${item.requestId}.`
            : `Your maintenance request was rejected.${item.rejectionReason ? ` Reason: ${item.rejectionReason}` : ''}`
    })));
}

const getNotifications = async (req, res) => {
    if (!mongoose.isValidObjectId(req.user.id)) {
        return res.status(400).json({ success: false, message: 'Invalid user account' });
    }
    await ensureTechnicianAssignmentNotifications(req.user);
    await ensureAdminNotifications(req.user);
    await ensureUserNotifications(req.user);
    const filter = userFilter(req.user);
    const [notifications, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
        Notification.countDocuments({ ...filter, readAt: null })
    ]);
    res.json({ success: true, unreadCount, notifications });
};

const markNotificationRead = async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, ...userFilter(req.user) },
        { $set: { readAt: new Date() } },
        { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification });
};

const markAllNotificationsRead = async (req, res) => {
    const result = await Notification.updateMany(
        { ...userFilter(req.user), readAt: null },
        { $set: { readAt: new Date() } }
    );
    res.json({ success: true, updated: result.modifiedCount });
};

const deleteNotification = async (req, res) => {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, ...userFilter(req.user) });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
};

module.exports = { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification };
