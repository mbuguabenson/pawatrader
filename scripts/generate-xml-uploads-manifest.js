const fs = require('fs');
const path = require('path');

const uploadsDir = path.resolve(__dirname, '../xml-uploads');
const publicUploadsDir = path.resolve(__dirname, '../public/xml-uploads');
const manifestJsonPath = path.join(publicUploadsDir, 'bots.json');

if (!fs.existsSync(uploadsDir)) {
    console.error('xml-uploads directory not found:', uploadsDir);
    process.exit(1);
}

if (!fs.existsSync(publicUploadsDir)) {
    fs.mkdirSync(publicUploadsDir, { recursive: true });
}

const files = fs.readdirSync(uploadsDir);
const xmlFiles = files.filter(file => file.toLowerCase().endsWith('.xml'));

// Copy uploaded XMLs into public/xml-uploads so they are served by the app.
xmlFiles.forEach(file => {
    const sourceFile = path.join(uploadsDir, file);
    const targetFile = path.join(publicUploadsDir, file);
    fs.copyFileSync(sourceFile, targetFile);
});

const manifest = xmlFiles.map(file => ({
    name: file.replace(/\.xml$/i, ''),
    file,
    basePath: '/xml-uploads/',
}));

fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 4));
console.log(`Copied ${manifest.length} uploaded XML files and generated manifest at ${manifestJsonPath}`);
