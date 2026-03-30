# FileUpload Component

Reusable drag-and-drop or click upload component for documents, videos, and images.

## Features

- Accept multiple file types
- Validate file size and type
- Show upload progress bars per file
- Supports preview thumbnails for images
- Callbacks for data and lifecycle events
- Upload error handling and retry
- Accessible controls and keyboard behavior

## Usage

### Basic Usage

```tsx
'use client';

import FileUpload from '@/components/upload/FileUpload';

export default function UploadPage() {
  return (
    <div className="p-8">
      <FileUpload
        uploadEndpoint="/api/upload"
        accept="image/*,video/*,application/pdf"
        maxFileSizeBytes={50 * 1024 * 1024}
        maxFiles={6}
        onFilesChanged={(files) => console.log(files)}
        onUploadComplete={(files) => console.log('Finished', files)}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}
```

## Props

- `uploadEndpoint` (string, required): API endpoint to send uploads to.
- `accept` (string): Allowed file types, default `image/*,video/*,application/pdf`.
- `maxFileSizeBytes` (number): Maximum file size per file in bytes.
- `maxFiles` (number): Maximum files allowed.
- `autoUpload` (boolean): Upload automatically after selection (default true).
- `additionalFormData` (object): Extra form data to include in upload.
- `headers` (object): HTTP headers for upload request.
- `onFilesChanged` (function): Receives current file list on change.
- `onUploadComplete` (function): Called with final files after success.
- `onError` (function): Called with error message and optional file.

## Hook

### `useFileUpload`

- `files`: UploadedFileInfo[]
- `status`: 'idle' | 'uploading' | 'success' | 'error'
- `error`: string | null
- `addFiles(files)`
- `removeFile(fileId)`
- `clearFiles()`
- `startUpload()`
- `setError(error)`

## Acceptance Criteria

- Reusable across pages via `FileUpload` component
- skip option not required (N/A for upload)
- Completed state persisted via browser in-memory state
- Supports callback for file data
- Handles upload errors and shows messages
- Supports preview thumbnails for images

## Testing

- Run tests with `npm test -- FileUpload.test.tsx`
- Storybook entries available in `FileUpload.stories.tsx`
