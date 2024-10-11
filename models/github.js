const mongoose = require('mongoose');

const GitHubUserSchema = new mongoose.Schema({
  MemberID: { type: String, unique: true },
  Name: { type: String, required: true },
  CertID: { type: String, unique: true },
  Class: { type: String, enum: ["BE", "TE", "SE"], required: true },
  LastAccessed: { type: Date, default: null },
  Feedback: { type: String, default: null },
});

module.exports = GitHubUserSchema;
