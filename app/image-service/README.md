# Image Service

This service provides image upload + processing (resize, WebP/AVIF conversion, watermarking) and optional CDN/S3 integration.

Quick start (local, no S3):

```bash
cd app/image-service
npm install
node index.js
# or via docker-compose
docker-compose up --build
```

Endpoints:
- `POST /upload` — multipart form `file` field. Optional form fields: `watermark=true|false`, `watermarkText=...`.
- `GET /signed-url?key=...` — returns signed upload URL (S3 PUT presigned if S3 configured, otherwise local preview token)
- `GET /images/<filename>` — served when `USE_S3=false`

Example curl (upload):

```bash
curl -F "file=@./banner.jpg" -F "watermark=true" http://localhost:4000/upload
```

Environment variables (see `.env.example`):
- `USE_S3` — `true` to upload assets to S3 and return CDN URLs (requires AWS vars)
- `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — for S3 uploads
- `CDN_URL` — optional CDN base URL to prefix returned asset keys (e.g., CloudFront distribution domain)

Notes & Next steps:
- The service writes processed files to `uploads/` by default when `USE_S3=false`.
- For production: use S3 + CloudFront (set `CDN_URL` to the distribution). Add CloudFront signed URL generation when private distributions are needed.
- Consider moving processing to AWS Lambda / Lambda@Edge for on-the-fly generation and caching.
