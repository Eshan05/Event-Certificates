const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();

// Define the MemberSchema directly in the test file
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

const Membership_User = mongoose.model("Members", MemberSchema);
let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Membership_User.deleteMany({});
});

// Test functions
const saveUser = async (row) => {
  const {
    MemberID,
    Name,
    Email,
    PositionGroup,
    Position,
    AcademicYear,
    Class,
  } = row;

  // Validate required fields
  if (!MemberID || !Name || !Email || !Position || !AcademicYear || !Class) {
    const error = new mongoose.Error.ValidationError();
    error.errors['required'] = { message: "Missing required fields" }; // Custom error message
    throw error;
  }

  const user = new Membership_User({
    MemberID: MemberID.trim(),
    Name: Name.trim(),
    Email: Email.trim(),
    PositionGroup: PositionGroup ? PositionGroup.trim() : "Member", // Default value
    Position: Position.trim(),
    AcademicYear: AcademicYear.trim(),
    Class: Class.trim(),
  });

  // Check for existing user
  const existingUser = await Membership_User.findOne({ MemberID });
  if (existingUser) throw new Error("User already exists");
  await user.save(); // Triggers pre-save hook
};


const processCSV = async (filePath) => {
  const savePromises = [];
  const stream = fs.createReadStream(filePath).pipe(csv());
  return new Promise((resolve) => {
    stream.on("data", (row) => {
      if (row.Name && row.Class) {
        savePromises.push(saveUser(row));
      }
    });

    stream.on("end", async () => {
      await Promise.allSettled(savePromises);
      resolve();
    });

    stream.on("error", (err) => {
      console.error("Error reading CSV file:", err);
      resolve();
    });
  });
};

describe("Membership_User Schema", () => {
  it("should save a user and generate CertID", async () => {
    const userRow = {
      MemberID: "001",
      Name: "John Doe",
      Email: "john@example.com",
      PositionGroup: "Member",
      Position: "Developer",
      AcademicYear: "2023-24",
      Class: "BE",
    };

    await saveUser(userRow);
    const user = await Membership_User.findOne({ MemberID: "001" });
    expect(user).toBeTruthy();
    expect(user.CertID).toBe("ACES/2023-24/MEM/BE/001");
  });

  it("should not allow duplicate users with the same details", async () => {
    const userRow = {
      MemberID: "002",
      Name: "Jane Smith",
      Email: "jane@example.com",
      PositionGroup: "Executive",
      Position: "Manager",
      AcademicYear: "2024-25",
      Class: "TE",
    };

    await saveUser(userRow);
    // Try to save the same user again
    await expect(saveUser(userRow)).rejects.toThrow();
    const users = await Membership_User.find({});
    expect(users.length).toBe(1); // Ensure only one user is saved
  });

  it("should allow saving users with the same details except MemberID", async () => {
    const userRow1 = {
      MemberID: "003",
      Name: "John Doe",
      Email: "john@example.com",
      PositionGroup: "Member",
      Position: "Developer",
      AcademicYear: "2023-24",
      Class: "BE",
    };

    const userRow2 = {
      MemberID: "004", // Different MemberID
      Name: "John Doe",
      Email: "john@example.com",
      PositionGroup: "Member",
      Position: "Developer",
      AcademicYear: "2023-24",
      Class: "BE",
    };

    await saveUser(userRow1);
    await saveUser(userRow2); // This should succeed
    const users = await Membership_User.find({});
    expect(users.length).toBe(2); // Ensure both users are saved
  });

  it("should throw an error when required fields are missing", async () => {
    const userRow = {
      MemberID: "003",
      // Name is missing
      Email: "missing@example.com",
      PositionGroup: "Member",
      Position: "Developer",
      AcademicYear: "2023-24",
      Class: "BE",
    };

    await expect(saveUser(userRow)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it("should handle valid CSV data correctly", async () => {
    const csvPath = "./Datasets/Membership_data.csv";
    await processCSV(csvPath);
    const users = await Membership_User.find({});
    expect(users.length).toBeGreaterThan(0); // Ensure at least one user is saved
  });

  it("should handle invalid CSV rows gracefully", async () => {
    const invalidCsvPath = "./test_invalid.csv";
    const invalidCsvData = `MemberID,Name,Email,PositionGroup,Position,AcademicYear,Class\n,,jane@example.com,Member,Developer,2023-24,BE\n001,John Doe,john@example.com,Member,Developer,2023-24,BE\n,,`;
    fs.writeFileSync(invalidCsvPath, invalidCsvData);
    await processCSV(invalidCsvPath);
    const users = await Membership_User.find({});
    expect(users.length).toBe(1); // Ensure only valid rows are processed
    fs.unlinkSync(invalidCsvPath); // Clean up test file
  });
});
