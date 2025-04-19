const {VirtualCard, User, AuditLog} = require("../models/Users")

const {generateCardNumber,
    generateExpiryDate,
    generateCVV,
    encryptCVV
} = require("../utils/generateCard");

exports.issueVirtualCard = async(req,res) =>{
    try{
        const {cardType} = req.body;
        const userId = req.user.id;

        if(!["Visa", "MasterCard"].includes(cardType)){
            return res.status(400).json({message: "Invalid card type"})
        }

        const user = await User.findById(userId);
        if(!user) return res.status(404).json({message: "User not found"})

            const cardNumber = generateCardNumber();
            const expiryDate = generateExpiryDate();
            const cvv = generateCVV();
            const encryptedCVV = await encryptCVV(cvv);

            const newCard = new VirtualCard({
                userId,
                cardType,
                cardNumber,
                cardHolder: user.fullName,
                cvv: encryptedCVV,
                expiryDate,
                network: cardType,
                status: "active"
              });

            await newCard.save();

            return res.status(201).json({
                message: "Virtual card issued successfully",
                cardDetails: {
                    cardId: newCard._id,
                    cardNumber: newCard.cardNumber,
                    cardHolder: newCard.cardHolder,
                    expiryDate: newCard.expiryDate,
                    network: newCard.network
                }
            })
    }catch(error){
        console.error("Error issuing virtual card:", error);
        return res.status(500).json({message: "Internal server error"})
    }
}


exports.blockVirtualCard = async (req, res) => {
    try {
      const cardId = req.params.id;
      const userId = req.user.id;
  
      // Find card and verify ownership
      const card = await VirtualCard.findOne({ _id: cardId, userId });
  
      if (!card) {
        return res.status(404).json({ message: "Card not found or unauthorized" });
      }
  
      if (card.status === "blocked") {
        return res.status(400).json({ message: "Card is already blocked" });
      }
  
      // Block the card
      card.status = "blocked";
      await card.save();
  
      // Log action to AuditLog
      const auditLog = new AuditLog({
        performed_by: userId,
        action: "Blocked virtual card",
        entity_type: "User",
        entity_id: userId,
        details: `Card ID ${card._id} was blocked by user.`,
      });
      await auditLog.save();
  
      res.status(200).json({ message: "Card blocked" });
    } catch (error) {
      console.error("Error blocking card:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };


  exports.unblockVirtualCard = async (req, res) => {
    try {
      const cardId = req.params.id;
      const userId = req.user.id;
  
      const card = await VirtualCard.findOne({ _id: cardId, userId });
  
      if (!card) {
        return res.status(404).json({ message: "Card not found or unauthorized" });
      }
  
      if (card.status === "active") {
        return res.status(400).json({ message: "Card is already active" });
      }
  
      // Update status to active
      card.status = "active";
      await card.save();
  
      // Log audit
      const auditLog = new AuditLog({
        performed_by: userId,
        action: "Unblocked virtual card",
        entity_type: "User", // or "VirtualCard" if you want to track it that way
        entity_id: userId,
        details: `Card ID ${card._id} was unblocked by user.`,
      });
      await auditLog.save();
  
      res.status(200).json({ message: "Card unblocked" });
    } catch (error) {
      console.error("Error unblocking card:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  

  exports.getUserVirtualCards = async (req, res) => {
    try {
      const userId = req.user.id;
  
      const cards = await VirtualCard.find({ userId }).select('_id cardNumber creditLimit balance status cardType');

      if(!cards || cards.length === 0){
        return res.status(404).json({ message: "No virtual or credit cards found for this user" });
      }

       // Mask card number and add card category
    const formattedCards = cards.map(card => ({
      _id: card._id,
      cardNumber: `****${card.cardNumber.slice(-4)}`,
      creditLimit: card.creditLimit,
      balance: card.balance,
      status: card.status,
      cardType: card.cardType,  // Visa / MasterCard
      cardCategory: card.creditLimit > 0 ? 'Credit Card' : 'Virtual Card'  // Dynamically set
    }));
  
      res.status(200).json({ cards });
    } catch (error) {
      console.error("Error fetching virtual cards:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };


  exports.getVirtualCardById = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
  
      const card = await VirtualCard.findOne({ _id: id, userId }).select(
        "cardNumber cardType status expiryDate cardHolder createdAt"
      );
  
      if (!card) {
        return res.status(404).json({ message: "Card not found or unauthorized" });
      }
  
      res.status(200).json({ card });
    } catch (error) {
      console.error("Error fetching virtual card:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
