# Review and Rating System API Documentation

## Overview

The Review and Rating System provides a comprehensive solution for managing user reviews and ratings for events. It includes moderation, helpfulness voting, reporting, photo/video attachments, and aggregate rating calculations.

## Features

- ✅ **CRUD Operations** - Create, read, update, and delete reviews
- ✅ **Rating Calculation** - Automatic aggregate rating calculation with distribution
- ✅ **Review Moderation** - Auto-moderation and admin moderation queue
- ✅ **Helpfulness Voting** - Users can vote reviews as helpful/unhelpful
- ✅ **Review Reporting** - Users can report inappropriate reviews
- ✅ **Media Attachments** - Support for photos and videos via Cloudinary
- ✅ **Sorting & Filtering** - Multiple sort options and flexible filtering
- ✅ **Notifications** - Notification hooks (structure ready for email/WebSocket)

## Authentication

All endpoints except `GET` requests require JWT authentication. Include the JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

Or via cookie:
```
Cookie: access_token=<your-jwt-token>
```

Admin-only endpoints require the `ADMIN` role.

---

## API Endpoints

### Create Review

Create a new review for an event.

**Endpoint:** `POST /reviews/events/:eventId/reviews`

**Authentication:** Required

**Request:**
- **Path Parameters:**
  - `eventId` (string) - UUID of the event
- **Body (multipart/form-data):**
  - `rating` (number, required) - Rating from 1-5
  - `title` (string, optional) - Review title
  - `content` (string, required) - Review content (min 10 characters)
  - `files` (File[], optional) - Up to 10 image/video files

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "userId": "uuid",
  "rating": 5,
  "title": "Great event!",
  "content": "Had an amazing time...",
  "status": "APPROVED",
  "helpfulCount": 0,
  "reportCount": 0,
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "avatar": "https://..."
  },
  "attachments": [
    {
      "id": "uuid",
      "type": "PHOTO",
      "url": "https://res.cloudinary.com/...",
      "thumbnailUrl": "https://res.cloudinary.com/...",
      "filename": "photo.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `201 Created` - Review created successfully
- `400 Bad Request` - Invalid input or duplicate review
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Event not found

---

### Get Reviews for Event

Get paginated reviews for a specific event.

**Endpoint:** `GET /reviews/events/:eventId/reviews`

**Authentication:** Optional (affects visibility of non-approved reviews)

**Query Parameters:**
- `sort` (string, default: "newest") - Sort order: `newest`, `oldest`, `highest_rated`, `lowest_rated`, `most_helpful`
- `rating` (number, optional) - Filter by rating (1-5)
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Great event!",
      "content": "...",
      "status": "APPROVED",
      "helpfulCount": 10,
      "userHasVoted": true,
      "userVoteIsHelpful": true,
      "attachments": [],
      "user": {...},
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

### Get All Reviews

Get all reviews with filtering and sorting.

**Endpoint:** `GET /reviews`

**Authentication:** Optional

**Query Parameters:**
- `eventId` (string, optional) - Filter by event
- `userId` (string, optional) - Filter by user
- `rating` (number, optional) - Filter by rating
- `status` (string, optional) - Filter by status: `PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`
- `hasAttachments` (boolean, optional) - Filter reviews with attachments
- `sort` (string, default: "newest") - Sort order
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page

**Response:** Same as "Get Reviews for Event"

---

### Get Single Review

Get a single review by ID.

**Endpoint:** `GET /reviews/:id`

**Authentication:** Optional (required to view non-approved reviews)

**Response:** `200 OK` - Single review object

**Status Codes:**
- `200 OK` - Review found
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Review not found

---

### Update Review

Update a review (only by author or admin).

**Endpoint:** `PATCH /reviews/:id`

**Authentication:** Required

**Body (JSON):**
```json
{
  "title": "Updated title",
  "content": "Updated content"
}
```

**Response:** `200 OK` - Updated review object

**Status Codes:**
- `200 OK` - Review updated
- `400 Bad Request` - Cannot update rejected review
- `403 Forbidden` - Not the review author
- `404 Not Found` - Review not found

---

### Delete Review

Delete a review (only by author or admin).

**Endpoint:** `DELETE /reviews/:id`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "message": "Review deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Review deleted
- `403 Forbidden` - Not the review author
- `404 Not Found` - Review not found

---

### Vote on Review

Vote a review as helpful or unhelpful.

**Endpoint:** `POST /reviews/:id/vote`

**Authentication:** Required

**Body (JSON):**
```json
{
  "isHelpful": true
}
```

**Response:** `200 OK` - Updated review with vote information

**Notes:**
- Clicking the same vote again removes it
- Switching votes updates the vote without changing helpful count
- Only helpful votes increment `helpfulCount`

---

### Report Review

Report an inappropriate review.

**Endpoint:** `POST /reviews/:id/report`

**Authentication:** Required

**Body (JSON):**
```json
{
  "reason": "SPAM",
  "description": "This review contains spam content"
}
```

**Reasons:** `SPAM`, `INAPPROPRIATE`, `FAKE`, `OTHER`

**Response:** `200 OK`
```json
{
  "message": "Review reported successfully"
}
```

**Status Codes:**
- `200 OK` - Report submitted
- `400 Bad Request` - Already reported this review
- `404 Not Found` - Review not found

---

### Get Moderation Queue

Get pending and flagged reviews for moderation (Admin only).

**Endpoint:** `GET /reviews/moderation/queue`

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page

**Response:** `200 OK` - List of reviews requiring moderation

---

### Moderate Review

Approve, reject, or flag a review (Admin only).

**Endpoint:** `POST /reviews/:id/moderate`

**Authentication:** Required (Admin)

**Body (JSON):**
```json
{
  "status": "APPROVED",
  "moderationReason": "Review meets guidelines"
}
```

**Statuses:** `PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`

**Response:** `200 OK` - Moderated review object

**Status Codes:**
- `200 OK` - Review moderated
- `403 Forbidden` - Not an admin
- `404 Not Found` - Review not found

---

## Rating System

### Event Rating Calculation

When reviews are created, updated, deleted, or moderated, the aggregate rating for the event is automatically recalculated.

**EventRating Entity:**
```json
{
  "eventId": "uuid",
  "averageRating": 4.5,
  "totalReviews": 20,
  "ratingDistribution": {
    "1": 1,
    "2": 2,
    "3": 5,
    "4": 7,
    "5": 5
  },
  "lastCalculatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Calculation Logic:**
- Only `APPROVED` reviews are included
- Average is rounded to 2 decimal places
- Distribution shows count for each rating (1-5)

---

## Moderation System

### Auto-Moderation

Reviews are automatically analyzed for:
- **Spam keywords** - Common spam phrases
- **Inappropriate content** - Offensive keywords
- **Excessive capitalization** - Potential spam indicator
- **Excessive links** - More than 2 URLs
- **Content length** - Too short content
- **Repetitive characters** - Spam patterns

**Initial Status:**
- `APPROVED` - Content passes auto-moderation
- `PENDING` - Requires manual review
- `FLAGGED` - High risk score (≥70)

### Manual Moderation

Admins can:
- View moderation queue (`GET /reviews/moderation/queue`)
- Approve reviews (`status: "APPROVED"`)
- Reject reviews (`status: "REJECTED"`)
- Flag reviews (`status: "FLAGGED"`)

---

## File Upload

### Supported Formats

**Images:**
- JPEG/JPG
- PNG
- GIF
- WebP
- SVG

**Videos:**
- MP4
- WebM
- QuickTime (MOV)
- AVI
- WMV

### Limits

- **Max file size:** 10MB per file
- **Max total size:** 50MB per request
- **Max files:** 10 files per review

### Cloudinary Integration

Files are uploaded to Cloudinary with:
- Automatic video thumbnail generation (640x360)
- Image thumbnail variants
- Organized storage in `gatherraa` folder
- Secure URLs (HTTPS)

**Configuration Required:**
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CDN_PROVIDER=cloudinary
```

---

## Review Statuses

- **PENDING** - Awaiting moderation
- **APPROVED** - Published and visible
- **REJECTED** - Rejected by moderator
- **FLAGGED** - Flagged for review (high risk)

---

## Sorting Options

- `newest` - Most recent first (default)
- `oldest` - Oldest first
- `highest_rated` - Highest rating first
- `lowest_rated` - Lowest rating first
- `most_helpful` - Most helpful votes first

---

## Filtering Options

- `eventId` - Filter by event
- `userId` - Filter by user
- `rating` - Filter by specific rating (1-5)
- `status` - Filter by status
- `hasAttachments` - Only reviews with attachments
- `minDate` / `maxDate` - Date range filtering

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

**Common Status Codes:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Example Requests

### Create Review with Files

```bash
curl -X POST http://localhost:3000/reviews/events/{eventId}/reviews \
  -H "Authorization: Bearer {token}" \
  -F "rating=5" \
  -F "title=Amazing Event" \
  -F "content=Had a wonderful time at this event!" \
  -F "files=@photo1.jpg" \
  -F "files=@video1.mp4"
```

### Get Reviews with Filtering

```bash
curl "http://localhost:3000/reviews/events/{eventId}/reviews?sort=highest_rated&rating=5&page=1&limit=10"
```

### Vote on Review

```bash
curl -X POST http://localhost:3000/reviews/{reviewId}/vote \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"isHelpful": true}'
```

### Report Review

```bash
curl -X POST http://localhost:3000/reviews/{reviewId}/report \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "SPAM", "description": "Contains spam content"}'
```

---

## Database Schema

### Review Entity
- `id` (UUID) - Primary key
- `eventId` (UUID) - Foreign key to Event
- `userId` (UUID) - Foreign key to User
- `rating` (int) - Rating 1-5
- `title` (string, nullable) - Review title
- `content` (text) - Review content
- `status` (enum) - PENDING, APPROVED, REJECTED, FLAGGED
- `moderatorId` (UUID, nullable) - Foreign key to User
- `moderatedAt` (datetime, nullable) - Moderation timestamp
- `moderationReason` (text, nullable) - Reason for moderation
- `helpfulCount` (int) - Count of helpful votes
- `reportCount` (int) - Count of reports
- `createdAt` (datetime)
- `updatedAt` (datetime)

### ReviewAttachment Entity
- `id` (UUID) - Primary key
- `reviewId` (UUID) - Foreign key to Review
- `type` (enum) - PHOTO, VIDEO
- `url` (string) - CDN URL
- `thumbnailUrl` (string, nullable) - Thumbnail URL
- `filename` (string) - Original filename
- `mimeType` (string) - MIME type
- `size` (bigint) - File size in bytes
- `createdAt` (datetime)

### ReviewVote Entity
- `id` (UUID) - Primary key
- `reviewId` (UUID) - Foreign key to Review
- `userId` (UUID) - Foreign key to User
- `isHelpful` (boolean) - Helpful or unhelpful
- `createdAt` (datetime)
- Unique constraint on (reviewId, userId)

### ReviewReport Entity
- `id` (UUID) - Primary key
- `reviewId` (UUID) - Foreign key to Review
- `reporterId` (UUID) - Foreign key to User
- `reason` (enum) - SPAM, INAPPROPRIATE, FAKE, OTHER
- `description` (text, nullable) - Additional details
- `status` (enum) - PENDING, RESOLVED, DISMISSED
- `createdAt` (datetime)

### EventRating Entity
- `id` (UUID) - Primary key
- `eventId` (UUID) - Foreign key to Event (unique)
- `averageRating` (decimal) - Average rating (1.00-5.00)
- `totalReviews` (int) - Total approved reviews
- `ratingDistribution` (JSON) - Distribution by rating
- `lastCalculatedAt` (datetime) - Last calculation timestamp
- `createdAt` (datetime)

---

## Notifications

The notification system provides hooks for:
- New review notifications (to event organizer)
- Moderation alerts (to moderators)
- Report threshold alerts (when report count ≥ 3)
- Moderation result notifications (to review author)

**Current Implementation:** Console logging (structure ready for email/WebSocket integration)

---

## Environment Variables

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CDN_PROVIDER=cloudinary

# File Upload Limits
MAX_FILE_SIZE=10485760        # 10MB in bytes
MAX_TOTAL_SIZE=52428800       # 50MB in bytes
UPLOAD_DIR=./uploads          # Local fallback directory
CDN_BASE_URL=http://localhost:3000/uploads
```

---

## Testing

### Manual Testing

1. **Create Review:**
   - POST to `/reviews/events/{eventId}/reviews` with rating, content, and optional files
   - Verify review appears in moderation queue if flagged

2. **View Reviews:**
   - GET `/reviews/events/{eventId}/reviews` with various sort/filter options
   - Verify pagination works correctly

3. **Vote:**
   - POST to `/reviews/{reviewId}/vote` with `isHelpful: true`
   - Verify `helpfulCount` increments
   - Vote again to verify toggle behavior

4. **Report:**
   - POST to `/reviews/{reviewId}/report` with reason
   - Verify `reportCount` increments
   - Try reporting again to verify duplicate prevention

5. **Moderate:**
   - GET `/reviews/moderation/queue` (as admin)
   - POST to `/reviews/{reviewId}/moderate` to approve/reject
   - Verify rating recalculates when status changes

