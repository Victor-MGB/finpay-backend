const jwt = require("jsonwebtoken");
const User = require("../models/Users");

// Middleware to protect routes
exports.authenticate = async (req, res, next) => {
    try{
        // Get token from header
        const token = req.header("Authorization").replace("Bearer ","");

        // Check if not token
        if (!token || !token.StartsWith("Bearer")) {
            return res.status(401).json({ message: "Access Denied: No token provided" });
        }

        //Extract actual token
        const jwtToken = token.split(" ")[1];

        // Verify token
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

        //Find user from token
        const user = User.findById(decoded.id);

        if(!user){
            return res.status(404).json({message:"user not found"});
        }

        //check if user is disabled (optional security measure)
        if(user.disabled){
            return res.status(401).json({message:"user is disabled"});
        }

        //Attach user to request object
        req.user = user;
        next();
    }catch(err){
        console.error("Auth Middleware Error",err);

        if(err.name === "TokenExpiredError"){
            return res.status(401).json({message:"Access Denied: Token Expired"});
        }
        res.status(401).json({message:"Access Denied: Invalid Token"});
    }
}

exports.authorize = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access Denied: Unauthorized" });
        }
        next();
    };
}