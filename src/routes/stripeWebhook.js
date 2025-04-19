const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const {Transaction, Merchant, AuditLog} = require("../models/Users");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post(
  "/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // Set this in your env
      );
    } catch (err) {
      console.error("❌ Stripe Webhook Error:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    if (event.type === "refund.updated" || event.type === "refund.succeeded") {
      const refund = event.data.object;
      const stripePaymentIntentId = refund.payment_intent;

      try {
        const transaction = await Transaction.findOne({
          stripePaymentIntentId,
        });

        if (!transaction) {
          console.warn("⚠️ Transaction not found for refund:", stripePaymentIntentId);
          return res.status(404).json({ message: "Transaction not found." });
        }

        // Update transaction status
        transaction.status = "refunded";
        await transaction.save();

        // Log refund update
        await AuditLog.create({
          performed_by: "System",
          action: `Stripe refund ${refund.status}`,
          entity_type: "Transaction",
          entity_id: transaction._id,
          details: `Refund ${refund.status} for transaction ${transaction._id}`,
        });

        console.log(`✅ Refund ${refund.status} updated for transaction ${transaction._id}`);

        return res.status(200).json({ message: "Refund status updated successfully." });
      } catch (err) {
        console.error("❌ Error updating refund status:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
    }

    return res.status(200).json({ received: true });
  }
);


router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
  
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  
      if (event.type === "invoice.payment_succeeded") {
        const subscriptionId = event.data.object.subscription;
        await Merchant.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionId },
          { subscriptionStatus: "active" }
        );
      }
  
      if (event.type === "customer.subscription.deleted") {
        const subscriptionId = event.data.object.id;
        await Merchant.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionId },
          { subscriptionStatus: "canceled" }
        );
      }
  
      res.sendStatus(200);
    } catch (err) {
      console.error("Webhook Error:", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

module.exports = router;
