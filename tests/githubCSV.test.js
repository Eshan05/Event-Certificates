const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");
const csv = require("csv-parser");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();

// Define the GitHubUserSchema directly in the test file
const GitHubUserSchema = new mongoose.Schema({
  MemberID: { type: String, unique: true, required: true },
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

const GitHub_101_User = mongoose.model("GitHub_101", GitHubUserSchema);
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  const GitHub_101_User = mongoose.model("GitHub_101", GitHubUserSchema);
  await GitHub_101_User.init();
  // Without the 2 lines above the memberId part fails
  // const indexes = await GitHub_101_User.listIndexes();
  // console.log("Indexes:", indexes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear the database before each test
beforeEach(async () => {
  await GitHub_101_User.deleteMany({});
});

// Mock processCSV function
const processCSV = async (filePath) => {
  const savePromises = [];
  const stream = fs.createReadStream(filePath).pipe(csv());

  stream.on("data", (row) => {
    if (row.MemberID && row.Name && row.Class) {
      const { MemberID, Name, Class } = row;
      const savePromise = (async () => {
        try {
          const user = new GitHub_101_User({ MemberID, Name, Class });
          await user.save();
        } catch (error) {
          console.error("Error saving user:", error.message);
        }
      })();
      savePromises.push(savePromise);
    }
  });

  return new Promise((resolve) => {
    stream.on("end", async () => {
      await Promise.all(savePromises);
      resolve();
    });
  });
};

describe("GitHubUserSchema", () => {
  it("should generate CertID before saving", async () => {
    const user = new GitHub_101_User({
      MemberID: "123",
      Name: "John Doe",
      Class: "BE",
    });
    await user.save();
    expect(user.CertID).toBe(`ACES/2024-25/GIT/BE/123`);
  });

  it("should not allow duplicate MemberID", async () => {
    const user1 = new GitHub_101_User({
      MemberID: "123",
      Name: "John Doe",
      Class: "BE",
    });
    await user1.save(); // Save the first user
    const user2 = new GitHub_101_User({
      MemberID: "123", // Same MemberID
      Name: "Jane Smith", // Different name
      Class: "TE",
    });

    // Attempt to save duplicate and check for MongoServerError
    await expect(user2.save()).rejects.toThrow(mongoose.Error.MongoServerError);
    const users = await GitHub_101_User.find({});
    expect(users.length).toBe(1); // Ensure only the first user is saved
  });

  it("should allow multiple users with the same name", async () => {
    const user1 = new GitHub_101_User({
      MemberID: "124",
      Name: "John Doe",
      Class: "BE",
    });
    await user1.save();
    const user2 = new GitHub_101_User({
      MemberID: "125",
      Name: "John Doe", // Same name, different MemberID
      Class: "TE",
    });

    await user2.save(); // Should allow this user
    const users = await GitHub_101_User.find({});
    expect(users.length).toBe(2); // Ensure both users are saved
  });

  it("should throw an error when required fields are missing", async () => {
    const user = new GitHub_101_User({
      MemberID: "126",
      // Name is missing
      Class: "BE",
    });

    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it("should throw an error for invalid Class", async () => {
    const user = new GitHub_101_User({
      MemberID: "127",
      Name: "Jane Doe",
      Class: "INVALID_CLASS", // Invalid class
    });

    await expect(user.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it("should process valid CSV data correctly", async () => {
    const csvPath = "./Datasets/GitHub_101_data.csv"; // Ensure this path is correct
    await processCSV(csvPath);
    const users = await GitHub_101_User.find({});
    expect(users.length).toBeGreaterThan(0); // Ensure at least one user is saved
  });

  it("should handle invalid CSV rows gracefully", async () => {
    const invalidCsvPath = "./test_invalid.csv";
    // Create invalid CSV data
    const invalidCsvData = `MemberID,Name,Class\n,,\n123,John Doe,BE\n,,`;
    fs.writeFileSync(invalidCsvPath, invalidCsvData);
    await processCSV(invalidCsvPath);
    const users = await GitHub_101_User.find({});
    expect(users.length).toBe(1); // Ensure only valid rows are processed
    fs.unlinkSync(invalidCsvPath); // Clean up test file
  });
});
