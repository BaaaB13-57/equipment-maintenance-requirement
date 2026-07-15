const mongoose = require("mongoose");

const maintenanceRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true },
    equipment: { type: String, required: true },
    type: { type: String, default: "Corrective Maintenance" },
    dueDate: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "low" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "assigned", "inspection", "in-progress", "testing", "completed"],
      default: "pending"
    },
    assignedTo: { type: String, default: "Unassigned" },
    requesterName: { type: String, default: "User Account" },
    requesterEmail: { type: String, default: "user@minekeeper.com" },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    assignedTechnicianId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    description: { type: String, default: "" },
    photoName: { type: String, default: "" },
    partsUsed: { type: String, default: "" },
    repairSummary: { type: String, default: "" },
    repairPhotoName: { type: String, default: "" },
    repairPhotoData: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    notes: [{ text: String, createdAt: { type: Date, default: Date.now } }],
    completedDate: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
