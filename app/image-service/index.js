require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const PORT = process.env.PORT || 4000;
const USE_S3 = (process.env.USE_S3 || 'false') === 'true';
const S3_BUCKET = process.env.AWS_S3_BUCKET;
const CDN_URL = process.env.CDN_URL || '';

const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const s3client = USE_S3
  ? new S3Client({ region: process.env.AWS_REGION })
  : null;

const app = express();
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml'
];

function createWatermarkSVG(text) {
  const svg = `<?xml version="1.0" encoding="utf-8"?>
  <svg xmlns='http://www.w3.org/2000/svg' width='800' height='200'>
    <rect x='0' y='0' width='100%' height='100%' fill='transparent'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='36' fill='rgba(255,255,255,0.6)' stroke='rgba(0,0,0,0.3)' stroke-width='1'>${text}</text>
  </svg>`;
  return Buffer.from(svg);
}

async function saveBufferLocal(buffer, filename) {
  const outPath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(outPath, buffer);
  return outPath;
}

async function uploadToS3(buffer, key, contentType) {
  const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType, ACL: 'private' });
  await s3client.send(cmd);
  return key;
}

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file missing' });
    const file = req.file;
    if (!allowedTypes.includes(file.mimetype)) return res.status(400).json({ error: 'unsupported file type' });

    const id = uuidv4();
    const basename = `${id}`;
    const sizes = [
      { name: 'small', width: 320 },
      { name: 'medium', width: 800 },
      { name: 'large', width: 1600 }
    ];

    const results = [];

    const wantWatermark = (req.body.watermark || 'false') === 'true';
    const watermarkText = req.body.watermarkText || 'Gatheraa';

    // SVGs are special: we don't rasterize unless requested
    const isSVG = file.mimetype === 'image/svg+xml';

    for (const s of sizes) {
      const targetNameBase = `${basename}_${s.name}`;

      if (isSVG) {
        // keep original svg (optionally could rasterize using librsvg if needed)
        const filename = `${targetNameBase}.svg`;
        if (USE_S3) {
          await uploadToS3(file.buffer, filename, 'image/svg+xml');
          results.push({ size: s.name, url: `${CDN_URL ? CDN_URL : ''}/${filename}` });
        } else {
          await saveBufferLocal(file.buffer, filename);
          results.push({ size: s.name, url: `/images/${filename}` });
        }
        continue;
      }

      // Raster pipeline: original format resized
      const img = sharp(file.buffer).resize({ width: s.width, withoutEnlargement: true });
      if (wantWatermark) {
        const svgBuf = createWatermarkSVG(watermarkText);
        img.composite([{ input: svgBuf, gravity: 'southeast' }]);
      }

      // JPEG/PNG fallback (original-like)
      const jpegBuffer = await img.clone().jpeg({ quality: 80 }).toBuffer();
      const jpegName = `${targetNameBase}.jpg`;
      if (USE_S3) {
        await uploadToS3(jpegBuffer, jpegName, 'image/jpeg');
        results.push({ size: s.name, format: 'jpg', url: `${CDN_URL ? CDN_URL : ''}/${jpegName}` });
      } else {
        await saveBufferLocal(jpegBuffer, jpegName);
        results.push({ size: s.name, format: 'jpg', url: `/images/${jpegName}` });
      }

      // WebP
      const webpBuffer = await img.clone().webp({ quality: 75 }).toBuffer();
      const webpName = `${targetNameBase}.webp`;
      if (USE_S3) {
        await uploadToS3(webpBuffer, webpName, 'image/webp');
        results.push({ size: s.name, format: 'webp', url: `${CDN_URL ? CDN_URL : ''}/${webpName}` });
      } else {
        await saveBufferLocal(webpBuffer, webpName);
        results.push({ size: s.name, format: 'webp', url: `/images/${webpName}` });
      }

      // AVIF (try/catch since not always available)
      try {
        const avifBuffer = await img.clone().avif({ quality: 60 }).toBuffer();
        const avifName = `${targetNameBase}.avif`;
        if (USE_S3) {
          await uploadToS3(avifBuffer, avifName, 'image/avif');
          results.push({ size: s.name, format: 'avif', url: `${CDN_URL ? CDN_URL : ''}/${avifName}` });
        } else {
          await saveBufferLocal(avifBuffer, avifName);
          results.push({ size: s.name, format: 'avif', url: `/images/${avifName}` });
        }
      } catch (err) {
        // AVIF not supported in this environment, ignore
      }
    }

    return res.json({ id, files: results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

app.get('/signed-url', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'missing key' });
    if (USE_S3) {
      const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
      // create a presigned PUT URL so clients can upload directly (expires in 15m)
      const url = await getSignedUrl(s3client, cmd, { expiresIn: 900 });
      return res.json({ url });
    }
    // Local signed URL: create a token (very simple) — production should use real signing
    const token = Buffer.from(`${key}:${Date.now()}`).toString('base64');
    return res.json({ url: `/images/${key}?token=${token}`, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Serve static images when not using S3
if (!USE_S3) {
  app.use('/images', express.static(uploadsDir, { index: false }));
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Image service listening on port ${PORT} (USE_S3=${USE_S3})`);
});
