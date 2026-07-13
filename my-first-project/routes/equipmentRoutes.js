const express = require("express");
const router = express.Router();
const {
    getEquipmentPage,
    addEquipment,
    updateEquipment
} = require("../controllers/equipmentController");

router.get("/", getEquipmentPage);
router.post("/", addEquipment);
router.patch("/:id", updateEquipment);

module.exports = router;
