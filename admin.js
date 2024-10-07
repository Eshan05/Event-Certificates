const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();
const path = require("path");
const router = express.Router();


const uri = process.env.ATLAS_URI;
if (!uri) {
  console.error("MongoDB URI is not defined in the environment variables");
  process.exit(1);
}

async function connectToDatabase() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.\nApp is running.");
  } catch (err) {
    console.error("Error connecting to MongoDB: ", err);
    process.exit(1);
  }
}

connectToDatabase();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

const GitHubUserSchema = new mongoose.Schema({
  CertID: { type: String, required: true, unique: true },
  Name: { type: String, required: true },
  Class: { type: String, enum: ["BE", "TE", "SE"], required: true },
  LastAccessed: { type: Date, default: null },
  Feedback: { type: String, default: null },
});

const MembershipUserSchema = new mongoose.Schema({
  MemberID: { type: String, required: true },
  Name: { type: String, required: true },
  Email: { type: String, required: true },
  PositionGroup: {
    type: String,
    enum: ["Executive", "Team Lead", "Member"],
    default: "Member",
    required: true,
  },
  Position: { type: String, required: true },
  AcademicYear: {
    type: String,
    enum: ["2022-23", "2023-24", "2024-25"],
    required: true,
  },
  Class: { type: String, enum: ["BE", "TE", "SE"], required: true },
  CertID: { type: String, unique: true },
  LastAccessed: { type: Date, default: null },
});

app.use(express.static(__dirname + "/public"));
const MembershipUser = mongoose.model(
  "Members",
  MembershipUserSchema,
  "Members"
);
const GitHub_101_User = mongoose.model(
  "GitHub_101",
  GitHubUserSchema,
  "GitHub_101"
);

app.get('/admin', async (req, res) => {
  try {
    const recentMembershipGetters = await MembershipUser.find()
      .sort({ LastAccessed: -1 })
      .limit(10);
    const recentGitHubGetters = await GitHub_101_User.find()
      .sort({ LastAccessed: -1 })
      .limit(10);

    const totalMembershipUsers = await MembershipUser.countDocuments();
    const membersWithCertificates = await MembershipUser.countDocuments({ LastAccessed: { $exists: true } });
    const totalGitHubUsers = await GitHub_101_User.countDocuments();
    const githubUsersWithCertificates = await GitHub_101_User.countDocuments({ LastAccessed: { $exists: true } });
    res.render('admin', {
      recentMembershipGetters,
      membersWithCertificates,
      totalMembershipUsers,
      recentGitHubGetters,
      githubUsersWithCertificates,
      totalGitHubUsers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
})


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}/admin`);
});

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed.");
  process.exit(0);
});

process.on("SIGTSTP", () => {
  console.log("Received SIGTSTP (CTRL+Z). Triggering SIGINT.");
  process.kill(process.pid, "SIGINT"); // Send SIGINT to self
});