// controllers/otaController.js
const path = require('path');
const fs = require('fs');

exports.uploadFirmwareFile = (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.files.file;
  const uploadPath = path.join(__dirname, '../public/files', file.name);

  file.mv(uploadPath, (err) => {
    if (err) return res.status(500).json({ error: 'File upload failed', details: err.message });

    const fileUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/files/${file.name}`;
    res.status(200).json({ message: 'Firmware uploaded successfully', fileUrl });
  });
};

exports.getFirmwareFiles = (req, res) => {
  const filesDir = path.join(__dirname, '../public/files');

  fs.readdir(filesDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to read firmware directory' });

    const baseUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/files/`;
    const firmwareFiles = files.map(file => ({
      filename: file,
      url: baseUrl + encodeURIComponent(file)
    }));

    res.status(200).json({ files: firmwareFiles });
  });
};
