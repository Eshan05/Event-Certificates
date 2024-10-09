const mongoose = require('mongoose');

const GitHubUserSchema = new mongoose.Schema({
  CertID: { type: String, required: true, unique: true },
  Name: { type: String, required: true },
  Class: { type: String, enum: ["BE", "TE", "SE"], required: true },
  LastAccessed: { type: Date, default: null },
  Feedback: { type: String, default: null },
});

module.exports = GitHubUserSchema;
