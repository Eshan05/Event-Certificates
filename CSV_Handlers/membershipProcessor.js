const dotenv = require("dotenv");
const { runProcessor } = require("./csvProcessor");
dotenv.config({ path: ".env.local" });
dotenv.config();

const uri = process.env.ATLAS_URI;
const schemaConfig = {
  modelName: "Members",
  schemaDefinition: {
    MemberID: { type: String, required: true },
    Name: { type: String, required: true, index: true },
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
  },
  indexes: [
    { fields: { Name: 1, CertID: 1 }, options: { unique: true } }
  ],
  methods: {
    generateCertID: function () {
      return `ACES/${this.AcademicYear}/MEM/${this.Class}/${this.MemberID}`;
    }
  }
};

const csvFilePath = "./Datasets/Membership_data.csv";
async function main() {
  await runProcessor(uri, schemaConfig, csvFilePath);
}

main().catch((err) => {
  console.error("Error in main process:", err);
});
