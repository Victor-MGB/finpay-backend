const {LoanApplication, Wallet, Transaction,  Loan, User, AuditLog, Notification, TransactionFee} = require('../models/Users');
// const mongoose = require('mongoose');
const {v4: uuidv4} = require("uuid");

exports.applyForLoan = async (req, res) => {
    try{
        const {loanType, amount, term} = req.body;
        const validLoanTypes = ['personal', 'business', 'auto', 'home'];

        //Validate user
        if(!req.user || !req.user.id){
            return res.status(401).json({message: 'Unauthorized: User ID not found'});
        }

        //validate input
        if(!validLoanTypes.includes(loanType)){
            return res.status(400).json({message: 'Invalid loan type'});
        }
        if(amount <= 0 || term <= 0){
            return res.status(400).json({message: 'Amount and term must be greater than zero'});
        }

        //Create Loan Application
        const newApplication = await LoanApplication.create({
            userId: req.user.id,
            loanType,
            amount,
            term,
            status: 'pending',
        });

        //Log in AuditLog
        await AuditLog.create({
            performed_by: req.user.id,
            action: `Applied for ${loanType} loan`,
            entity_type: "User",
            entity_id: req.user.id,
            details: `Loan application created with ID: ${newApplication._id} for ${amount} over ${term} months`,
        });

        // Notify Compliance Role (Assuming role = 'compliance' or similar setup)
    const complianceUsers = await User.find({ role: "compliance" });
    const notifications = complianceUsers.map(user => ({
      userId: user._id,
      message: `New loan application pending review from user ${req.user.id}.`,
    }));
    await Notification.insertMany(notifications);

    return res.status(201).json({
        message: 'Loan application submitted successfully',
        applicationId: newApplication._id,
    });

    } catch(error){
        console.error('Error applying for loan:', error);
        res.status(500).json({message: 'Internal server error'});
    }
}

exports.payLoanInstallment = async (req, res) => {
    const userId = req.user._id;
    const loanId = req.params.id;
    const { amount, walletId, paymentMethodId } = req.body;
  
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount is required and must be greater than 0" });
    }
  
    try {
      const loan = await Loan.findOne({ _id: loanId, userId });
      if (!loan) return res.status(403).json({ message: "Loan not found or access denied" });
  
      const nextRepayment = loan.repaymentSchedule.find(s => s.status === "unpaid");
      if (!nextRepayment) return res.status(400).json({ message: "All repayments are already completed" });
  
      if (amount < nextRepayment.amountDue) {
        return res.status(400).json({ message: "Insufficient amount to cover EMI" });
      }
  
      let method = walletId ? "wallet" : "paymentMethod";
      let sourceId = walletId || paymentMethodId;
      let currency = loan.currency || "NGN";
  
      if (walletId) {
        const wallet = await Wallet.findOne({ _id: walletId, userId });
        if (!wallet || parseFloat(wallet.balance.toString()) < amount) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        wallet.balance = parseFloat(wallet.balance.toString()) - amount;
        wallet.updatedAt = new Date();
        await wallet.save();
      }
  
      const feeAmount = parseFloat((amount * 0.01).toFixed(2));
      const reference = uuidv4();
  
      const transaction = await Transaction.create({
        senderId: userId,
        receiverId: null,
        amount,
        currency,
        status: "completed",
        type: "payment",
        paymentMethodId: paymentMethodId || null,
        reference,
        description: `EMI Payment for Loan ${loan._id}`,
        createdAt: new Date(),
        completedAt: new Date(),
        metadata: { loanId }
      });
  
      const transactionFee = await TransactionFee.create({
        transactionId: transaction._id,
        amount: feeAmount,
        currency,
        type: "processing",
        createdAt: new Date()
      });
  
      nextRepayment.status = "paid";
      nextRepayment.transactionId = transaction._id;
      await loan.save();
  
      const allPaid = loan.repaymentSchedule.every(s => s.status === "paid");
      if (allPaid) {
        loan.status = "closed";
        await loan.save();
      }
  
      await Notification.create({
        userId,
        message: `Your loan EMI payment of ₦${amount} was successful.`,
        createdAt: new Date()
      });
  
      res.status(201).json({ transactionId: transaction._id });
  
    } catch (err) {
      console.error("Error processing loan payment:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  

exports.approveLoanApplication = async (req, res) =>{
    try{
        const applicationId = req.params.id;
        const interestRate = 10; // Example interest rate

        //ensure admin
        if(!req.user || req.user.role !== 'admin'){
            return res.status(403).json({message: 'Forbidden: Only admins can approve loans'});
        }

        //find loan application
        const application = await LoanApplication.findById(applicationId);
        if(!application){
            return res.status(404).json({message: 'Loan application not found'});
        }

        if(application.status !== 'pending'){
            return res.status(400).json({message: 'Loan application is not pending'});
        }

        //Update application status
        application.status = 'approved';
        application.approvedAt = new Date();
        await application.save();
        

        const principal = application.amount;
        const term = application.term;
        const monthlyInterestRate = interestRate / 12 / 100;

        //calculate EMI (equal monthly installment)
        const emi = (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, term)) / (Math.pow(1 + monthlyInterestRate, term) - 1);

        const repaymentSchedule = [];
        const today = new Date();

        for(let i = 1; i <= term; i++){
            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + i);
            repaymentSchedule.push({
                dueDate,
                amountDue: parseFloat(emi.toFixed(2)),
                status: "unpaid"
            })
        }

        //create loan
        const loan = await Loan.create({
            userId: application.userId,
            applicationId: application._id,
            amount: application.amount,
            term: application.term,
            principal,
            interestRate,
            repaymentSchedule,
            status: "active",
        });

        //Notify user
        await Notification.create({
            userId: application.userId,
            message: `🎉 Your ${application.loanType} loan of $${principal} has been approved.`,
        });

        //Log action
        await AuditLog.create({
            performed_by: req.user.id,
            action: `Approved loan application`,
            entity_type: "LoanApplication",
            entity_id: application._id,
            details: `Approved ${application.loanType} loan of $${principal} for user ${application.userId}`,
        });

        return res.status(200).json({
            message: 'Loan application approved successfully',
            loanId: loan._id,
            repaymentSchedule,
        })

    }catch(error){
        console.error('Error approving loan application:', error);
        res.status(500).json({message: 'Internal server error'});
    }
}

//reject loan
exports.rejectLoanApplication = async (req, res) => {
    try {
      const applicationId = req.params.id;
  
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin only" });
      }
  
      const application = await LoanApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Loan application not found" });
      }
  
      if (application.status !== "pending") {
        return res.status(400).json({ message: "Loan application already processed" });
      }
  
      application.status = "rejected";
      await application.save();
  
      await Notification.create({
        userId: application.userId,
        message: `🚫 Your ${application.loanType} loan application was rejected.`,
      });
  
      await AuditLog.create({
        performed_by: req.user._id,
        action: "Loan rejected",
        entity_type: "LoanApplication",
        entity_id: application._id,
        details: `Rejected ${application.loanType} loan for user ${application.userId}`,
      });
  
      return res.status(200).json({ message: "Loan application rejected" });
  
    } catch (error) {
      console.error("Error rejecting loan:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  

exports.closeLoanEarly = async (req, res) => {
    try{
        const loanId = req.params.id;

        if(!req.user || !req.user.role !== "admin"){
            return res.status(403).json({ message: "Forbidden: Admin only" });
        }

        const loan = await Loan.findById(loanId);
        if(!loan || loan.status !== "active"){
            return res.status(404).json({ message: "Active loan not found" });
        }

        loan.status = "closed";

        loan.repaymentSchedule.forEach(schedule => {
            if (schedule.status === "unpaid") {
              schedule.status = "paid"; // Force-close all
            }
          });

          await loan.save();

          await Notification.create({
            userId: loan.userId,
            message: `✅ Your loan has been closed early. Thank you!`,
          });

          await AuditLog.create({
            performed_by: req.user._id,
            action: "Loan closed early",
            entity_type: "Loan",
            entity_id: loan._id,
            details: `Loan manually closed by admin for user ${loan.userId}`,
          });

            return res.status(200).json({ message: "Loan closed successfully" });
    } catch(error){
        console.error("Error closing loan early:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

exports.getLoanStats = async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
  
      const totalLoans = await Loan.countDocuments();
      const activeLoans = await Loan.countDocuments({ status: "active" });
      const totalDisbursed = await Loan.aggregate([
        { $group: { _id: null, total: { $sum: "$principal" } } }
      ]);
  
      return res.status(200).json({
        totalLoans,
        activeLoans,
        totalDisbursed: totalDisbursed[0]?.total || 0,
      });
  
    } catch (error) {
      console.error("Loan stats error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };


exports.getLoanApplications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    // Build query
    const query = { userId };
    if (status) {
      const validStatuses = ["pending", "approved", "rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      query.status = status;
    }

    const applications = await LoanApplication.find(query).select(
      "_id loanType amount term status"
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({ message: "No applications found" });
    }

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserLoans = async (req, res) => {
  try {
    const userId = req.user._id;

    const loans = await Loan.find({ userId })
      .populate("applicationId", "loanType amount term status") // populate minimal application info
      .populate("repaymentSchedule.transactionId", "amount status createdAt") // populate related transaction info
      .select("_id principal interestRate repaymentSchedule status");

    if (!loans || loans.length === 0) {
      return res.status(404).json({ message: "No loans found" });
    }

    // Optional: Clean up repaymentSchedule before sending
    const simplifiedLoans = loans.map(loan => ({
      _id: loan._id,
      principal: loan.principal,
      interestRate: loan.interestRate,
      status: loan.status,
      repaymentSchedule: loan.repaymentSchedule.map(s => ({
        dueDate: s.dueDate,
        amountDue: s.amountDue,
        status: s.status
      }))
    }));

    return res.status(200).json({ loans: simplifiedLoans });

  } catch (err) {
    console.error("Error fetching user loans:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
