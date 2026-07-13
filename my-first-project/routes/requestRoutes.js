const express = require("express");
const router = express.Router();
const {
    getAllRequests,
    getRequestById,
    createRequest,
    updateRequest
} = require("../controllers/requestController");

// GET all requests
router.get("/", getAllRequests);

// Create request API
router.post("/", createRequest);

// View single request
router.get("/:id", getRequestById);

// Update request status or technician
router.patch("/:id", updateRequest);

module.exports = router;
