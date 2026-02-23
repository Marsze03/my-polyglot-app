// CommonJS module for PDF parsing
const pdfParse = require('pdf-parse');

async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { parsePDF };
