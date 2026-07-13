const mongoose = require("mongoose");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Equipment = require("../models/Equipment");

const fallbackRequests = [
    {
        id: "MR-2026-001",
        requestId: "MR-2026-001",
        equipment: "Drill Machine #01",
        type: "Oil Change",
        dueDate: "2026-07-15",
        priority: "high",
        status: "in-progress",
        assignedTo: "Technician Account",
        requesterName: "User Account",
        requesterEmail: "user@minekeeper.com",
        description: "Replace oil and inspect drill head vibration.",
        notes: []
    },
    {
        id: "MR-2026-002",
        requestId: "MR-2026-002",
        equipment: "Excavator #05",
        type: "Routine Check",
        dueDate: "2026-07-18",
        priority: "medium",
        status: "pending",
        assignedTo: "Unassigned",
        requesterName: "User Account",
        requesterEmail: "user@minekeeper.com",
        description: "Routine hydraulic and bucket inspection.",
        notes: []
    }
];

const equipmentNameByValue = {
    1: "Drill Machine #01",
    2: "Excavator #05",
    3: "Crusher Unit #03",
    4: "Conveyor System #01",
    5: "Dump Truck #08"
};

const maintenanceTypeNameByValue = {
    routine: "Routine Maintenance",
    preventive: "Preventive Maintenance",
    corrective: "Corrective Maintenance",
    emergency: "Emergency Repair"
};

const isDbReady = () => mongoose.connection.readyState === 1;

const normalizeRequest = (request) => {
    const plain = request.toObject ? request.toObject() : request;
    return {
        ...plain,
        id: plain.requestId || plain.id,
        requestId: plain.requestId || plain.id,
        dueDate: plain.dueDate || plain.requestedDate || "",
        requestedDate: plain.dueDate || plain.requestedDate || ""
    };
};

const buildQuery = (query) => {
    const filters = {};
    if (query.requesterEmail) filters.requesterEmail = query.requesterEmail;
    if (query.assignedTo) filters.assignedTo = query.assignedTo;
    if (query.status) filters.status = query.status;
    return filters;
};

const getAllRequests = async (req, res) => {
    if (!isDbReady()) {
        const filters = buildQuery(req.query);
        const requests = fallbackRequests.filter(request =>
            Object.entries(filters).every(([key, value]) => request[key] === value)
        );
        return res.json({ success: true, requests });
    }

    const requests = await MaintenanceRequest.find(buildQuery(req.query)).sort({ createdAt: -1 });
    res.json({
        success: true,
        requests: requests.map(normalizeRequest)
    });
};

const createRequest = async (req, res) => {
    const requestData = req.body;

    const nextId = isDbReady()
        ? `MR-2026-${String((await MaintenanceRequest.countDocuments()) + 1).padStart(3, "0")}`
        : `MR-2026-${String(fallbackRequests.length + 1).padStart(3, "0")}`;

    let equipmentName = equipmentNameByValue[requestData.equipment] || requestData.equipment || "Unknown Equipment";
    if (isDbReady() && requestData.equipment && !equipmentNameByValue[requestData.equipment]) {
        const equipment = await Equipment.findOne({
            $or: [
                { assetId: requestData.equipment },
                { name: requestData.equipment }
            ]
        });
        if (equipment) equipmentName = equipment.name;
    }

    const createdRequest = {
        requestId: nextId,
        equipment: equipmentName,
        type: maintenanceTypeNameByValue[requestData.maintenanceType] || requestData.maintenanceType || "Maintenance",
        dueDate: requestData.requestedDate || requestData.dueDate || "",
        priority: requestData.priority || "low",
        status: "pending",
        assignedTo: requestData.assignedTo || "Unassigned",
        requesterName: requestData.requesterName || "User Account",
        requesterEmail: requestData.requesterEmail || "user@minekeeper.com",
        description: requestData.description || "",
        photoName: requestData.photoName || ""
    };

    if (!isDbReady()) {
        fallbackRequests.unshift({ ...createdRequest, id: createdRequest.requestId, notes: [] });
        return res.status(201).json({
            success: true,
            message: "Maintenance request created successfully",
            data: normalizeRequest(createdRequest)
        });
    }

    const savedRequest = await MaintenanceRequest.create(createdRequest);
    res.status(201).json({
        success: true,
        message: "Maintenance request created successfully",
        data: normalizeRequest(savedRequest)
    });
};

const getRequestById = async (req, res) => {
    const request = isDbReady()
        ? await MaintenanceRequest.findOne({ requestId: req.params.id })
        : fallbackRequests.find(item => item.requestId === req.params.id || item.id === req.params.id);

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Maintenance request not found"
        });
    }

    res.json({
        success: true,
        request: normalizeRequest(request)
    });
};

const updateRequest = async (req, res) => {
    const allowedStatuses = ["pending", "approved", "assigned", "inspection", "in-progress", "testing", "completed"];
    const { status, assignedTo, note, repairSummary, partsUsed } = req.body;

    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid request status"
        });
    }

    if (!isDbReady()) {
        const request = fallbackRequests.find(item => item.requestId === req.params.id || item.id === req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Maintenance request not found" });
        if (status) request.status = status;
        if (assignedTo) request.assignedTo = assignedTo;
        if (repairSummary !== undefined) request.repairSummary = repairSummary;
        if (partsUsed !== undefined) request.partsUsed = partsUsed;
        if (note) request.notes.unshift({ text: note, createdAt: new Date() });
        if (status === "completed") request.completedDate = new Date().toISOString().slice(0, 10);
        return res.json({ success: true, message: "Maintenance request updated successfully", data: normalizeRequest(request) });
    }

    const update = {};
    if (status) update.status = status;
    if (assignedTo) update.assignedTo = assignedTo;
    if (repairSummary !== undefined) update.repairSummary = repairSummary;
    if (partsUsed !== undefined) update.partsUsed = partsUsed;
    if (status === "completed") update.completedDate = new Date().toISOString().slice(0, 10);

    const request = await MaintenanceRequest.findOneAndUpdate(
        { requestId: req.params.id },
        {
            $set: update,
            ...(note ? { $push: { notes: { $each: [{ text: note }], $position: 0 } } } : {})
        },
        { new: true }
    );

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Maintenance request not found"
        });
    }

    res.json({
        success: true,
        message: "Maintenance request updated successfully",
        data: normalizeRequest(request)
    });
};

module.exports = {
    getAllRequests,
    createRequest,
    getRequestById,
    updateRequest
};
