const {ChequeBookRequest, AuditLog,  Wallet} = require('../models/Users');
const sendEmail = require('../utils/sendEmail'); // Your existing sendEmail function

// Controller function to handle cheque book requests
exports.requestChequeBook = async (req, res) => {
  const { walletId, quantity } = req.body;
  const userId = req.user.id;

  try {
    // Validate input
    if (!walletId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid walletId or quantity.' });
    }

    // Find the wallet
    const wallet = await Wallet.findById(walletId);

    // Validate wallet existence and ownership
    if (!wallet || wallet.userId.toString() !== userId.toString()) {
      return res.status(400).json({ message: 'Invalid wallet or wallet does not belong to the user.' });
    }

    // Validate wallet account type (must be checking)
    if (wallet.accountType !== 'checking') {
      return res.status(403).json({ message: 'Cheque books can only be requested for checking accounts.' });
    }

    // Create a new ChequeBookRequest
    const chequeBookRequest = new ChequeBookRequest({
      userId,
      walletId,
      quantity,
      status: 'pending',
    });

    await chequeBookRequest.save();

    // Create an AuditLog entry
    await AuditLog.create({
      performed_by: userId,
      action: `Requested ${quantity} cheque(s) for wallet ${walletId}`,
      entity_type: 'Account',
      entity_id: walletId,
      details: `Cheque book request created with ID ${chequeBookRequest._id}`,
    });

    // 🔥 Find an Admin user and send notification email
    const admin = await User.findOne({ role: 'admin' }); // Adjust if your admin field is different

    if (admin && admin.email) {
      await sendEmail({
        to: admin.email,
        subject: 'New Cheque Book Request',
        text: `User ${userId} requested ${quantity} cheque(s) for wallet ${walletId}. Request ID: ${chequeBookRequest._id}`,
      });
    }

    // Success response
    return res.status(201).json({ requestId: chequeBookRequest._id });

  } catch (error) {
    console.error('Error requesting cheque book:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// Controller function to track all cheque book requests for a user
exports.getChequeBookRequests = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query; // Optional filter

  try {
    // Build query
    const query = { userId };

    if (status) {
      // Validate status input
      const allowedStatuses = ['pending', 'approved', 'delivered'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status filter.' });
      }
      query.status = status;
    }

    // Find the user's cheque book requests
    const requests = await ChequeBookRequest.find(query).select('_id walletId quantity status deliveredAt');

    if (!requests.length) {
      return res.status(404).json({ message: 'No cheque book requests found.' });
    }

    return res.status(200).json({ requests });

  } catch (error) {
    console.error('Error fetching cheque book requests:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
  

exports.updateChequeBookRequestStatus = async (req, res) => {
  const adminId = req.user.id; // Assuming `req.user` is populated after authentication
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Check if the user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admins only.' });
    }

    // Validate status
    const allowedStatuses = ['approved', 'delivered'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Allowed: approved, delivered.' });
    }

    // Find the cheque book request
    const chequeBookRequest = await ChequeBookRequest.findById(id);
    if (!chequeBookRequest) {
      return res.status(404).json({ message: 'Cheque book request not found.' });
    }

    // Update fields
    chequeBookRequest.status = status;
    if (status === 'delivered') {
      chequeBookRequest.deliveredAt = new Date();
    }
    await chequeBookRequest.save();

    // Notify user (simple email)
    const user = await User.findById(chequeBookRequest.userId);
    if (user && user.email) {
      await sendEmail({
        to: user.email,
        subject: `Cheque Book Request ${status}`,
        text: `Hello ${user.firstName || 'User'}, your cheque book request has been ${status}.`
      });
    }

    // Log action in AuditLog
    await AuditLog.create({
      performed_by: adminId,
      action: `Cheque book request ${status}`,
      entity_type: 'User',
      entity_id: chequeBookRequest.userId,
      details: `Cheque book request ID ${chequeBookRequest._id} updated to ${status}`,
    });

    return res.status(200).json({ message: 'Request updated successfully.' });

  } catch (error) {
    console.error('Error updating cheque book request:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
