const fs = require('fs');
const path = require('path');

// SVG content
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Minimalist background -->
  <rect width="512" height="512" rx="110" fill="#0f172a"/>
  
  <!-- Bold, clear V -->
  <path d="M 144 152 L 216 344 L 256 256 L 296 344 L 368 152 L 328 152 L 280 288 L 256 216 L 232 288 L 184 152 Z" 
        fill="#f8fafc" 
        stroke="none"/>
  
  <!-- Clear underline accent -->
  <rect x="168" y="368" width="176" height="12" fill="#f8fafc" opacity="0.5" rx="6"/>
</svg>`;

console.log('📝 Step 1: Please install sharp library first:');
console.log('   npm install sharp --save-dev');
console.log('');
console.log('   Then run this script again.');
console.log('');
console.log('💡 If you prefer to generate manually:');
console.log('   1. Open generate-favicon-pngs.html in your browser');
console.log('   2. Download the PNG files');
console.log('   3. Move them to the public folder');

try {
  const sharp = require('sharp');
  
  const publicDir = path.join(__dirname, 'public');
  const svgBuffer = Buffer.from(svgContent);

  async function generateIcons() {
    console.log('🎨 Generating favicon files...\n');

    // Generate 192x192 for PWA
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✅ Created icon-192.png');

    // Generate 512x512 for PWA
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✅ Created icon-512.png');

    // Generate 180x180 for Apple
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✅ Created apple-touch-icon.png');

    // Generate 32x32 favicon
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon-32x32.png'));
    console.log('✅ Created favicon-32x32.png');

    // Generate 16x16 favicon
    await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toFile(path.join(publicDir, 'favicon-16x16.png'));
    console.log('✅ Created favicon-16x16.png');

    console.log('\n🎉 All favicon files generated successfully!');
    console.log('🔄 Restart your dev server to see the changes.');
  }

  generateIcons().catch(err => {
    console.error('❌ Error generating icons:', err);
  });

} catch (error) {
  // Sharp not installed, show instructions
}
