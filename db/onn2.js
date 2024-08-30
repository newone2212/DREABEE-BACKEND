const mongoose = require("mongoose");

mongoose
    .connect("mongodb://admin:1SmUp8RmpzWrJUU46Zmz@192.155.100.53:27017/admin", {
        useNewUrlParser: true,
    })
    .then(() => {
        console.log("Connection is successful");
    })
    .catch((err) => {
        console.log("No connection", err);
    });

const db = mongoose.connection;

// Event listeners for the connection
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("We're connected to the admin database!");
});

module.exports = db;
