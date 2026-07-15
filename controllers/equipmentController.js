const mongoose = require("mongoose");
const Equipment = require("../models/Equipment");

const fallbackEquipment = [
    { id: "DM-2024-001", assetId: "DM-2024-001", name: "Drill Machine #01", type: "Drilling", location: "Zone A - Pit 1", status: "operational", lastServiced: "2026-06-15", nextService: "2026-07-15", assignedTo: "Technician Account", notes: "Oil change due this week" },
    { id: "EX-2024-005", assetId: "EX-2024-005", name: "Excavator #05", type: "Earth Moving", location: "Zone B - Pit 2", status: "operational", lastServiced: "2026-06-20", nextService: "2026-07-18", assignedTo: "Technician Account", notes: "Routine check scheduled" },
    { id: "CU-2024-003", assetId: "CU-2024-003", name: "Crusher Unit #03", type: "Processing", location: "Processing Plant A", status: "maintenance", lastServiced: "2026-05-10", nextService: "2026-07-20", assignedTo: "Technician Account", notes: "Belt inspection in progress" }
];

const isDbReady = () => mongoose.connection.readyState === 1;

const normalizeEquipment = (equipment) => {
    const plain = equipment.toObject ? equipment.toObject() : equipment;
    return { ...plain, id: plain.assetId || plain.id };
};

const getEquipmentPage = async (req, res) => {
    if (!isDbReady()) {
        return res.json({ success: true, equipment: fallbackEquipment });
    }

    const equipment = await Equipment.find().sort({ createdAt: -1 });
    res.json({
        success: true,
        equipment: equipment.map(normalizeEquipment)
    });
};

const addEquipment = async (req, res) => {
    const equipmentData = req.body;

    if (!equipmentData.name || !equipmentData.type || !equipmentData.location) {
        return res.status(400).json({
            success: false,
            message: "Equipment name, type, and location are required"
        });
    }

    const createdEquipment = {
        assetId: equipmentData.id || equipmentData.assetId || `EQ-2026-${String(fallbackEquipment.length + 1).padStart(3, "0")}`,
        name: equipmentData.name,
        type: equipmentData.type,
        location: equipmentData.location,
        status: equipmentData.status || "operational",
        lastServiced: equipmentData.lastServiced || "",
        nextService: equipmentData.nextService || "",
        assignedTo: equipmentData.assignedTo || "Unassigned",
        notes: equipmentData.notes || "New equipment added"
    };

    if (!isDbReady()) {
        fallbackEquipment.unshift({ ...createdEquipment, id: createdEquipment.assetId });
        return res.status(201).json({ success: true, message: "Equipment added successfully", data: normalizeEquipment(createdEquipment) });
    }

    const savedEquipment = await Equipment.create(createdEquipment);
    res.status(201).json({
        success: true,
        message: "Equipment added successfully",
        data: normalizeEquipment(savedEquipment)
    });
};

const updateEquipment = async (req, res) => {
    if (!isDbReady()) {
        const item = fallbackEquipment.find(equipment => equipment.assetId === req.params.id || equipment.id === req.params.id);
        if (!item) return res.status(404).json({ success: false, message: "Equipment not found" });
        Object.assign(item, req.body);
        return res.json({ success: true, message: "Equipment updated successfully", data: normalizeEquipment(item) });
    }

    const equipment = await Equipment.findOneAndUpdate(
        { assetId: req.params.id },
        { $set: req.body },
        { new: true }
    );

    if (!equipment) return res.status(404).json({ success: false, message: "Equipment not found" });
    res.json({ success: true, message: "Equipment updated successfully", data: normalizeEquipment(equipment) });
};

const deleteEquipment = async (req, res) => {
    if (!isDbReady()) {
        return res.status(503).json({ success: false, message: "The equipment database is unavailable" });
    }
    const equipment = await Equipment.findOneAndDelete({ assetId: req.params.id });
    if (!equipment) return res.status(404).json({ success: false, message: "Equipment not found" });
    res.json({ success: true, message: "Equipment deleted successfully" });
};

module.exports = {
    getEquipmentPage,
    addEquipment,
    updateEquipment,
    deleteEquipment
};
