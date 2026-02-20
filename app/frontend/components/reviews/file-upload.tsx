'use client';

import { useState, useCallback } from 'react';
import { X, Upload, Image, Video } from 'lucide-react';

export interface UploadedFile {
  file: File;
  preview: string;
  url?: string;
  type: 'PHOTO' | 'VIDEO';
}

interface FileUploadProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string;
}

export default function FileUpload({
  files,
  onChange,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  accept = 'image/*,video/*',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${maxSize / 1024 / 1024}MB`;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return 'Only images and videos are allowed';
    }

    return null;
  };

  const processFile = (file: File): UploadedFile | null => {
    const error = validateFile(file);
    if (error) {
      alert(error);
      return null;
    }

    const type: 'PHOTO' | 'VIDEO' = file.type.startsWith('image/') ? 'PHOTO' : 'VIDEO';
    const preview = type === 'PHOTO' ? URL.createObjectURL(file) : '';

    return {
      file,
      preview,
      type,
    };
  };

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;

      const newFiles: UploadedFile[] = [];
      const remainingSlots = maxFiles - files.length;

      Array.from(fileList)
        .slice(0, remainingSlots)
        .forEach((file) => {
          const processed = processFile(file);
          if (processed) {
            newFiles.push(processed);
          }
        });

      if (newFiles.length > 0) {
        onChange([...files, ...newFiles]);
      }
    },
    [files, maxFiles, onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    },
    [handleFiles],
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      // Revoke object URLs to prevent memory leaks
      if (files[index].preview && files[index].type === 'PHOTO') {
        URL.revokeObjectURL(files[index].preview);
      }
      onChange(newFiles);
    },
    [files, onChange],
  );

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept={accept}
          onChange={handleFileInput}
          disabled={files.length >= maxFiles}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Click to upload
            </span>{' '}
            or drag and drop
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            Images and videos up to {maxSize / 1024 / 1024}MB
            {files.length >= maxFiles && ` (${maxFiles} files max)`}
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {files.map((uploadedFile, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            >
              {uploadedFile.type === 'PHOTO' && uploadedFile.preview ? (
                <img
                  src={uploadedFile.preview}
                  alt={uploadedFile.file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <button
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                {uploadedFile.file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
