const {SecurityLog, AuditLog, User } = require("../models/Users"); // adjust path as needed

// GET /security-logs
exports.getSecurityLogs = async (req, res) => {
  try {
    const { action } = req.query;
    const user = req.user;

    const filter = {};

    // If user is NOT superadmin, only show their own logs
    if (user.role !== "superadmin") {
      filter.userId = user.id;
    }

    // Filter by action if provided
    if (action) {
      filter.action = action;
    }

    const logs = await SecurityLog.find(filter)
      .sort({ timestamp: -1 })
      .select("action status ipAddress timestamp");

    return res.status(200).json({
      success: true,
      message: "Security logs fetched successfully",
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching security logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch security logs",
    });
  }
};

exports.getAuditLogs = async (req, res) => {
    try {
      const { entity_type } = req.query;
      const user = req.user;
  
      // Check if user is admin or superadmin
      if (user.role !== "admin" && user.role !== "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admins only.",
        });
      }
  
      const filter = {};
  
      if (entity_type) {
        filter.entity_type = entity_type;
      }
  
      const logs = await AuditLog.find(filter)
        .sort({ created_at: -1 })
        .populate("performed_by", "name email") // only return name and email
        .select("action entity_id created_at performed_by");
  
      return res.status(200).json({
        success: true,
        message: "Audit logs retrieved successfully",
        data: logs,
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve audit logs",
      });
    }
  };
  

  exports.getAuditLogById = async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
  
      // Only allow admin or superadmin to access
      if (user.role !== "admin" && user.role !== "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admins only.",
        });
      }
  
      const log = await AuditLog.findById(id)
        .populate("performed_by", "name email role") // populate admin user
        .lean();
  
      if (!log) {
        return res.status(404).json({
          success: false,
          message: "Audit log not found",
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "Audit log retrieved successfully",
        data: log,
      });
    } catch (error) {
      console.error("Error fetching audit log by ID:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve audit log",
      });
    }
  };