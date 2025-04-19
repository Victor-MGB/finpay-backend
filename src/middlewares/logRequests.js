const {ApiLog} = require("../models/Users");

const logRequestMiddleware = async (req, res, next) => {
    if (!req.user || !req.user.merchant) return next();
  
    await ApiLog.create({
      userId: req.user.id,
      merchantId: req.user.merchant._id,
      endpoint: req.originalUrl,
      method: req.method,
    });
  
    next();
  };
  
  module.exports = logRequestMiddleware;