const pdfParse = require('pdf-parse');
const fs = require('fs');

async function extractPDF() {
  try {
    const dataBuffer = fs.readFileSync('C:\\Users\\HP\\Downloads\\LoVs 1.1.0.pdf');
    const data = await pdfParse(dataBuffer);
    
    fs.writeFileSync('C:\\Users\\HP\\my-polyglot-app\\pdf-text.txt', data.text);
    console.log('SUCCESS: Extracted ' + data.numpages + ' pages');
    console.log('Text saved to pdf-text.txt');
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  }
}

extractPDF();
