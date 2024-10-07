const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const fs = require("fs");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config();
const path = require("path");
const fontkit = require("@pdf-lib/fontkit");
// const rateLimit = require('express-rate-limit');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// Rate limiting (uncomment to use)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 50,
//   message: "Too many requests, please try again after 15 minutes"
// });
// app.use(limiter);

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

function sendResponse(res, message) {
  res.send(`
    <html>
      <body>
        <p>${message}</p>
        <p>If you have any questions, visit <a href="/faqs">FAQs</a>.</p>
      </body>
    </html>
  `);
}

app.get("/", (req, res) => { res.render("gateway"); });
app.get("/faqs", (req, res) => { res.render("faqs"); });

app.get("/Membership", (req, res) => { res.render("Membership"); });
app.get("/GitHub_101", (req, res) => { res.render("GitHub_101"); });

app.get("/verify", (req, res) => {
  res.render("verify", { user: null, showForm: true, error: null });
});
app.post("/verify", async (req, res) => {
  const cert = req.body.id.trim();
  try {
    let user = null;
    let EventName = null;
    if (cert.includes("GIT")) {
      user = await GitHub_101_User.findOne({ CertID: cert });
      EventName = "GitHub 101";
    } else if (cert.includes("MEM")) {
      user = await MembershipUser.findOne({ CertID: cert });
      EventName = "Membership";
    }

    if (user) res.render("verify", { user, EventName, showForm: true, error: null, success: true, });
    else res.render("verify", { user: null, EventName, showForm: true, error: "Certificate ID Not Found!", success: false, });
  } catch (error) {
    console.log(error);
    res.render("verify", { user: null, showForm: true, error: "An error occurred!", success: false });
  }
});

app.post("/GitHub_101", async (req, res) => {
  const userName = req.body.name.trim();
  const feedback = req.body.feedback ? req.body.feedback.trim() : null;
  try {
    const user = await GitHub_101_User.findOne({ Name: userName });
    if (user) {
      const pdfBytes = await generatePdfWithName_GitHub_101(
        user.CertID,
        user.Name
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=GitHub_101_Certificate.pdf"
      );
      res.setHeader("Content-Type", "application/pdf");
      res.send(Buffer.from(pdfBytes)); // Send the PDF as a buffer
      user.LastAccessed = new Date();
      if (feedback) user.Feedback = feedback;
      await user.save();
    } else {
      const message = "Name Not Found! Please enter your First & Last Name only.";
      sendResponse(res, message);
    }
  } catch (err) {
    console.error("Error generating certificate:", err);
    res.status(500).send("Error generating certificate");
  }
});

app.post("/Membership", async (req, res) => {
  const { name: userName, academic_year: userAcademicYear } = req.body;
  try {
    const user = await MembershipUser.findOne({
      Name: userName.trim(),
      AcademicYear: userAcademicYear,
    });
    if (user) {
      const pdfBytes = await generatePdfWithName_Membership(user);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Membership_Certificate_${user.AcademicYear}.pdf`
      );
      res.setHeader("Content-Type", "application/pdf");
      res.send(Buffer.from(pdfBytes));
      user.LastAccessed = new Date();
      await user.save();
    } else {
      const message = "Name and/or Academic Year is incorrect. Please double check.";
      sendResponse(res, message);
    }
  } catch (err) {
    console.error("Error generating certificate:", err);
    res.status(500).send("An error occurred while generating the certificate.");
  }
});

async function generatePdfWithName_GitHub_101(certID, name) {
  try {
    const certificatePath = path.join(
      __dirname,
      "./Certificate_Templates/GitHub_101_Certificate.pdf"
    );
    const existingPdfBytes = fs.readFileSync(certificatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.registerFontkit(fontkit);
    // Custom font stuff
    const fontPath = path.join(__dirname, "fonts", "Anastasia-Script.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const NameFont = await pdfDoc.embedFont(fontBytes);
    const IDFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    // console.log(`Page dimensions: width=${width}, height=${height}`);

    page.drawText(certID, {
      x: 220,
      y: height - 420,
      size: 10,
      font: IDFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(name, {
      x: 270,
      y: height - 260,
      size: 30,
      font: NameFont,
      color: rgb(0.4, 0.19215686274509805, 0.37254901960784315),
    });
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (err) {
    console.error("Error generating PDF:", err);
    throw new Error("Error generating PDF");
  }
}

async function generatePdfWithName_Membership(user) {
  const { Name, AcademicYear, Class, Position, PositionGroup, CertID } = user;
  try {
    switch (PositionGroup) {
      case "Executive":
        certificatePath = path.resolve(
          __dirname,
          "./Certificate_Templates/Membership_Executive_Certificate.pdf"
        );
      case "Team Lead":
        certificatePath = path.resolve(
          __dirname,
          "./Certificate_Templates/Membership_Team_Lead_Certificate.pdf"
        );
      case "Member":
        certificatePath = path.resolve(
          __dirname,
          "./Certificate_Templates/Membership_Member_Certificate.pdf"
        );
    }

    // const certificatePath = path.resolve(__dirname, "certificate.pdf");
    const existingPdfBytes = fs.readFileSync(certificatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.resolve(__dirname, "fonts", "Anastasia-Script.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const NameFont = await pdfDoc.embedFont(fontBytes);
    const IDFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    page.drawText(CertID, {
      x: 220,
      y: height - 420,
      size: 20,
      font: IDFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(Position, {
      x: 270,
      y: height - 300,
      size: 30,
      font: NameFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(Class, {
      x: 270,
      y: height - 340,
      size: 30,
      font: NameFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(AcademicYear, {
      x: 270,
      y: height - 380,
      size: 30,
      font: IDFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(Name, {
      x: 270,
      y: height - 260,
      size: 30,
      font: NameFont,
      color: rgb(0, 0, 0),
    });

    return await pdfDoc.save();
  } catch (err) {
    console.error("Error generating PDF:", err);
    throw new Error("Error generating PDF");
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}`);
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

// This is to not get frustated when I click CTRL+Z and then have to go and check PID and then close it
