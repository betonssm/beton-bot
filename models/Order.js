const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  city: String,
  productType: String,
  fillerType: String,
  materialGrade: String,
  volume: Number,
  deliveryAddress: String,
  deliveryDateTime: String,
  deliveryMethod: String,
  pumpLength: String,
  customerType: String,
  paymentMethod: String,
  phoneNumber: String,
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);