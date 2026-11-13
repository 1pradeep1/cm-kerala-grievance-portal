require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const grievanceRoutes = require('./routes/grievances');
const cmoRoutes = require('./routes/cmo');
const officerRoutes = require('./routes/officer');
const attachmentRoutes = require('./routes/attachments');
const contactRoutes = require('./routes/contact');
const aiRoutes = require('./routes/ai');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct client IPs in rate limiting
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));

// Brute-force protection on login/register.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/grievances', grievanceRoutes);
app.use('/api/cmo', cmoRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', publicRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// Serve the built React app (added in a later step) from the same server.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// One error handler: known errors keep their status, anything unexpected becomes a generic 500.
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 5 MB)'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Too many files (maximum 3)' : 'File upload failed';
    return res.status(400).json({ error: msg });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

module.exports = app;
