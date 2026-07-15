const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    maintenanceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest', required: true, index: true },
    requestId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['request_submitted', 'request_updated', 'repair_completed', 'request_rejected', 'new_message', 'new_request', 'repair_updated', 'technician_repair_completed', 'work_assigned'],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    readAt: { type: Date, default: null, index: true }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
