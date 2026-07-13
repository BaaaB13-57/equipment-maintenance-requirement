const express = require("express");
const router = express.Router();
const {
    getAllUsers,
    registerUser,
    loginUser,
    updateUser
} = require("../controllers/userController");

router.get("/", getAllUsers);

// Login API
router.post("/login", loginUser);

// Register user
router.post("/register", registerUser);

router.patch("/:id", updateUser);

module.exports = router;
