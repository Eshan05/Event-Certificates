const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.ATLAS_URI;

const GitHubUserSchema = new mongoose.Schema({
  MemberID: { type: String, unique: true },
  Name: { type: String, required: true },
  CertID: { type: String, unique: true },
  Class: { type: String, enum: ["BE", "TE", "SE"], required: true },
  LastAccessed: { type: Date, default: null },
});

// Method to generate CertID
GitHubUserSchema.methods.generateCertID = function () {
  return `ACES/2024-25/GIT/${this.Class}/${this.MemberID}`;
};

// Pre-save hook to set CertID
GitHubUserSchema.pre("save", function (next) {
  if (!this.CertID) {
    this.CertID = this.generateCertID();
  }
  next();
});

GitHubUserSchema.index({ CertID: 1, Name: 1 }, { unique: true });
const GitHub_101_User = mongoose.model(
  "GitHub_101",
  GitHubUserSchema,
  "GitHub_101"
);
async function connectToDatabase() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.\nApp is running.");
    await GitHub_101_User.createIndexes();
  } catch (err) {
    console.error("Error connecting to MongoDB: ", err);
    process.exit(1); // Use Mongo Extension BTW 
  }
}

async function processCSV() {
  await connectToDatabase();
  const savePromises = [];
  const stream = fs
    .createReadStream("./Datasets/GitHub_101_data.csv")
    .pipe(csv());

  stream.on("data", (row) => {
    if (row.MemberID && row.Name && row.Class) {
      const MemberID = row.MemberID.trim();
      const Name = row.Name.trim();
      const Class = row.Class.trim();

      const savePromise = (async () => {
        try {
          const existingUser = await GitHub_101_User.findOne({
            MemberID,
            Name,
          });
          if (!existingUser) {
            const user = new GitHub_101_User({ MemberID, Name, Class });
            await user.save();
            console.log(`Saved user: ${user}`);
          } else {
            console.log(
              `User with MemberID: ${MemberID} <=> ${Name} already exists`
            );
          }
        } catch (err) {
          console.error("Error saving user:", err);
        }
      })();
      savePromises.push(savePromise);
    } else {
      console.log("Invalid row, missing fields:", row);
    }
  });

  stream.on("end", async () => {
    await Promise.all(savePromises);
    console.log("CSV processing completed");
    mongoose.connection.close();
  });

  stream.on("error", (err) => {
    console.error("Error reading CSV file:", err);
  });
}

processCSV();
