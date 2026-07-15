const express = require("express");
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const {
    getAllRequests,
    getRequestById,
    createRequest,
    updateRequest
} = require("../controllers/requestController");

// GET all requests
router.get("/", getAllRequests);

// Create request API
router.post("/", requireRole('user'), createRequest);

// View single request
router.get("/:id", getRequestById);

// Update request status or technician
router.patch("/:id", requireRole('admin', 'technician'), updateRequest);

module.exports = router;
