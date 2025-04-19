const {User, Notification, SupportTicket, AuditLog} = require("../models/User"); // Optional, in case you need to find support users

// Controller function to create support ticket
exports.createSupportTicket = async (req, res) => {
    try {
      const { subject, message } = req.body;
  
      if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required." });
      }
  
      // Find support staff
      const supportUsers = await User.find({ role: "support" });
  
      if (supportUsers.length === 0) {
        return res.status(500).json({ message: "No support staff available at the moment." });
      }
  
      // Select the first available support staff (you could randomize later if needed)
      const assignedSupport = supportUsers[0];
  
      // Create the support ticket and assign to support staff
      const ticket = await SupportTicket.create({
        userId: req.user.id,
        subject,
        message,
        status: "open",
        assignedTo: assignedSupport._id
      });
  
      // Notify the assigned support staff
      await Notification.create({
        userId: assignedSupport._id,
        message: `A new support ticket has been assigned to you: ${subject}`,
      });
  
      // Log the creation in AuditLog
      await AuditLog.create({
        performed_by: req.user.id,
        action: `Created a support ticket (${ticket._id}) and assigned to ${assignedSupport._id}`,
        entity_type: "User",
        entity_id: req.user.id,
        details: `Subject: ${subject}`,
      });
  
      return res.status(201).json({ ticketId: ticket._id });
    } catch (error) {
      console.error("Error creating support ticket:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  
  const getSupportTickets = async (req, res) => {
    try {
      const { status } = req.query;
  
      // Build the query
      const query = { userId: req.user.id };
      if (status) {
        query.status = status;
      }
  
      // Find tickets
      const tickets = await SupportTicket.find(query)
        .populate({
          path: "assignedTo",
          select: "fullName", // Only get fullName of the assigned support
        })
        .select("_id subject status assignedTo"); // Only return needed fields
  
      if (!tickets || tickets.length === 0) {
        return res.status(404).json({ message: "No support tickets found." });
      }
  
      return res.status(200).json({ tickets });
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };


  exports.updateSupportTicket = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, assignedTo } = req.body;
  
      // Only support or admin can update tickets
      if (!["support", "admin"].includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }
  
      // Find the ticket
      const ticket = await SupportTicket.findById(id);
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found." });
      }
  
      // Update status if provided
      if (status) {
        if (!["open", "in_progress", "resolved"].includes(status)) {
          return res.status(400).json({ message: "Invalid status value." });
        }
        ticket.status = status;
  
        // If resolved, set resolvedAt timestamp
        if (status === "resolved") {
          ticket.resolvedAt = new Date();
        }
      }
  
      // Update assignedTo if provided
      if (assignedTo) {
        ticket.assignedTo = assignedTo;
      }
  
      // Save changes
      await ticket.save();
  
      // Notify the user who created the ticket
      await Notification.create({
        userId: ticket.userId,
        message: `Your support ticket "${ticket.subject}" has been updated to "${ticket.status}".`,
      });
  
      // Log in AuditLog
      await AuditLog.create({
        performed_by: req.user.id,
        action: `Updated support ticket (${ticket._id})`,
        entity_type: "User",
        entity_id: ticket.userId,
        details: `Status: ${ticket.status}${assignedTo ? `, Assigned To: ${assignedTo}` : ""}`,
      });
  
      return res.status(200).json({ message: "Ticket updated" });
  
    } catch (error) {
      console.error("Error updating support ticket:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };