const twilio = require("twilio");
const dotenv = require("dotenv");
const {User} = require("../models/Users");
dotenv.config();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendUpdatesToUsers = async (req, res) => {
    try {
        const {message} = req.body;
        if(!message) {
            return res.status(400).json({success: false, message: "Please provide a message"});
        }

        //fetch all users phone numbers
        const users = await User.find({}, "phoneNumber");

        if(!users.length){
            return res.status(404).json({success: false, message: "No users found"});
        }

        //send message to all users
        for(let user of users){
            if(user.phoneNumber){
                await client.message.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: user.phoneNumber
                })
            }
        }

        return res.status(200).json({success: true, message: "Message sent successfully"});
    } catch (error) {
        console.error("Error sending updates", error);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
}