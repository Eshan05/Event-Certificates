const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
let lastPdf; // Variable to store the last generated PDF

app.get('/try-pdf', (req, res) => {
  res.render('try-pdf', { pdfUrl: null });
});

app.post('/try-pdf', async (req, res) => {
  const inputs = req.body.inputs;
  const certificatePath = path.join(__dirname, "./Certificate_Templates/101_Certificate.pdf");
  const existingPdfBytes = await fs.promises.readFile(certificatePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log("Page Dimensions (W:H)", parseFloat(width), parseFloat(height))

  // Loop through the input
  for (const input of inputs) {
    const { value, fontFamily, fontSize, xCoord, yCoord } = input;
    const fontPath = path.join(__dirname, 'fonts', `${fontFamily}.ttf`);
    const fontBytes = await fs.promises.readFile(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);
    if (xCoord > width) return res.status(404).send('X Coordinate out of bound')
    if (yCoord > height) return res.status(404).send('Y Coordinate out of bound')

    page.drawText(value, {
      x: parseFloat(xCoord),
      y: parseFloat(yCoord),
      size: parseInt(fontSize),
      font: customFont,
    });
  }

  const pdfBytes = await pdfDoc.save();
  lastPdf = pdfBytes; // Store PDF bytes in memory
  const pdfUrl = '/view-pdf'; // Set URL to view PDF
  res.render('try-pdf', { pdfUrl });
});

app.get('/view-pdf', (req, res) => {
  if (!lastPdf) return res.status(404).send('No PDF generated yet.');

  // Set headers to display PDF in the browser
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="certificate.pdf"');
  res.send(Buffer.from(lastPdf));
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}/try-pdf`);
});

process.on("SIGINT", async () => {
  process.exit(0);
});

process.on("SIGTSTP", () => {
  console.log("Received SIGTSTP (CTRL+Z). Triggering SIGINT.");
  process.kill(process.pid, "SIGINT"); // Send SIGINT to self
});
