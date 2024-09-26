// csvProcessor.js
const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");

async function connectToDatabase(uri) {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  }
}

async function processCSV(filePath, Model) {
  const users = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        // Validate row here based on the Model's schema
        const newUser = new Model(row);
        // Generate CertID if not provided
        if (typeof newUser.CertID === 'undefined') {
          newUser.CertID = newUser.generateCertID();
        }

        users.push(newUser);
      })
      .on("end", async () => {
        try {
          if (users.length === 0) {
            console.log("No valid users found in the CSV file.");
            return resolve();
          }

          const bulkOps = users.map((user) => ({
            updateOne: {
              filter: { CertID: user.CertID },
              update: { $setOnInsert: user.toObject() },
              upsert: true,
            },
          }));

          await Model.bulkWrite(bulkOps);
          users.forEach(user => console.log(`User saved: ${user.Name}`));
          console.log(`${users.length} users processed and inserted/updated successfully.`);
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

async function runProcessor(uri, schemaConfig, csvFilePath) {
  const modelName = schemaConfig.modelName;
  const schema = new mongoose.Schema(schemaConfig.schemaDefinition);

  // Create indexes
  if (schemaConfig.indexes) {
    schemaConfig.indexes.forEach(index => schema.index(index.fields, index.options));
  }

  // Add methods to the schema
  if (schemaConfig.methods) {
    Object.entries(schemaConfig.methods).forEach(([methodName, method]) => {
      schema.methods[methodName] = method;
    });
  }

  const Model = mongoose.model(modelName, schema, modelName);
  await connectToDatabase(uri);
  await processCSV(csvFilePath, Model);
}

module.exports = { runProcessor };
