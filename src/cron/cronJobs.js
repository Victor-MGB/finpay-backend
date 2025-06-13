const cron = require('node-cron');
const sendEmail = require('../utils/sendEmail');
const { User } = require('../models/Users');

async function sendBirthdayNotifications() {
    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // JavaScript months are 0-based, MongoDB uses 1-based
        const currentDay = today.getDate();
        const currentYear = today.getFullYear();

        // Find users whose birthday is today and haven't been notified this year
        const users = await User.find({
            $expr: {
                $and: [
                    { $eq: [{ $month: '$dob' }, currentMonth] },
                    { $eq: [{ $dayOfMonth: '$dob' }, currentDay] }
                ]
            },
            birthdayNotified: { $ne: currentYear } // Ensure users are notified only once per year
        });

        for (let user of users) {
            // Send email
            await sendEmail({
                to: user.email,
                subject: 'Happy Birthday!',
                text: `Dear ${user.fullName},\n\nHappy Birthday from all of us at Banking App! 🎂🎈\n\nHave a wonderful day!`
            });

            // Update user's birthdayNotified field
            await User.updateOne({ _id: user._id }, { $set: { birthdayNotified: currentYear } });
            console.log(`🎉 Birthday email sent to ${user.fullName}`);
        }
    } catch (error) {
        console.error("Error in sending birthday notifications:", error);
    }
}

// Schedule cron job to run at 12:00 AM every day
let birthdayJob = null;

birthdayJob = cron.schedule('0 0 * * *', async () => {
    console.log('🎂 Running birthday notification cron job...');
    await sendBirthdayNotifications();
  }, { scheduled: false }); // << don't auto-start
  
  if (process.env.NODE_ENV !== 'test') {
    birthdayJob.start();
    console.log("✅ Birthday notification cron job scheduled.");
  }
  

module.exports = {birthdayJob};