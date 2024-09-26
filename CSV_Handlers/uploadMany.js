const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.ATLAS_URI;
const MemberSchema = new mongoose.Schema({
  MemberID: { type: String, required: true },
  Name: { type: String, required: true, index: true }, // Index
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
  CertID: { type: String, unique: true }, // Unique
  LastAccessed: { type: Date, default: null },
});

// Method to generate CertID
MemberSchema.methods.generateCertID = function () {
  return `ACES/${this.AcademicYear}/MEM/${this.Class}/${this.MemberID}`;
};

// Pre-save hook to set CertID
MemberSchema.pre("save", function (next) {
  if (!this.CertID) {
    this.CertID = this.generateCertID();
  }
  next();
});

// Composite index
MemberSchema.index({ Name: 1, CertID: 1 }, { unique: true });
const Membership_User = mongoose.model("Members", MemberSchema, "Members");

async function connectToDatabase() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    await Membership_User.createIndexes();
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  }
}

async function processCSV(filePath) {
  const users = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        if (
          row &&
          row.Name &&
          row.Class &&
          row.AcademicYear &&
          typeof row.MemberID === "string" &&
          typeof row.Name === "string" &&
          typeof row.Email === "string" &&
          typeof row.PositionGroup === "string" &&
          typeof row.Position === "string" &&
          typeof row.AcademicYear === "string" &&
          typeof row.Class === "string"
        ) {
          const newUser = new Membership_User({
            MemberID: row.MemberID.trim(),
            Name: row.Name.trim(),
            Email: row.Email.trim(),
            PositionGroup: row.PositionGroup.trim(),
            Position: row.Position.trim(),
            AcademicYear: row.AcademicYear.trim(),
            Class: row.Class.trim(),
          });

          // Generate CertID for each user
          newUser.CertID = newUser.generateCertID();
          users.push(newUser);
        } else {
          console.log("Invalid row, missing fields:", row);
        }
      })
      .on("end", async () => {
        try {
          if (users.length === 0) {
            console.log("No valid users found in the CSV file.");
            return resolve();
          }

          const bulkOps = users.map((user) => ({
            updateOne: {
              filter: { CertID: user.CertID }, // Use CertID as the filter
              update: { $setOnInsert: user.toObject() },
              upsert: true,
            },
          }));

          await Membership_User.bulkWrite(bulkOps);
          console.log(
            `${users.length} users processed and inserted/updated successfully.`
          );
          resolve();
        } catch (err) {
          console.error("Error processing users:", err);
          reject(err);
        } finally {
          mongoose.connection.close();
        }
      })
      .on("error", (err) => {
        console.error("Error reading CSV file:", err);
        reject(err);
      });
  });
}

async function main() {
  await connectToDatabase();
  const csvFilePath = "./Datasets/Membership_data.csv";
  await processCSV(csvFilePath);
}

main().catch((err) => {
  console.error("Error in main process:", err);
});
