const express = require("express");
const router = express.Router();
const {
    getAllUsers,
    registerUser,
    loginUser,
    updateUser,
    deleteUser,
    logoutUser,
    getCurrentSession
} = require("../controllers/userController");
const { requireAuth, requireRole } = require('../middleware/auth');

router.get("/", requireRole('admin'), getAllUsers);

// Login API
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/session", requireAuth, getCurrentSession);

// Only an authenticated administrator can create accounts.
router.post("/", requireRole('admin'), registerUser);

router.patch("/:id", requireRole('admin'), updateUser);
router.delete("/:id", requireRole('admin'), deleteUser);

module.exports = router;
