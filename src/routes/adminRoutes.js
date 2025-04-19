const express = require("express")
const {sendUpdatesToUsers, listUsers, updateKycStatus, updateUserRole} = require("../controllers/adminController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // assumes you have authentication middleware
const router = express.Router()

router.post("/send-updates", sendUpdatesToUsers)

router.get("/admin/users", authMiddleware, listUsers);

router.patch("/admin/users/:id/kyc", authMiddleware, updateKycStatus);

router.patch("/admin/users/:id/role", authMiddleware, updateUserRole);

module.exports = router