const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UsernameSchema = new Schema({
    keyword: { type: String},
    profile_picture_url: { type: String},
    description: { type: String},
    categories: { type: String},
});

module.exports = mongoose.model('BrandsExtraData', UsernameSchema);







