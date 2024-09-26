const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.ATLAS_URI;

const MemberSchema = new mongoose.Schema({
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

MemberSchema.index({ Name: 1, Class: 1 }, { unique: true });
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
    .createReadStream("./Datasets/Membership_data.csv")
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

//   stream.on("data", async (row) => {
//     if (row.name && row.year) {
//       const year = row.year.trim();
//       const name = row.name.trim();
//       const join = row.join.trim();
//       const position = row.position.trim();
//       const endnumber = row.endnumber.trim();
//       try {
//         const existingUser = await User.findOne({ year, name }); // Handles duplication
//         if (!existingUser) {
//           const user = new User({ year, name, join, position, endnumber });
//           // Create new user with the given information
//           pendingSaves++; // Mount
//           await user.save().catch((err) => {
//             console.error("Error saving user:", err);
//           });
//           console.log(`Saved user: ${user}`);
//           pendingSaves--; // Unmount
//         } else console.log(`User with name: ${name} already exists`);
//       } catch (err) {
//         console.error("Error saving user:", err);
//       }
//     } else console.log("Invalid row, missing fields:", row);
//   });

//   stream.on("end", () => {
//     const checkCompletion = setInterval(() => {
//       if (pendingSaves === 0) {
//         console.log("CSV processing completed");
//         mongoose.connection.close();
//         // Only times it may not close is when save() is having error (Assuming you have connected properly), or basically error somewhere above
//         clearInterval(checkCompletion);
//       }
//     }, 1000);
//   });
// }

// processCSV();

// db.User.dropIndex("Name_1");
// db.User.createIndex({ Name: 1, Class: 1 }, { unique: true });
// Previously we indexed over names but now this is a composite index like in uploadMany.js, so basically
// if I have two users with Eshan then it will get saved AS LONG AS the other index (Class here) is different,
// if class is also same then it won't get saved

// Chose class cause only two letters (Faster query most likely) and it's in certID too so it will be unique for each entry
