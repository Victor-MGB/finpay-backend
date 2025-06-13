const app = require("../index");

const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
});

module.exports = server; // Export server for testing
