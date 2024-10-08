const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();
const path = require("path");
const { cursorTo } = require("readline");
const router = express.Router();
const Sentiment = require("sentiment");


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
const sentiment = new Sentiment();
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
  const pageMembership = parseInt(req.query.pageMembership) || 1; // Membership pagination
  const pageGitHub = parseInt(req.query.pageGitHub) || 1; // GitHub pagination
  const limit = parseInt(req.query.limit) || 2;

  try {
    const totalMembershipUsers = await MembershipUser.countDocuments();
    const totalPagesMembership = Math.ceil(totalMembershipUsers / limit);
    const recentMembershipGetters = await MembershipUser.find()
      .sort({ LastAccessed: -1 })
      .skip((pageMembership - 1) * limit)
      .limit(limit);

    const totalGitHubUsers = await GitHub_101_User.countDocuments();
    const totalPagesGitHub = Math.ceil(totalGitHubUsers / limit);
    const recentGitHubGetters = await GitHub_101_User.find()
      .sort({ LastAccessed: -1 })
      .skip((pageGitHub - 1) * limit)
      .limit(limit);

    const enrichedGitHubGetters = recentGitHubGetters.map(user => {
      const analysis = user.Feedback ? sentiment.analyze(user.Feedback) : { score: 0 };
      return {
        ...user.toObject(), // Convert Mongoose document to plain object
        sentimentScore: analysis.score,
        sentimentClass: classifySentiment(analysis)
      };
    });

    res.render('admin', {
      recentMembershipGetters,
      membersWithCertificates: await MembershipUser.countDocuments({ LastAccessed: { $exists: true } }),
      totalMembershipUsers,
      recentGitHubGetters: enrichedGitHubGetters,
      githubUsersWithCertificates: await GitHub_101_User.countDocuments({ LastAccessed: { $exists: true } }),
      totalGitHubUsers,
      currentPageMembership: pageMembership,
      totalPagesMembership,
      currentPageGitHub: pageGitHub,
      totalPagesGitHub,
      limit
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).send("Internal Server Error");
  }
});

const classifySentiment = (analysis) => {
  const score = analysis.score;
  if (score > 0) return 'Positive';
  else if (score < 0) return 'Negative';
  else return 'Neutral';
};


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}/admin`);
});
// http://localhost:3001/admin?page=1&limit=1

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed.");
  process.exit(0);
});

process.on("SIGTSTP", () => {
  console.log("Received SIGTSTP (CTRL+Z). Triggering SIGINT.");
  process.kill(process.pid, "SIGINT"); // Send SIGINT to self
});