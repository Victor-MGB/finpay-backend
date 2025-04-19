const Joi = require("joi");

const merchantRegistrationSchema = Joi.object({
  businessName: Joi.string().trim().min(3).max(100).required(),
  merchantCategoryCode: Joi.string().trim().length(4).required(), // MCC is typically 4-digit code
});

module.exports = merchantRegistrationSchema;
