const path = require('path');
const multer = require('multer');
const { AppError } = require('./errors');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file

// Files are checked by their real content (magic bytes), not just the name or declared type.
const SIGNATURES = {
  'application/pdf': (b) => b.subarray(0, 4).toString('latin1') === '%PDF',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 3 } });

function checkFiles(files = []) {
  for (const f of files) {
    const valid = SIGNATURES[f.mimetype];
    if (!valid || !valid(f.buffer)) {
      throw new AppError(400, 'Unsupported file. Please upload a PDF, JPG, PNG or WebP file up to 5 MB.');
    }
    // Keep only a safe file name (no paths, no control characters).
    f.originalname = path.basename(f.originalname).replace(/[\x00-\x1f"\\]/g, '').slice(0, 200) || 'file';
  }
  return files;
}

module.exports = { upload, checkFiles };
