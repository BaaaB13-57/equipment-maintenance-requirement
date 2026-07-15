const express = require("express");
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const {
    getEquipmentPage,
    addEquipment,
    updateEquipment,
    deleteEquipment
} = require("../controllers/equipmentController");

router.get("/", getEquipmentPage);
router.post("/", requireRole('admin'), addEquipment);
router.patch("/:id", requireRole('admin'), updateEquipment);
router.delete("/:id", requireRole('admin'), deleteEquipment);

module.exports = router;
