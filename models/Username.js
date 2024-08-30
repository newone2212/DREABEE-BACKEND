const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UsernameSchema = new Schema({
    keyword: { type: String, required: true },
    username: { type: String, required: true }
});

module.exports = mongoose.model('Usernames', UsernameSchema);