const express = require("express")
const {sendUpdatesToUsers} = require("../controllers/adminController")
const router = express.Router()

router.post("/send-updates", sendUpdatesToUsers)

module.exports = router