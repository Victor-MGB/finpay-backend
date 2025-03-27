const {User, Notification} = require("../models/Users");
const cloudinary = require("../config/cloudinary"); // Import cloudinary config
const sendEmail = require("../utils/sendEmail"); // Import sendEmail utility
const { Parser } = require("json2csv"); // CSV export
const PDFDocument = require("pdfkit"); // PDF export
const fs = require("fs"); // File system for PDFs
const path = require("path"); // File paths

// Upload KYC Document
exports.uploadKycDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType } = req.body;

    if (!documentType || !req.file) {
      return res
        .status(400)
        .json({ message: "Document type and file are required" });
    }

    // Upload file to Cloudinary
    cloudinary.uploader
      .upload_stream(
        { resource_type: "auto", folder: "kyc_documents" },
        async (error, uploadedFile) => {
          if (error) {
            return res
              .status(500)
              .json({ message: "Cloudinary upload failed", error });
          }

          // Update User's KYC documents
          const user = await User.findByIdAndUpdate(
            userId,
            {
              $push: {
                kycDocuments: {
                  documentType,
                  fileUrl: uploadedFile.secure_url,
                  status: "pending",
                  uploadedAt: new Date(),
                },
              },
            },
            { new: true }
          );

          // Notify compliance team via Database & Email
          const complianceUsers = await User.find({ role: "compliance" });

          if (complianceUsers.length > 0) {
            const notifications = complianceUsers.map((complianceUser) => ({
              userId: complianceUser._id,
              message: `New KYC document uploaded by ${user.name || "a user"}`,
              timestamp: new Date(),
            }));

            await Notification.insertMany(notifications);

            // Send Email Notifications
            const complianceEmails = complianceUsers.map((c) => c.email);
            sendEmail({
              to: complianceEmails,
              subject: "New KYC Document Uploaded",
              text: `A new KYC document has been uploaded by ${user.name}. Please review it.`,
            });
          }

          return res.status(201).json({
            message: "Document uploaded successfully",
            documentId: uploadedFile.public_id,
          });
        }
      )
      .end(req.file.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//  * Approve or Reject KYC Document
exports.reviewedKycDocument = async (req, res) => {
    try{
        const {userId, documentId, action, reason} = req.body;
        const adminId = req.user.id;
        const adminRole = req.user.role;

        // Only complain or admin can approve/rejects
        if(!["compliance","admin"].includes(adminRole)){
            return res.status(403).json({message:"Unauthorized: Insufficient permissions" });
        }

        //find User
        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({message:"User not found"});
        }

        // 🔎 Find KYC Document
    const document = user.kycDocuments.find(doc => doc._id.toString() === documentId);
    if (!document) {
      return res.status(404).json({ message: "KYC document not found" });
    }

    if(!["approved","rejected"].includes(action)){
        return res.status(400).json({ message: "Invalid action. Use 'approved' or 'rejected'" });
    }

    if(document.status === action){
        return res.status(400).json({ message: `Document already ${action}` });
    }

    //update document status
    document.status = action;
    document.reviewedBy = adminId;
    document.reviewedAt = new Date();
    document.reason = action === "rejected" ? reason || "No reason provided" : null;

    //update user's kyc documents
    await user.save();

    // 🔥 Save to Audit Log
    await AuditLog.create({
        performed_by: adminId,
        action: `KYC document ${action}`,
        entity_type: "KYC",
        entity_id: documentId,
        details: `KYC document ${action} by ${adminRole} (${adminId})`,
      });

      //Notify User via database & Email
      const notificationMessage = action === "approved"
        ? "Your KYC document has been approved"
        : `Your KYC document has been rejected. Reason: ${reason}`;


        await Notification.create({
            to: userId,
            message: notificationMessage,
            timestamp: new Date(),
        });

        // Send Email Notification
        sendEmail({
            to: user.email,
            subject: `KYC Document ${action}`,
            text: notificationMessage,
        });

        return res.status(200).json({message:`KYC document ${action} successfully`});
    }
    catch(error){
        console.error(error);
        res.status(500).json({message:"Server error", error:error.message});
    }
}

exports.getAllKycDocuments = async (req, res) => {
    try {
      if (!["admin", "compliance"].includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
  
      const { status, page = 1, limit = 10, sort = "desc", exportType } = req.query;
  
      const query = {};
      if (status) {
        query["kycDocuments.status"] = status;
      }
  
      const users = await User.find(query)
        .select("name email kycDocuments")
        .sort({ "kycDocuments.uploadedAt": sort === "asc" ? 1 : -1 }) // Sorting by date
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      // Check if export is requested
      if (exportType) {
        if (exportType === "csv") {
          const fields = ["name", "email", "kycDocuments.documentType", "kycDocuments.status", "kycDocuments.uploadedAt"];
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(users);
          res.header("Content-Type", "text/csv");
          res.attachment("kyc_documents.csv");
          return res.send(csv);
        } else if (exportType === "pdf") {
          const doc = new PDFDocument();
          const filePath = path.join(__dirname, "../exports/kyc_documents.pdf");
          doc.pipe(fs.createWriteStream(filePath));
  
          doc.fontSize(16).text("KYC Documents Report", { align: "center" });
          users.forEach((user, index) => {
            doc
              .fontSize(12)
              .text(`${index + 1}. ${user.name} (${user.email}) - ${user.kycDocuments.map(doc => `${doc.documentType} (${doc.status})`).join(", ")}`);
          });
  
          doc.end();
          return res.download(filePath);
        }
      }
  
      return res.status(200).json({ message: "KYC Documents Retrieved", users });
    } catch (error) {
      console.error("Error fetching KYC documents:", error);
      return res.status(500).json({ message: "Server Error", error: error.message });
    }
  };