// models/Intake.js
const mongoose = require("mongoose");

const IntakeSchema = new mongoose.Schema({
  clientEmail: { type: String, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  type: { type: String, default: "intake" }
});

module.exports = mongoose.model("Intake", IntakeSchema);
