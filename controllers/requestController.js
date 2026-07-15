const mongoose = require('mongoose');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Equipment = require('../models/Equipment');
const User = require('../models/User');
const Notification = require('../models/Notification');

const equipmentNameByValue = {
    1: 'Drill Machine #01', 2: 'Excavator #05', 3: 'Crusher Unit #03',
    4: 'Conveyor System #01', 5: 'Dump Truck #08'
};

const maintenanceTypeNameByValue = {
    routine: 'Routine Maintenance', preventive: 'Preventive Maintenance',
    corrective: 'Corrective Maintenance', emergency: 'Emergency Repair'
};

const isDbReady = () => mongoose.connection.readyState === 1;

const normalizeRequest = request => {
    const plain = request.toObject ? request.toObject() : request;
    return {
        ...plain,
        id: plain.requestId || plain.id,
        requestId: plain.requestId || plain.id,
        dueDate: plain.dueDate || plain.requestedDate || '',
        requestedDate: plain.dueDate || plain.requestedDate || ''
    };
};

function requireDatabase(res) {
    if (isDbReady()) return true;
    res.status(503).json({ success: false, message: 'The request database is unavailable' });
    return false;
}

async function createRequestNotification(request, type, title, message) {
    try {
        let userId = request.requesterId;
        if (!userId && request.requesterEmail) {
            const requester = await User.findOne({ email: request.requesterEmail }).select('_id');
            userId = requester?._id;
        }
        if (!userId) return;
        await Notification.create({
            userId,
            maintenanceRequestId: request._id,
            requestId: request.requestId,
            type,
            title,
            message
        });
    } catch (error) {
        console.error('Could not create request notification:', error);
    }
}

async function createAdminNotifications(request, type, title, message) {
    try {
        const admins = await User.find({ role: 'admin', status: { $ne: 'Inactive' } }).select('_id');
        if (!admins.length) return;
        await Notification.insertMany(admins.map(admin => ({
            userId: admin._id,
            maintenanceRequestId: request._id,
            requestId: request.requestId,
            type,
            title,
            message
        })));
    } catch (error) {
        console.error('Could not create admin notifications:', error);
    }
}

function ownershipFilter(user) {
    if (user.role === 'admin') return {};
    if (user.role === 'technician') {
        const identities = [user.id, user.email, user.username, user.name].filter(Boolean);
        return {
            $or: [
                ...(mongoose.isValidObjectId(user.id) ? [{ assignedTechnicianId: user.id }] : []),
                { assignedTo: { $in: identities } }
            ]
        };
    }

    return {
        $or: [
            ...(mongoose.isValidObjectId(user.id) ? [{ requesterId: user.id }] : []),
            { requesterEmail: user.email }
        ]
    };
}

function combineFilters(...filters) {
    const active = filters.filter(filter => filter && Object.keys(filter).length);
    if (!active.length) return {};
    return active.length === 1 ? active[0] : { $and: active };
}

const getAllRequests = async (req, res) => {
    if (!requireDatabase(res)) return;
    const optionalFilters = {};
    if (req.query.status) optionalFilters.status = req.query.status;
    if (req.user.role === 'admin') {
        if (req.query.requesterEmail) optionalFilters.requesterEmail = req.query.requesterEmail;
        if (req.query.assignedTo) optionalFilters.assignedTo = req.query.assignedTo;
    }

    const requests = await MaintenanceRequest.find(
        combineFilters(ownershipFilter(req.user), optionalFilters)
    ).sort({ createdAt: -1 });
    res.json({ success: true, requests: requests.map(normalizeRequest) });
};

const createRequest = async (req, res) => {
    if (!requireDatabase(res)) return;
    const requestData = req.body;
    const nextId = `MR-2026-${String((await MaintenanceRequest.countDocuments()) + 1).padStart(3, '0')}`;

    let equipmentName = equipmentNameByValue[requestData.equipment] || requestData.equipment || 'Unknown Equipment';
    if (requestData.equipment && !equipmentNameByValue[requestData.equipment]) {
        const equipment = await Equipment.findOne({
            $or: [{ assetId: requestData.equipment }, { name: requestData.equipment }]
        });
        if (equipment) equipmentName = equipment.name;
    }

    const savedRequest = await MaintenanceRequest.create({
        requestId: nextId,
        equipment: equipmentName,
        type: maintenanceTypeNameByValue[requestData.maintenanceType] || requestData.maintenanceType || 'Maintenance',
        dueDate: requestData.requestedDate || requestData.dueDate || '',
        priority: requestData.priority || 'low',
        status: 'pending',
        assignedTo: 'Unassigned',
        requesterId: mongoose.isValidObjectId(req.user.id) ? req.user.id : undefined,
        requesterName: req.user.name,
        requesterEmail: req.user.email,
        description: requestData.description || '',
        photoName: requestData.photoName || ''
    });
    await createRequestNotification(
        savedRequest,
        'request_submitted',
        'Request Submitted',
        `Your maintenance request ${savedRequest.requestId} for ${savedRequest.equipment} was received and is waiting for Admin review.`
    );
    await createAdminNotifications(
        savedRequest,
        'new_request',
        'New Maintenance Request',
        `${savedRequest.requesterName || 'A user'} submitted ${savedRequest.requestId} for ${savedRequest.equipment}.`
    );
    res.status(201).json({ success: true, message: 'Maintenance request created successfully', data: normalizeRequest(savedRequest) });
};

const getRequestById = async (req, res) => {
    if (!requireDatabase(res)) return;
    const request = await MaintenanceRequest.findOne(
        combineFilters({ requestId: req.params.id }, ownershipFilter(req.user))
    );
    if (!request) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    res.json({ success: true, request: normalizeRequest(request) });
};

const updateRequest = async (req, res) => {
    if (!requireDatabase(res)) return;
    const allowedStatuses = ['pending', 'approved', 'rejected', 'assigned', 'inspection', 'in-progress', 'testing', 'completed'];
    const { status, assignedTo, note, repairSummary, partsUsed, repairPhotoName, repairPhotoData, rejectionReason, notifyUser } = req.body;
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid request status' });
    }
    if (status === 'rejected' && req.user.role === 'admin' && !String(rejectionReason || '').trim()) {
        return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }

    const update = {};
    if (status) update.status = status;
    if (repairSummary !== undefined) update.repairSummary = repairSummary;
    if (partsUsed !== undefined) update.partsUsed = partsUsed;
    if (repairPhotoName !== undefined) update.repairPhotoName = repairPhotoName;
    if (repairPhotoData !== undefined) {
        if (String(repairPhotoData).length > 3_000_000) return res.status(400).json({ success: false, message: 'Repair photo is too large' });
        if (repairPhotoData && !String(repairPhotoData).startsWith('data:image/')) return res.status(400).json({ success: false, message: 'Repair photo must be an image' });
        update.repairPhotoData = repairPhotoData;
    }
    if (status === 'rejected') update.rejectionReason = String(rejectionReason).trim();
    if (status === 'completed') update.completedDate = new Date().toISOString().slice(0, 10);

    let assignedTechnician = null;
    if (req.user.role === 'admin' && assignedTo) {
        update.assignedTo = assignedTo;
        assignedTechnician = await User.findOne({
            role: 'technician',
            $or: [{ name: assignedTo }, { email: assignedTo }, { username: assignedTo }]
        });
        update.assignedTechnicianId = assignedTechnician?._id || null;
    }

    const existingRequest = await MaintenanceRequest.findOne(
        combineFilters({ requestId: req.params.id }, ownershipFilter(req.user))
    );
    if (!existingRequest) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    const previousStatus = existingRequest.status;
    const previousAssignee = existingRequest.assignedTo;

    const request = await MaintenanceRequest.findOneAndUpdate(
        combineFilters({ requestId: req.params.id }, ownershipFilter(req.user)),
        {
            $set: update,
            ...(note ? { $push: { notes: { $each: [{ text: note }], $position: 0 } } } : {})
        },
        { new: true }
    );
    if (!request) return res.status(404).json({ success: false, message: 'Maintenance request not found' });

    if (status && status !== previousStatus) {
        if (status === 'completed') {
            await createRequestNotification(request, 'repair_completed', 'Repair Completed', `Your equipment repair has been completed for ${request.requestId}.`);
        } else if (status === 'rejected') {
            await createRequestNotification(request, 'request_rejected', 'Request Rejected', `Your maintenance request was rejected. Reason: ${String(rejectionReason).trim()}`);
        } else {
            const statusTitle = status.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
            await createRequestNotification(request, 'request_updated', `Request ${statusTitle}`, `Your maintenance request ${request.requestId} is now ${statusTitle}.`);
        }
    }
    if (note && notifyUser) {
        const author = req.user.role === 'admin' ? 'Admin' : 'Technician';
        await createRequestNotification(request, 'new_message', 'New Message', `${author} added a new message to your request: ${note}`);
    }
    if (req.user.role === 'technician' && (status !== previousStatus || note || repairSummary !== undefined || partsUsed !== undefined)) {
        const completed = status === 'completed';
        await createAdminNotifications(
            request,
            completed ? 'technician_repair_completed' : 'repair_updated',
            completed ? 'Repair Completed' : 'Repair Updated',
            `${req.user.name || 'A technician'} ${completed ? 'completed' : 'updated'} ${request.requestId} for ${request.equipment}.`
        );
        if (!status || status === previousStatus) {
            await createRequestNotification(request, 'request_updated', 'Repair Updated', `The Technician updated repair work for ${request.requestId}.`);
        }
    }
    if (req.user.role === 'admin' && assignedTechnician && assignedTo !== previousAssignee) {
        await Notification.create({
            userId: assignedTechnician._id,
            maintenanceRequestId: request._id,
            requestId: request.requestId,
            type: 'work_assigned',
            title: 'New Maintenance Assignment',
            message: `Admin assigned ${request.requestId} for ${request.equipment} to you.`
        });
    }
    res.json({ success: true, message: 'Maintenance request updated successfully', data: normalizeRequest(request) });
};

module.exports = { getAllRequests, createRequest, getRequestById, updateRequest };
