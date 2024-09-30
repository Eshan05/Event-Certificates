const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const app = express();
app.set('view engine', 'ejs');
app.use(express.json());
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

app.get('/try-pdf', (req, res) => {
  res.render('try-pdf', { pdfUrl: null });
});

app.post('/try-pdf', async (req, res) => {
  try {
    // console.log('Request Headers:', req.headers);
    // console.log('Request Body:', req.body);
    const inputs = req.body.inputs;
    // if (!inputs || inputs.length === 0) return res.status(400).send('No inputs provided');
    const certificatePath = path.join(__dirname, "./Certificate_Templates/101_Certificate.pdf");
    const existingPdfBytes = await fs.promises.readFile(certificatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    for (const input of inputs) {
      const { value, fontFamily, fontSize, xCoord, yCoord } = input;
      const fontPath = path.join(__dirname, 'fonts', `${fontFamily}.ttf`);
      const fontBytes = await fs.promises.readFile(fontPath);
      const customFont = await pdfDoc.embedFont(fontBytes);

      if (xCoord > width) return res.status(404).send('X Coordinate out of bound');
      if (yCoord > height) return res.status(404).send('Y Coordinate out of bound');

      page.drawText(value, {
        x: parseFloat(xCoord),
        y: parseFloat(yCoord),
        size: parseInt(fontSize),
        font: customFont,
      });
    }

    const pdfBytes = await pdfDoc.save();
    // Save PDF to a temporary file
    const tempPdfPath = path.join(__dirname, 'public', 'generated.pdf');
    await fs.promises.writeFile(tempPdfPath, pdfBytes);

    const pdfUrl = '/generated.pdf'; // Set URL to view the PDF
    res.json({ pdfUrl }); // Instead of res.render for the toasts 
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Internal Server Error' + error.message);
  }
});

app.get('/generated.pdf', (req, res) => {
  const pdfPath = path.join(__dirname, 'public', 'generated.pdf');
  res.sendFile(pdfPath);
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => { console.log(`Server running on: http://localhost:${PORT}/try-pdf`); });
process.on("SIGINT", async () => { process.exit(0); });
process.on("SIGTSTP", () => {
  console.log("Received SIGTSTP (CTRL+Z). Triggering SIGINT.");
  process.kill(process.pid, "SIGINT"); // Send SIGINT to self
});