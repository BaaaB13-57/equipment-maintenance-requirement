const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    location: { type: String, required: true },
    status: { type: String, default: "operational" },
    lastServiced: { type: String, default: "" },
    nextService: { type: String, default: "" },
    assignedTo: { type: String, default: "Unassigned" },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Equipment", equipmentSchema);
