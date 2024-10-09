const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config({ path: "../.env.local" });
dotenv.config();

const uri = process.env.ATLAS_URI;
const MemberSchema = require('../models/membership');

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

// Composite index on Name and Class
MemberSchema.index({ Name: 1, Class: 1 }, { unique: true });
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

async function saveUser(row) {
  const {
    MemberID,
    Name,
    Email,
    PositionGroup,
    Position,
    AcademicYear,
    Class,
  } = row;

  try {
    // Check for an existing user with the same details
    const existingUser = await Membership_User.findOne({
      MemberID,
      Name,
      Email,
      PositionGroup,
      Position,
      AcademicYear,
      Class,
    });

    if (!existingUser) {
      const user = new Membership_User({
        MemberID: MemberID.trim(),
        Name: Name.trim(),
        Email: Email.trim(),
        PositionGroup: PositionGroup.trim(),
        Position: Position.trim(),
        AcademicYear: AcademicYear.trim(),
        Class: Class.trim(),
      });
      await user.save(); // Triggers pre-save hook
      console.log(`Saved user: ${user.Name}`);
    } else {
      console.log(
        `User with the same details already exists: ${Name}, ${AcademicYear}, ${Class}`
      );
    }
  } catch (err) {
    console.error("Error saving user for row:", row, err);
  }
}

async function processCSV() {
  await connectToDatabase();
  const stream = fs
    .createReadStream("../Datasets/Membership_data.csv")
    .pipe(csv());
  const savePromises = [];

  stream.on("data", (row) => {
    if (row.Name && row.Class) {
      savePromises.push(saveUser(row));
    } else {
      console.log("Invalid row, missing fields:", row);
    }
  });

  stream.on("end", async () => {
    await Promise.allSettled(savePromises);
    console.log("CSV processing completed");
    mongoose.connection.close();
  });

  stream.on("error", (err) => {
    console.error("Error reading CSV file:", err);
    mongoose.connection.close();
  });
}

processCSV();