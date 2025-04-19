const express = require("express");
const {
  registerMerchant,
  getMyMerchantDetails,
  rotateApiKey
} = require("../controllers/merchantController");
const { authMiddleware } = require("../middlewares/authMiddleware");
// const {rateLimitMiddleware} = require("../middlewares/rateLimit");
// const { checkPlanExpiry } = require("../middlewares/checkPlanExpiry");
// const roleAuth = require("../middlewares/roleAuth");

const router = express.Router();

router.post("/merchants", authMiddleware, registerMerchant);

// return users merchant details
router.get("/merchants/me", authMiddleware, getMyMerchantDetails); // Uncomment when implemented

//regenrate or rotate apikey for a merchant
router.patch("/merchants/api-key/rotate", authMiddleware, rotateApiKey);

// router.use(rateLimitMiddleware, authMiddleware, checkPlanExpiry); // Apply rate limits to API endpoints

// app.post("/admin-only-endpoint", roleAuth(["admin"]), (req, res) => {
//     res.send("Only Admins can access this.");
//   });
module.exports = router;
